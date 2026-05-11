import { useState, useMemo, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  AlertCircle, AlertTriangle, CheckCircle2, Users, Loader2, CalendarOff,
  ChevronRight, Grid3x3, ClipboardList, BarChart2, Flag, ExternalLink,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useMatches } from '@/hooks/useMatches';
import { usePits } from '@/hooks/usePits';
import { useEventStore } from '@/store/eventStore';
import { useTBAStore } from '@/store/tbaStore';
import { runAllChecks } from '@/lib/dataQuality';
import type { DataIssue } from '@/lib/dataQuality';
import type { MatchEntry } from '@/types/scout';
import { sortMatches, teamNumberFromKey } from '@/lib/tba';
import { cn } from '@/lib/utils';

// ─── Issue tooltip builder ────────────────────────────────────────────────────

function buildIssueTooltip(issue: DataIssue): string {
  const lines: string[] = [];

  if (issue.type === 'outlier') {
    if (issue.field)              lines.push(`Field: ${issue.field}`);
    if (issue.value !== undefined) lines.push(`Recorded: ${issue.value}`);
    if (issue.expected)           lines.push(`Typical range: ${issue.expected}`);
    if (issue.teamNumber)         lines.push(`Team ${issue.teamNumber} · Q${issue.matchNumber ?? '?'}`);
    if (issue.matchId)            lines.push(`Entry ID: ${issue.matchId.slice(0, 10)}…`);
  } else if (issue.type === 'missing') {
    if (issue.teamNumber)         lines.push(`Team ${issue.teamNumber}`);
    lines.push('Not enough match entries recorded.');
    lines.push('Assign a scout or check the coverage matrix.');
  } else if (issue.type === 'incomplete') {
    if (issue.teamNumber)         lines.push(`Team ${issue.teamNumber} · Q${issue.matchNumber ?? '?'}`);
    lines.push('Some fields were left empty in this entry.');
    if (issue.matchId)            lines.push(`Entry ID: ${issue.matchId.slice(0, 10)}…`);
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
          <Badge variant={issue.type === 'outlier' ? 'amber' : 'muted'} className="text-[10px]">
            {issue.type}
          </Badge>

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
                      return (
                        <div key={`${alliance}-${pos}`}
                          className={cn('py-1.5 text-[9px] font-data text-center',
                            e ? 'bg-[hsl(142,60%,42%,0.12)] text-[hsl(142,60%,42%)]' : 'text-[hsl(var(--muted-foreground)/0.3)]'
                          )}>
                          {e ? e.teamNumber : '·'}
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
                    return (
                      <div
                        key={`${alliance}-${pos}`}
                        title={entry ? `Scouted by ${entry.scoutedByName}` : played ? `Missing — expected ${expected ?? '?'}` : ''}
                        className={cn(
                          'py-1.5 text-[9px] font-data text-center cursor-default',
                          entry
                            ? 'bg-[hsl(142,60%,42%,0.12)] text-[hsl(142,60%,42%)]'
                            : played
                            ? 'bg-[hsl(var(--destructive)/0.08)] text-[hsl(var(--destructive))]'
                            : 'text-[hsl(var(--muted-foreground)/0.3)]'
                        )}
                      >
                        {entry ? (expected ?? entry.teamNumber) : played ? '!' : '·'}
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
                    .map((e) => (
                      <span
                        key={e.id}
                        className={cn(
                          'text-[9px] font-data px-1.5 py-0.5 rounded font-semibold',
                          e.alliance === 'red' ? 'bg-red-500/15 text-red-400' : 'bg-blue-500/15 text-blue-400'
                        )}
                        title={`Q${e.matchNumber} · Team ${e.teamNumber} · ${e.alliance === 'red' ? 'R' : 'B'}${e.alliancePosition}`}
                      >
                        Q{e.matchNumber}
                      </span>
                    ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
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

  const issues = useMemo(() => runAllChecks(matches, teams), [matches, teams]);
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');

  const pitScouted = pits.filter((p) => p.status === 'scouted').length;
  const matchCounts = useMemo(() => {
    const counts = new Map<number, number>();
    matches.forEach((m) => counts.set(m.teamNumber, (counts.get(m.teamNumber) ?? 0) + 1));
    return counts;
  }, [matches]);

  const avgMatchesPerTeam = teams.length > 0
    ? (matches.length / teams.length).toFixed(1)
    : '0';

  const loading = matchLoading || pitLoading;

  return (
    <div className="p-4 flex flex-col gap-4 max-w-2xl mx-auto">
      <h2 className="text-base font-semibold">Scouting Lead Dashboard</h2>

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

          {/* Issues list */}
          {issues.length > 0 ? (
            <Card>
              <CardHeader><CardTitle>Data Issues</CardTitle></CardHeader>
              <CardContent>
                {issues.slice(0, 20).map((issue, i) => (
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
                {issues.length > 20 && (
                  <p className="text-xs text-[hsl(var(--muted-foreground))] pt-2">
                    +{issues.length - 20} more issues
                  </p>
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

          {/* Teams needing coverage */}
          {teams.length > 0 && (() => {
            const MIN = 3;
            const unscouted = teams.filter((t) => (matchCounts.get(t) ?? 0) === 0);
            const low = teams.filter((t) => { const c = matchCounts.get(t) ?? 0; return c > 0 && c < MIN; });
            const covered = teams.length - unscouted.length - low.length;

            if (unscouted.length === 0 && low.length === 0) {
              return (
                <Card>
                  <CardContent className="flex items-center gap-3 py-4">
                    <CheckCircle2 size={18} className="text-[hsl(var(--accent))] shrink-0" />
                    <span className="text-sm">All {teams.length} teams have ≥{MIN} match entries</span>
                  </CardContent>
                </Card>
              );
            }

            return (
              <Card>
                <CardHeader className="flex-row items-center justify-between pb-2">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-[hsl(var(--accent))]" />
                    <CardTitle>Teams Needing Coverage</CardTitle>
                  </div>
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">
                    {covered}/{teams.length} at ≥{MIN}
                  </span>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {unscouted.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-[hsl(var(--destructive))] flex items-center gap-1">
                        <AlertCircle size={11} /> Not yet scouted — {unscouted.length} team{unscouted.length !== 1 ? 's' : ''}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {unscouted.map((team) => (
                          <button
                            key={team}
                            type="button"
                            onClick={() => navigate(`/match?team=${team}`)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[hsl(var(--destructive)/0.45)] bg-[hsl(var(--destructive)/0.07)] hover:bg-[hsl(var(--destructive)/0.13)] cursor-pointer transition-colors"
                            title="Open match scouting for this team"
                          >
                            <span className="font-data text-sm font-bold">{team}</span>
                            <span className="font-data text-[10px] text-[hsl(var(--destructive))]">0/{MIN}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {low.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-amber-400 flex items-center gap-1">
                        <AlertTriangle size={11} /> Low coverage — {low.length} team{low.length !== 1 ? 's' : ''}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {low.map((team) => {
                          const count = matchCounts.get(team) ?? 0;
                          return (
                            <button
                              key={team}
                              type="button"
                              onClick={() => navigate(`/match?team=${team}`)}
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-amber-500/40 bg-amber-500/07 hover:bg-amber-500/15 cursor-pointer transition-colors"
                              title="Open match scouting for this team"
                            >
                              <span className="font-data text-sm font-bold">{team}</span>
                              <span className="font-data text-[10px] text-amber-400">{count}/{MIN}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })()}

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
