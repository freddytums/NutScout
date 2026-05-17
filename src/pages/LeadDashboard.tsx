import { useState, useMemo, type ReactNode } from 'react';
import { HelpButton } from '@/components/ui/HelpButton';
import { AskAiButton } from '@/components/ai/AskAiButton';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  AlertCircle, AlertTriangle, CheckCircle2, Users, Loader2, CalendarOff,
  ChevronRight, Grid3x3, ClipboardList, BarChart2, Flag, ExternalLink,
  UserPlus, Clock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useMatches } from '@/hooks/useMatches';
import { usePits } from '@/hooks/usePits';
import { useEventStore } from '@/store/eventStore';
import { getGameConfig } from '@/config/games';
import { useTBAStore } from '@/store/tbaStore';
import { useSchedule } from '@/hooks/useSchedule';
import { patchScheduleSlot } from '@/lib/firestore';
import { runAllChecks } from '@/lib/dataQuality';
import type { DataIssue } from '@/lib/dataQuality';
import type { MatchEntry, Station, ScheduledSlot } from '@/types/scout';
import { sortMatches, teamNumberFromKey } from '@/lib/tba';
import { cn } from '@/lib/utils';

// ─── Issue tooltip builder ────────────────────────────────────────────────────

function buildIssueTooltip(issue: DataIssue): string {
  const lines: string[] = [];

  if (issue.type === 'outlier') {
    if (issue.field)               lines.push(`Field: ${issue.field}`);
    if (issue.value !== undefined)  lines.push(`Recorded: ${issue.value}`);
    if (issue.expected)            lines.push(`Typical range: ${issue.expected}`);
    if (issue.teamNumber)          lines.push(`Team ${issue.teamNumber} · Q${issue.matchNumber ?? '?'}`);
    if (issue.matchId)             lines.push(`Entry ID: ${issue.matchId.slice(0, 10)}…`);
  } else if (issue.type === 'duplicate') {
    if (issue.teamNumber)          lines.push(`Team ${issue.teamNumber}`);
    if (issue.matchNumber)         lines.push(`Q${issue.matchNumber}`);
    lines.push('Two entries exist for the same match slot.');
    lines.push('Open Data Management to review and delete one.');
  } else if (issue.type === 'missing') {
    if (issue.teamNumber)          lines.push(`Team ${issue.teamNumber}`);
    lines.push('Not enough match entries recorded.');
    lines.push('Assign a scout or check the coverage matrix.');
  } else if (issue.type === 'incomplete') {
    if (issue.teamNumber)          lines.push(`Team ${issue.teamNumber} · Q${issue.matchNumber ?? '?'}`);
    lines.push('Some fields were left empty in this entry.');
    if (issue.matchId)             lines.push(`Entry ID: ${issue.matchId.slice(0, 10)}…`);
  }

  return lines.join('\n');
}

// ─── Issue row with correction actions ───────────────────────────────────────

function IssueRow({ issue, onScout, onFlag, onView }: {
  issue: DataIssue;
  onScout?: (teamNumber: number) => void;
  onFlag?: (matchId: string) => Promise<void>;
  onView?: (teamNumber: number) => void;
}) {
  const [flagging, setFlagging] = useState(false);
  const [flagged, setFlagged] = useState(false);

  async function handleFlag() {
    if (!issue.matchId || !onFlag) return;
    setFlagging(true);
    try {
      await onFlag(issue.matchId);
      setFlagged(true);
    } finally {
      setFlagging(false);
    }
  }

  const tooltip = buildIssueTooltip(issue);

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-[hsl(var(--border)/0.5)] last:border-0">
      {issue.severity === 'error' ? (
        <span title={tooltip} className="shrink-0 mt-0.5 cursor-help"><AlertCircle size={16} className="text-[hsl(var(--destructive))]" /></span>
      ) : (
        <span title={tooltip} className="shrink-0 mt-0.5 cursor-help"><AlertTriangle size={16} className="text-amber-400" /></span>
      )}
      <div className="flex flex-col gap-1.5 min-w-0 flex-1">
        <span className="text-sm text-[hsl(var(--foreground))] leading-snug">{issue.message}</span>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge
            variant={issue.type === 'duplicate' ? 'destructive' : issue.type === 'outlier' ? 'amber' : 'muted'}
            className="text-[10px]"
          >
            {issue.type}
          </Badge>

          {/* Duplicate → navigate to data page to review and delete */}
          {issue.type === 'duplicate' && onView && issue.teamNumber != null && (
            <button
              type="button"
              onClick={() => onView(issue.teamNumber!)}
              className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-[hsl(var(--destructive)/0.45)] text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.1)] cursor-pointer transition-colors"
            >
              <ExternalLink size={9} /> View &amp; delete
            </button>
          )}

          {/* Missing coverage → send lead to scout that team */}
          {issue.type === 'missing' && issue.teamNumber != null && onScout && (
            <button
              type="button"
              onClick={() => onScout(issue.teamNumber!)}
              className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-[hsl(var(--accent)/0.45)] text-[hsl(var(--accent))] hover:bg-[hsl(var(--accent)/0.1)] cursor-pointer transition-colors"
            >
              <ClipboardList size={9} /> Scout now
            </button>
          )}

          {/* Outlier → flag for recount + link to team's data */}
          {issue.type === 'outlier' && (
            <>
              {onFlag && issue.matchId && (
                <button
                  type="button"
                  onClick={handleFlag}
                  disabled={flagging || flagged}
                  className={cn(
                    'flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border cursor-pointer transition-colors disabled:cursor-default',
                    flagged
                      ? 'border-[hsl(var(--accent)/0.3)] text-[hsl(var(--accent))] bg-[hsl(var(--accent)/0.08)]'
                      : 'border-amber-500/40 text-amber-400 hover:bg-amber-500/10 disabled:opacity-50',
                  )}
                >
                  <Flag size={9} />
                  {flagging ? '…' : flagged ? 'Flagged' : 'Flag recount'}
                </button>
              )}
              {onView && issue.teamNumber != null && (
                <button
                  type="button"
                  onClick={() => onView(issue.teamNumber!)}
                  className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:border-[hsl(var(--accent)/0.3)] cursor-pointer transition-colors"
                >
                  <ExternalLink size={9} /> View data
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tool: Coverage Matrix ────────────────────────────────────────────────────

function CoverageMatrix({ matches }: { matches: MatchEntry[] }) {
  const { matches: tbaMatches } = useTBAStore();

  const qualMatches = useMemo(
    () => sortMatches(tbaMatches.filter((m) => m.comp_level === 'qm')),
    [tbaMatches]
  );

  // matchNum-alliance-position → submitted entry
  const entryMap = useMemo(() => {
    const map = new Map<string, MatchEntry>();
    matches.forEach((m) => {
      map.set(`${m.matchNumber}-${m.alliance}-${m.alliancePosition}`, m);
    });
    return map;
  }, [matches]);

  if (tbaMatches.length === 0) {
    // Fallback: group submitted entries by match number
    const byMatch = new Map<number, MatchEntry[]>();
    matches.forEach((m) => {
      if (!byMatch.has(m.matchNumber)) byMatch.set(m.matchNumber, []);
      byMatch.get(m.matchNumber)!.push(m);
    });
    const sortedNums = [...byMatch.keys()].sort((a, b) => a - b);

    if (sortedNums.length === 0) {
      return (
        <p className="text-xs text-[hsl(var(--muted-foreground))] py-4 text-center">
          No match entries yet. Sync TBA data for full coverage view.
        </p>
      );
    }

    return (
      <div className="flex flex-col gap-1">
        <p className="text-xs text-[hsl(var(--muted-foreground))] mb-1">
          Sync TBA schedule to see expected vs. actual coverage. Showing submitted entries only.
        </p>
        <div className="rounded-lg border border-[hsl(var(--border))] overflow-hidden">
          <div className="overflow-y-auto max-h-56">
            <div className="grid sticky top-0 z-10 border-b border-[hsl(var(--border))]"
              style={{ gridTemplateColumns: '2.5rem repeat(3,1fr) repeat(3,1fr)' }}>
              <div className="bg-[hsl(var(--muted))]" />
              {['R1','R2','R3'].map((s) => (
                <div key={s} className="py-1 text-center text-[9px] font-bold bg-red-500/20 text-red-400">{s}</div>
              ))}
              {['B1','B2','B3'].map((s) => (
                <div key={s} className="py-1 text-center text-[9px] font-bold bg-blue-500/20 text-blue-400">{s}</div>
              ))}
            </div>
            {sortedNums.map((num) => {
              const entries = byMatch.get(num)!;
              return (
                <div key={num} className="grid border-t border-[hsl(var(--border)/0.3)]"
                  style={{ gridTemplateColumns: '2.5rem repeat(3,1fr) repeat(3,1fr)' }}>
                  <div className="flex items-center justify-center bg-[hsl(var(--muted)/0.5)]">
                    <span className="font-data text-[9px] font-bold text-[hsl(var(--muted-foreground))]">Q{num}</span>
                  </div>
                  {(['red','blue'] as const).map((alliance) =>
                    ([1,2,3] as const).map((pos) => {
                      const e = entries.find((x) => x.alliance === alliance && x.alliancePosition === pos);
                      const isFlagged = e && !!(e.flags?.needsRescount || e.flags?.outlier || e.flags?.duplicate);
                      return (
                        <div key={`${alliance}-${pos}`}
                          title={isFlagged ? '⚠ Flagged — data needs review' : undefined}
                          className={cn('py-1.5 text-[9px] font-data text-center',
                            isFlagged
                              ? 'bg-amber-500/25 text-amber-200'
                              : e ? 'bg-[hsl(142,60%,42%,0.12)] text-[hsl(142,60%,42%)]'
                              : 'text-[hsl(var(--muted-foreground)/0.3)]'
                          )}>
                          {isFlagged ? '⚠' : e ? e.teamNumber : '·'}
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const missedCount = qualMatches
    .filter((m) => !!m.actual_time)
    .reduce((acc, m) => {
      (['red','blue'] as const).forEach((al) =>
        ([1,2,3] as const).forEach((pos) => {
          if (!entryMap.has(`${m.match_number}-${al}-${pos}`)) acc++;
        })
      );
      return acc;
    }, 0);

  return (
    <div className="flex flex-col gap-2">
      {missedCount > 0 && (
        <div className="flex items-center gap-2 text-xs text-[hsl(var(--destructive))]">
          <AlertCircle size={12} /> {missedCount} slot{missedCount !== 1 ? 's' : ''} missing from played matches
        </div>
      )}
      <div className="rounded-lg border border-[hsl(var(--border))] overflow-hidden">
        <div className="overflow-y-auto max-h-56">
          <div className="grid sticky top-0 z-10 border-b border-[hsl(var(--border))]"
            style={{ gridTemplateColumns: '2.5rem repeat(3,1fr) repeat(3,1fr)' }}>
            <div className="bg-[hsl(var(--muted))]" />
            {['R1','R2','R3'].map((s) => (
              <div key={s} className="py-1 text-center text-[9px] font-bold bg-red-500/20 text-red-400">{s}</div>
            ))}
            {['B1','B2','B3'].map((s) => (
              <div key={s} className="py-1 text-center text-[9px] font-bold bg-blue-500/20 text-blue-400">{s}</div>
            ))}
          </div>
          {qualMatches.map((match) => {
            const played = !!match.actual_time;
            return (
              <div key={match.key} className="grid border-t border-[hsl(var(--border)/0.3)]"
                style={{ gridTemplateColumns: '2.5rem repeat(3,1fr) repeat(3,1fr)' }}>
                <div className="flex items-center justify-center bg-[hsl(var(--muted)/0.5)]">
                  <span className="font-data text-[9px] font-bold text-[hsl(var(--muted-foreground))]">Q{match.match_number}</span>
                </div>
                {(['red','blue'] as const).map((alliance) =>
                  ([1,2,3] as const).map((pos) => {
                    const entry = entryMap.get(`${match.match_number}-${alliance}-${pos}`);
                    const teamKey = match.alliances[alliance].team_keys[pos - 1];
                    const expected = teamKey ? teamNumberFromKey(teamKey) : null;
                    const isFlagged = entry && !!(entry.flags?.needsRescount || entry.flags?.outlier || entry.flags?.duplicate);
                    return (
                      <div
                        key={`${alliance}-${pos}`}
                        title={
                          isFlagged ? `⚠ Flagged — scouted by ${entry.scoutedByName}`
                          : entry ? `Scouted by ${entry.scoutedByName}`
                          : played ? `Missing — expected ${expected ?? '?'}`
                          : ''
                        }
                        className={cn(
                          'py-1.5 text-[9px] font-data text-center cursor-default',
                          isFlagged
                            ? 'bg-amber-500/25 text-amber-200'
                            : entry
                            ? 'bg-[hsl(142,60%,42%,0.12)] text-[hsl(142,60%,42%)]'
                            : played
                            ? 'bg-[hsl(var(--destructive)/0.08)] text-[hsl(var(--destructive))]'
                            : 'text-[hsl(var(--muted-foreground)/0.3)]'
                        )}
                      >
                        {isFlagged ? '⚠' : entry ? (expected ?? entry.teamNumber) : played ? '!' : '·'}
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex gap-4 text-[10px] text-[hsl(var(--muted-foreground))] flex-wrap">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[hsl(142,60%,42%,0.3)] inline-block" /> Scouted</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-500/30 inline-block" /> Flagged</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[hsl(var(--destructive)/0.2)] inline-block" /> Missed</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[hsl(var(--muted))] inline-block" /> Upcoming</span>
      </div>
    </div>
  );
}

// ─── Tool: Scout Activity Log ─────────────────────────────────────────────────

function ScoutLog({ matches }: { matches: MatchEntry[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const scouts = useMemo(() => {
    const map = new Map<string, { name: string; entries: MatchEntry[] }>();
    matches.forEach((m) => {
      if (!map.has(m.scoutedBy)) map.set(m.scoutedBy, { name: m.scoutedByName, entries: [] });
      map.get(m.scoutedBy)!.entries.push(m);
    });
    return [...map.values()].sort((a, b) => b.entries.length - a.entries.length);
  }, [matches]);

  if (scouts.length === 0) {
    return (
      <p className="text-xs text-[hsl(var(--muted-foreground))] py-4 text-center">No match entries submitted yet.</p>
    );
  }

  const max = scouts[0].entries.length;

  return (
    <div className="flex flex-col gap-1.5">
      {scouts.map(({ name, entries }) => {
        const uid = entries[0].scoutedBy;
        const isOpen = expanded === uid;
        const lastMatch = [...entries].sort((a, b) => b.matchNumber - a.matchNumber)[0];

        return (
          <div key={uid} className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] overflow-hidden">
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : uid)}
              className="w-full flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-[hsl(var(--muted)/0.6)] transition-colors text-left"
            >
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium truncate">{name}</span>
                <div className="mt-1.5 h-1 rounded-full bg-[hsl(var(--muted))] w-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[hsl(var(--accent))]"
                    style={{ width: `${(entries.length / max) * 100}%` }}
                  />
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-data text-base font-bold text-[hsl(var(--accent))]">{entries.length}</div>
                <div className="text-[10px] text-[hsl(var(--muted-foreground))]">last Q{lastMatch.matchNumber}</div>
              </div>
              <ChevronRight size={14} className={cn('text-[hsl(var(--muted-foreground))] transition-transform shrink-0', isOpen && 'rotate-90')} />
            </button>

            {isOpen && (
              <div className="border-t border-[hsl(var(--border)/0.5)] px-3 py-2">
                <div className="flex flex-wrap gap-1">
                  {[...entries]
                    .sort((a, b) => a.matchNumber - b.matchNumber)
                    .map((e) => {
                      const isFlagged = !!(e.flags?.needsRescount || e.flags?.outlier || e.flags?.duplicate);
                      return (
                        <span
                          key={e.id}
                          className={cn(
                            'text-[9px] font-data px-1.5 py-0.5 rounded font-semibold',
                            isFlagged
                              ? 'bg-amber-500/25 text-amber-200 ring-1 ring-amber-500/50'
                              : e.alliance === 'red' ? 'bg-red-500/15 text-red-400' : 'bg-blue-500/15 text-blue-400'
                          )}
                          title={`Q${e.matchNumber} · Team ${e.teamNumber} · ${e.alliance === 'red' ? 'R' : 'B'}${e.alliancePosition}${isFlagged ? ' · ⚠ Flagged' : ''}`}
                        >
                          {isFlagged ? `⚠Q${e.matchNumber}` : `Q${e.matchNumber}`}
                        </span>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Coverage Gaps ───────────────────────────────────────────────────────────

function timeAgo(unixSeconds: number): string {
  const diff = Math.floor(Date.now() / 1000) - unixSeconds;
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

interface MissingSlot {
  matchNumber: number;
  station: Station;
  teamNumber: number;
  playedAt: number | null;
  assigned: ScheduledSlot | null;
}

function CoverageGaps({ matches }: { matches: MatchEntry[] }) {
  const navigate = useNavigate();
  const { currentEventId } = useEventStore();
  const { matches: tbaMatches } = useTBAStore();
  const { schedule, primaryScouts } = useSchedule();
  const [assigning, setAssigning] = useState<string | null>(null); // key = `${matchNum}-${station}`

  const qualMatches = useMemo(
    () => sortMatches(tbaMatches.filter((m) => m.comp_level === 'qm')),
    [tbaMatches]
  );

  // Build a set of (matchNumber-alliance-position) that have been scouted
  const scoutedSlots = useMemo(() => {
    const s = new Set<string>();
    matches.forEach((m) => s.add(`${m.matchNumber}-${m.alliance}-${m.alliancePosition}`));
    return s;
  }, [matches]);

  // station string → alliance + position
  function stationParts(station: Station): { alliance: 'red' | 'blue'; pos: 1 | 2 | 3 } {
    const alliance = station.startsWith('red') ? 'red' : 'blue';
    const pos = parseInt(station.slice(-1)) as 1 | 2 | 3;
    return { alliance, pos };
  }

  // Collect all missing played slots
  const missingSlots = useMemo((): MissingSlot[] => {
    const out: MissingSlot[] = [];
    qualMatches.forEach((m) => {
      if (!m.actual_time) return; // not yet played
      (['red1','red2','red3','blue1','blue2','blue3'] as Station[]).forEach((station) => {
        const { alliance, pos } = stationParts(station);
        const key = `${m.match_number}-${alliance}-${pos}`;
        if (scoutedSlots.has(key)) return;
        const teamKey = m.alliances[alliance].team_keys[pos - 1];
        const teamNumber = teamKey ? teamNumberFromKey(teamKey) : null;
        if (!teamNumber) return;
        const assigned = schedule?.assignments?.[String(m.match_number)]?.[station] ?? null;
        out.push({ matchNumber: m.match_number, station, teamNumber, playedAt: m.actual_time, assigned });
      });
    });
    return out.sort((a, b) => a.matchNumber - b.matchNumber);
  }, [qualMatches, scoutedSlots, schedule]);

  // Group by team
  const byTeam = useMemo(() => {
    const map = new Map<number, MissingSlot[]>();
    missingSlots.forEach((s) => {
      if (!map.has(s.teamNumber)) map.set(s.teamNumber, []);
      map.get(s.teamNumber)!.push(s);
    });
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [missingSlots]);

  if (tbaMatches.length === 0) return null;
  if (missingSlots.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-6">
          <CheckCircle2 size={24} className="text-[hsl(var(--accent))]" />
          <span className="text-sm">All played matches have been scouted</span>
        </CardContent>
      </Card>
    );
  }

  async function handleAssign(slot: MissingSlot, scout: ScheduledSlot | null) {
    if (!currentEventId) return;
    await patchScheduleSlot(currentEventId, String(slot.matchNumber), slot.station, scout);
    setAssigning(null);
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <AlertCircle size={16} className="text-[hsl(var(--destructive))]" />
          <CardTitle>Missing Coverage</CardTitle>
        </div>
        <span className="text-xs text-[hsl(var(--muted-foreground))]">
          {missingSlots.length} slot{missingSlots.length !== 1 ? 's' : ''} · {byTeam.length} team{byTeam.length !== 1 ? 's' : ''}
        </span>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {byTeam.map(([teamNum, slots]) => (
          <div key={teamNum} className="rounded-lg border border-[hsl(var(--border))] overflow-hidden">
            {/* Team header */}
            <div className="flex items-center justify-between px-3 py-2 bg-[hsl(var(--muted)/0.4)] border-b border-[hsl(var(--border)/0.5)]">
              <span className="font-data font-bold text-sm">Team {teamNum}</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[hsl(var(--destructive))]">{slots.length} missing</span>
                <button
                  type="button"
                  onClick={() => navigate(`/manage/data?team=${teamNum}`)}
                  className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:border-[hsl(var(--accent)/0.4)] cursor-pointer transition-colors"
                >
                  <ExternalLink size={9} /> Go to data
                </button>
              </div>
            </div>
            {/* Missing match rows */}
            <div className="flex flex-col divide-y divide-[hsl(var(--border)/0.4)]">
              {slots.map((slot) => {
                const slotKey = `${slot.matchNumber}-${slot.station}`;
                const isAssigning = assigning === slotKey;
                const { alliance, pos } = stationParts(slot.station);
                return (
                  <div key={slotKey} className="flex items-center gap-2 px-3 py-2">
                    {/* Match badge */}
                    <span className={cn(
                      'font-data text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0',
                      alliance === 'red' ? 'bg-red-500/15 text-red-400' : 'bg-blue-500/15 text-blue-400'
                    )}>
                      Q{slot.matchNumber} {alliance === 'red' ? 'R' : 'B'}{pos}
                    </span>

                    {/* Assigned scout */}
                    <div className="flex-1 min-w-0">
                      {slot.assigned ? (
                        <span className="text-[11px] text-[hsl(var(--destructive))] truncate">
                          missed by {slot.assigned.name}
                        </span>
                      ) : (
                        <span className="text-[11px] text-[hsl(var(--muted-foreground))] italic">unassigned</span>
                      )}
                    </div>

                    {/* Time ago */}
                    {slot.playedAt && (
                      <span className="flex items-center gap-0.5 text-[10px] text-[hsl(var(--muted-foreground))] shrink-0 font-data">
                        <Clock size={9} /> {timeAgo(slot.playedAt)}
                      </span>
                    )}

                    {/* Assign scout button / picker */}
                    {isAssigning ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <select
                          autoFocus
                          className="text-[10px] bg-[hsl(var(--muted))] border border-[hsl(var(--accent)/0.4)] rounded px-1.5 py-0.5 text-[hsl(var(--foreground))] cursor-pointer"
                          defaultValue=""
                          onChange={(e) => {
                            const scout = primaryScouts.find((u) => u.uid === e.target.value);
                            if (scout) handleAssign(slot, { uid: scout.uid, name: scout.displayName, photoURL: scout.photoURL ?? undefined });
                          }}
                          onBlur={() => setAssigning(null)}
                        >
                          <option value="" disabled>Pick scout…</option>
                          {primaryScouts.map((u) => (
                            <option key={u.uid} value={u.uid}>{u.displayName}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAssigning(slotKey)}
                        className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-[hsl(var(--accent)/0.4)] text-[hsl(var(--accent))] hover:bg-[hsl(var(--accent)/0.1)] cursor-pointer transition-colors shrink-0"
                      >
                        <UserPlus size={9} /> {slot.assigned ? 'Reassign' : 'Assign'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Data Tools card ─────────────────────────────────────────────────────────

type ToolTab = 'matrix' | 'log';

function DataTools({ matches }: { matches: MatchEntry[] }) {
  const [tab, setTab] = useState<ToolTab>('matrix');

  const tabs: { id: ToolTab; label: string; icon: ReactNode }[] = [
    { id: 'matrix', label: 'Coverage',  icon: <Grid3x3 size={12} /> },
    { id: 'log',    label: 'Scout Log', icon: <ClipboardList size={12} /> },
  ];

  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle>Data Tools</CardTitle>
        <div className="flex gap-1 mt-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer',
                tab === t.id
                  ? 'border-[hsl(var(--accent))] bg-[hsl(var(--accent)/0.1)] text-[hsl(var(--accent))]'
                  : 'border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.5)] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="pt-3">
        {tab === 'matrix' && <CoverageMatrix matches={matches} />}
        {tab === 'log'    && <ScoutLog matches={matches} />}
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function LeadDashboard() {
  const navigate = useNavigate();
  const { currentEvent } = useEventStore();
  const { matches, loading: matchLoading, flag } = useMatches();
  const { pits, loading: pitLoading } = usePits();

  const teams = useMemo(() => {
    const assignments = currentEvent?.teamAssignments ?? {};
    return [...new Set(Object.values(assignments))].sort((a, b) => a - b);
  }, [currentEvent]);

  const allMatchFields = useMemo(() => {
    try {
      const config = getGameConfig(currentEvent?.activeGameYear ?? 2025);
      return [...config.match.auto, ...config.match.teleop];
    } catch {
      return [];
    }
  }, [currentEvent?.activeGameYear]);

  const issues = useMemo(() => runAllChecks(matches, allMatchFields), [matches, allMatchFields]);
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');

  const pitScouted = pits.filter((p) => p.status === 'scouted').length;

  const avgMatchesPerTeam = teams.length > 0
    ? (matches.length / teams.length).toFixed(1)
    : '0';

  const loading = matchLoading || pitLoading;

  return (
    <div className="p-4 flex flex-col gap-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Scouting Lead Dashboard</h2>
        <div className="flex items-center gap-2">
          {currentEvent && (
            <AskAiButton
              size="md"
              label="Ask AI"
              prompt={`Explain the top data-quality issues in event ${currentEvent.id}, grouped by severity. Suggest which to fix first.`}
            />
          )}
          <HelpButton content={{
          title: 'Lead Dashboard',
          description: 'Command center for the scouting lead. Monitor data quality and coverage gaps in real time.',
          steps: [
            { heading: 'Summary cards', detail: 'Quick counts of match entries, pits scouted, data errors, and warnings.' },
            { heading: 'Data Issues', detail: 'Duplicates, outlier values, and missing coverage — with one-click fixes like Flag Recount and Scout Now.' },
            { heading: 'Missing Coverage', detail: 'Lists every played qual match with no entry, who was assigned, and how long ago it happened.' },
            { heading: 'Coverage Matrix', detail: 'Full match grid — green = scouted, red = missed, gray = upcoming.' },
            { heading: 'Scout Log', detail: 'Per-scout submission count and history. Expand a row to see every match they submitted.' },
          ],
          tip: 'Tap any team badge in the issues list to jump directly to their data page.',
        }} />
        </div>
      </div>

      {!currentEvent && !loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <CalendarOff size={32} className="text-[hsl(var(--muted-foreground))]" />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">No event selected.</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">Go to Settings → Sync Event from TBA to get started.</p>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-[hsl(var(--accent))]" size={32} />
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="font-data text-2xl text-[hsl(var(--accent))] font-bold">{matches.length}</div>
                <div className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Match entries</div>
                <div className="text-xs text-[hsl(var(--muted-foreground))]">{avgMatchesPerTeam} avg/team</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="font-data text-2xl text-[hsl(var(--accent))] font-bold">{pitScouted}/{teams.length}</div>
                <div className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Pits scouted</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="font-data text-2xl text-[hsl(var(--destructive))] font-bold">{errors.length}</div>
                <div className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Errors</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="font-data text-2xl text-amber-400 font-bold">{warnings.length}</div>
                <div className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Warnings</div>
              </CardContent>
            </Card>
          </div>

          {/* Data quality issues — grouped by severity */}
          {issues.length > 0 ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Data Quality</CardTitle>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                  {errors.length > 0 && warnings.length > 0
                    ? `${errors.length} error${errors.length !== 1 ? 's' : ''} · ${warnings.length} warning${warnings.length !== 1 ? 's' : ''}`
                    : errors.length > 0
                    ? `${errors.length} error${errors.length !== 1 ? 's' : ''}`
                    : `${warnings.length} warning${warnings.length !== 1 ? 's' : ''}`}
                </p>
              </CardHeader>
              <CardContent className="pt-0 flex flex-col gap-0">
                {errors.length > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[hsl(var(--destructive))] uppercase tracking-wider pb-2">
                      <AlertCircle size={10} /> Errors
                    </div>
                    {errors.slice(0, 10).map((issue, i) => (
                      <IssueRow
                        key={i}
                        issue={issue}
                        onScout={(team) => navigate(`/match?team=${team}`)}
                        onFlag={async (matchId) => {
                          const entry = matches.find((m) => m.id === matchId);
                          await flag(matchId, { ...entry?.flags, needsRescount: true });
                        }}
                        onView={(team) => navigate(`/manage/data?team=${team}`)}
                      />
                    ))}
                    {errors.length > 10 && (
                      <p className="text-xs text-[hsl(var(--muted-foreground))] pt-1">+{errors.length - 10} more</p>
                    )}
                  </div>
                )}
                {errors.length > 0 && warnings.length > 0 && (
                  <div className="border-t border-[hsl(var(--border)/0.4)] mb-3" />
                )}
                {warnings.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-400 uppercase tracking-wider pb-2">
                      <AlertTriangle size={10} /> Warnings
                    </div>
                    {warnings.slice(0, 10).map((issue, i) => (
                      <IssueRow
                        key={i}
                        issue={issue}
                        onScout={(team) => navigate(`/match?team=${team}`)}
                        onFlag={async (matchId) => {
                          const entry = matches.find((m) => m.id === matchId);
                          await flag(matchId, { ...entry?.flags, needsRescount: true });
                        }}
                        onView={(team) => navigate(`/manage/data?team=${team}`)}
                      />
                    ))}
                    {warnings.length > 10 && (
                      <p className="text-xs text-[hsl(var(--muted-foreground))] pt-1">+{warnings.length - 10} more</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex items-center gap-3 py-6">
                <CheckCircle2 size={24} className="text-[hsl(var(--accent))]" />
                <span className="text-sm text-[hsl(var(--foreground))]">No data quality issues detected</span>
              </CardContent>
            </Card>
          )}

          {/* Data troubleshooting tools */}
          <DataTools matches={matches} />

          {/* Missing coverage — per-match detail view */}
          <CoverageGaps matches={matches} />

          {/* Quick links */}
          <div className="flex flex-col gap-1">
            <NavLink
              to="/manage/data"
              className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--primary))] hover:border-[hsl(var(--accent)/0.4)] transition-colors"
            >
              <div className="flex items-center gap-2 text-sm">
                <BarChart2 size={15} className="text-[hsl(var(--accent))]" />
                Match Data Management
              </div>
              <ChevronRight size={14} className="text-[hsl(var(--muted-foreground))]" />
            </NavLink>
            <NavLink
              to="/manage/users"
              className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--primary))] hover:border-[hsl(var(--accent)/0.4)] transition-colors"
            >
              <div className="flex items-center gap-2 text-sm">
                <Users size={15} className="text-[hsl(var(--accent))]" />
                Manage Users & Roles
              </div>
              <ChevronRight size={14} className="text-[hsl(var(--muted-foreground))]" />
            </NavLink>
          </div>
        </>
      )}
    </div>
  );
}
