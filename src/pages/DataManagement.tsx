import { useState, useMemo, useRef, useEffect, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search, SlidersHorizontal, ChevronDown, AlertTriangle,
  CalendarOff, Loader2, Trash2, X, ArrowUpDown, ArrowUp, ArrowDown,
  Download, Crosshair, RotateCcw,
} from 'lucide-react';
import { useMatches } from '@/hooks/useMatches';
import { usePits } from '@/hooks/usePits';
import { useEventStore } from '@/store/eventStore';
import { useAuth } from '@/hooks/useAuth';
import { getGameConfig } from '@/config/games';
import { findOutliers } from '@/lib/dataQuality';
import type { MatchEntry } from '@/types/scout';
import type { GameField } from '@/types/game';
import { cn } from '@/lib/utils';

// ── Helpers ───────────────────────────────────────────────────────────────────

const ENDGAME_PTS: Record<string, number> = { 'Deep Cage': 15, 'Shallow Cage': 6, 'Park': 2, 'None': 0 };

function scorePts(entry: MatchEntry, fields: GameField[]): { auto: number; teleop: number; endgame: number; total: number } {
  let auto = 0, teleop = 0, endgame = 0;
  for (const f of fields) {
    if (!f.pointsPerUnit) continue;
    const d = entry.data;
    const pts = f.type === 'counter' ? ((d[f.id] as number || 0) * f.pointsPerUnit)
      : f.type === 'toggle' ? ((d[f.id] ? 1 : 0) * f.pointsPerUnit)
      : f.type === 'select' && f.id === 'endgame_climb' ? (ENDGAME_PTS[d[f.id] as string] ?? 0)
      : 0;
    if (f.section === 'auto') auto += pts;
    else if (f.section === 'teleop') teleop += pts;
    else if (f.section === 'endgame') endgame += pts;
  }
  return { auto, teleop, endgame, total: auto + teleop + endgame };
}

function avg(arr: number[]) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }
function fmt(v: number, d = 1) { return v.toFixed(d); }

function shortLabel(f: GameField) {
  return f.label.replace(/^(Auto|Teleop|Endgame)\s*/i, '').replace('Scored ', '').trim();
}

function exportCsv(rows: MatchEntry[], allFields: GameField[]) {
  const headers = ['Match', 'Team', 'Alliance', 'Position', 'Scout', ...allFields.map((f) => f.label)];
  const lines = [headers.join(',')];
  rows.forEach((e) => {
    const cells = [
      e.matchNumber, e.teamNumber, e.alliance, e.alliancePosition, e.scoutedByName,
      ...allFields.map((f) => {
        const v = e.data[f.id];
        return typeof v === 'boolean' ? (v ? 1 : 0) : (v ?? '');
      }),
    ];
    lines.push(cells.map((c) => `"${c}"`).join(','));
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'match-data.csv'; a.click();
  URL.revokeObjectURL(url);
}

// ── Sort icon ─────────────────────────────────────────────────────────────────

function SortIcon({ col, sortCol, dir }: { col: string; sortCol: string; dir: 'asc' | 'desc' }) {
  if (col !== sortCol) return <ArrowUpDown size={10} className="opacity-30" />;
  return dir === 'asc' ? <ArrowUp size={10} className="text-[hsl(var(--accent))]" /> : <ArrowDown size={10} className="text-[hsl(var(--accent))]" />;
}

// ── Raw entries view ──────────────────────────────────────────────────────────

type RawSortCol = 'match' | 'team' | 'alliance' | 'scout' | 'auto' | 'teleop' | 'endgame' | 'total';

function RawEntriesView({ matches, allFields, outlierIds, initialTeam = '' }: {
  matches: MatchEntry[];
  allFields: GameField[];
  outlierIds: Set<string>;
  initialTeam?: string;
}) {
  const { user } = useAuth();
  const { deleteEntry } = useMatches();
  const isLead = user?.role === 'lead' || user?.role === 'admin';

  const [teamFilter, setTeamFilter]     = useState(initialTeam);
  const [matchFrom, setMatchFrom]       = useState('');
  const [matchTo, setMatchTo]           = useState('');
  const [allianceFilter, setAlliance]   = useState<'all' | 'red' | 'blue'>('all');
  const [scoutFilter, setScoutFilter]   = useState('');
  const [flaggedOnly, setFlaggedOnly]   = useState(false);
  const [showFilters, setShowFilters]   = useState(false);
  const [sortCol, setSortCol]           = useState<RawSortCol>('match');
  const [sortDir, setSortDir]           = useState<'asc' | 'desc'>('asc');
  const [confirming, setConfirming]     = useState<string | null>(null);
  const [deleting, setDeleting]         = useState<string | null>(null);

  const scouts = useMemo(() => [...new Set(matches.map((m) => m.scoutedByName))].sort(), [matches]);

  const scored = useMemo(() => matches.map((m) => ({ ...m, pts: scorePts(m, allFields) })), [matches, allFields]);

  const filtered = useMemo(() => {
    let rows = scored;
    if (teamFilter)    rows = rows.filter((r) => String(r.teamNumber).startsWith(teamFilter));
    if (matchFrom)     rows = rows.filter((r) => r.matchNumber >= parseInt(matchFrom));
    if (matchTo)       rows = rows.filter((r) => r.matchNumber <= parseInt(matchTo));
    if (allianceFilter !== 'all') rows = rows.filter((r) => r.alliance === allianceFilter);
    if (scoutFilter)   rows = rows.filter((r) => r.scoutedByName === scoutFilter);
    if (flaggedOnly)   rows = rows.filter((r) => outlierIds.has(r.id ?? ''));

    const mult = sortDir === 'asc' ? 1 : -1;
    const key: Record<RawSortCol, (r: typeof rows[0]) => number | string> = {
      match: (r) => r.matchNumber, team: (r) => r.teamNumber,
      alliance: (r) => r.alliance + r.alliancePosition, scout: (r) => r.scoutedByName,
      auto: (r) => r.pts.auto, teleop: (r) => r.pts.teleop, endgame: (r) => r.pts.endgame, total: (r) => r.pts.total,
    };
    return [...rows].sort((a, b) => {
      const av = key[sortCol](a); const bv = key[sortCol](b);
      return (av < bv ? -1 : av > bv ? 1 : 0) * mult;
    });
  }, [scored, teamFilter, matchFrom, matchTo, allianceFilter, scoutFilter, flaggedOnly, sortCol, sortDir, outlierIds]);

  function toggleSort(col: RawSortCol) {
    if (sortCol === col) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  }

  const activeFilters = [teamFilter, matchFrom, matchTo, scoutFilter, allianceFilter !== 'all', flaggedOnly].filter(Boolean).length;

  async function handleDelete(id: string) {
    setDeleting(id);
    try { await deleteEntry(id); } finally { setDeleting(null); setConfirming(null); }
  }

  function clearFilters() {
    setTeamFilter(''); setMatchFrom(''); setMatchTo(''); setAlliance('all'); setScoutFilter(''); setFlaggedOnly(false);
  }

  const TH = ({ col, label }: { col: RawSortCol; label: string }) => (
    <button type="button" onClick={() => toggleSort(col)}
      className="flex items-center gap-0.5 cursor-pointer hover:text-[hsl(var(--foreground))] transition-colors text-left">
      {label} <SortIcon col={col} sortCol={sortCol} dir={sortDir} />
    </button>
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Controls row */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
          <input value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}
            placeholder="Team #…" type="number" inputMode="numeric"
            className="w-full h-9 pl-7 pr-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] text-sm font-data focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
        </div>
        <button type="button" onClick={() => setShowFilters((v) => !v)}
          className={cn('flex items-center gap-1.5 h-9 px-3 rounded-lg border text-xs font-medium cursor-pointer transition-colors',
            activeFilters > 0 ? 'border-[hsl(var(--accent))] bg-[hsl(var(--accent)/0.1)] text-[hsl(var(--accent))]' : 'border-[hsl(var(--border))] bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]')}>
          <SlidersHorizontal size={13} />
          Filters {activeFilters > 0 && `(${activeFilters})`}
        </button>
        <button type="button" onClick={() => exportCsv(filtered, allFields)}
          className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] cursor-pointer transition-colors">
          <Download size={13} />
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.4)] p-3 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-[hsl(var(--muted-foreground))] font-medium uppercase tracking-wide">Match from</label>
              <input value={matchFrom} onChange={(e) => setMatchFrom(e.target.value)} type="number" inputMode="numeric" placeholder="1"
                className="h-8 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-2.5 text-sm font-data focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-[hsl(var(--muted-foreground))] font-medium uppercase tracking-wide">Match to</label>
              <input value={matchTo} onChange={(e) => setMatchTo(e.target.value)} type="number" inputMode="numeric" placeholder="99"
                className="h-8 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-2.5 text-sm font-data focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-[hsl(var(--muted-foreground))] font-medium uppercase tracking-wide">Alliance</label>
            <div className="flex gap-1.5">
              {(['all', 'red', 'blue'] as const).map((a) => (
                <button key={a} type="button" onClick={() => setAlliance(a)}
                  className={cn('flex-1 h-8 rounded-lg border text-xs font-medium cursor-pointer capitalize transition-colors',
                    allianceFilter === a
                      ? a === 'red' ? 'border-red-500 bg-red-500/15 text-red-400' : a === 'blue' ? 'border-blue-500 bg-blue-500/15 text-blue-400' : 'border-[hsl(var(--accent))] bg-[hsl(var(--accent)/0.1)] text-[hsl(var(--accent))]'
                      : 'border-[hsl(var(--border))] bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]')}>
                  {a}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-[hsl(var(--muted-foreground))] font-medium uppercase tracking-wide">Scout</label>
            <select value={scoutFilter} onChange={(e) => setScoutFilter(e.target.value)}
              className="h-8 px-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] text-xs focus:outline-none cursor-pointer">
              <option value="">All scouts</option>
              {scouts.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => setFlaggedOnly((v) => !v)}
              className={cn('flex items-center gap-2 text-sm cursor-pointer transition-colors',
                flaggedOnly ? 'text-amber-400' : 'text-[hsl(var(--muted-foreground))]')}>
              <AlertTriangle size={13} />
              Outliers only
            </button>
            {activeFilters > 0 && (
              <button type="button" onClick={clearFilters}
                className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] cursor-pointer">
                <X size={11} /> Clear filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* Stats bar */}
      <div className="flex items-center gap-3 text-xs text-[hsl(var(--muted-foreground))]">
        <span className="font-data font-semibold text-[hsl(var(--foreground))]">{filtered.length}</span> entries
        {filtered.length !== matches.length && <span className="text-amber-400">filtered from {matches.length}</span>}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <p className="text-sm text-center text-[hsl(var(--muted-foreground))] py-8">No entries match your filters.</p>
      ) : (
        <div className="rounded-xl border border-[hsl(var(--border))] overflow-hidden">
          {/* Header */}
          <div className={cn(
            'grid text-[9px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] px-3 py-2 bg-[hsl(var(--muted)/0.5)] border-b border-[hsl(var(--border))]',
            isLead ? 'grid-cols-[2.5rem_3rem_2.5rem_5rem_3rem_3rem_3rem_3.5rem_1.5rem]' : 'grid-cols-[2.5rem_3rem_2.5rem_5rem_3rem_3rem_3rem_3.5rem]'
          )}>
            <TH col="match" label="Q#" />
            <TH col="team"  label="Team" />
            <TH col="alliance" label="Pos" />
            <TH col="scout" label="Scout" />
            <TH col="auto"  label="Auto" />
            <TH col="teleop" label="TP" />
            <TH col="endgame" label="EG" />
            <TH col="total" label="Total" />
            {isLead && <span />}
          </div>

          {/* Rows */}
          <div className="overflow-y-auto no-scrollbar" style={{ maxHeight: 'calc(100dvh - 20rem)' }}>
            {filtered.map((row) => {
              const isOutlier = outlierIds.has(row.id ?? '');
              const isConfirming = confirming === row.id;
              return (
                <div key={row.id}
                  className={cn(
                    'grid items-center px-3 py-2 border-b border-[hsl(var(--border)/0.3)] last:border-0 text-[10px] transition-opacity',
                    isOutlier && 'bg-amber-500/04',
                    deleting === row.id && 'opacity-40 pointer-events-none',
                    isLead ? 'grid-cols-[2.5rem_3rem_2.5rem_5rem_3rem_3rem_3rem_3.5rem_1.5rem]' : 'grid-cols-[2.5rem_3rem_2.5rem_5rem_3rem_3rem_3rem_3.5rem]'
                  )}>
                  <span className="font-data font-bold text-[hsl(var(--muted-foreground))]">Q{row.matchNumber}</span>
                  <span className="font-data font-bold">{row.teamNumber}</span>
                  <span className={cn('font-data font-semibold px-1 py-0.5 rounded text-center',
                    row.alliance === 'red' ? 'bg-red-500/15 text-red-400' : 'bg-blue-500/15 text-blue-400')}>
                    {row.alliance === 'red' ? 'R' : 'B'}{row.alliancePosition}
                  </span>
                  <span className="truncate text-[hsl(var(--muted-foreground))]">{row.scoutedByName.split(' ')[0]}</span>
                  <span className="font-data text-center">{fmt(row.pts.auto, 0)}</span>
                  <span className="font-data text-center">{fmt(row.pts.teleop, 0)}</span>
                  <span className="font-data text-center">{fmt(row.pts.endgame, 0)}</span>
                  <span className={cn('font-data text-center font-bold', isOutlier ? 'text-amber-400' : 'text-[hsl(var(--foreground))]')}>
                    {fmt(row.pts.total, 0)}
                    {isOutlier && <AlertTriangle size={7} className="inline ml-0.5 mb-0.5" />}
                  </span>
                  {isLead && (
                    isConfirming ? (
                      <div className="flex gap-0.5">
                        <button type="button" onClick={() => handleDelete(row.id!)} disabled={!!deleting}
                          className="text-[8px] px-1.5 py-0.5 rounded bg-[hsl(var(--destructive))] text-white cursor-pointer font-semibold disabled:opacity-50">
                          {deleting === row.id ? '…' : 'Del'}
                        </button>
                        <button type="button" onClick={() => setConfirming(null)} className="text-[hsl(var(--muted-foreground))] cursor-pointer">
                          <X size={10} />
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setConfirming(row.id!)}
                        className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))] cursor-pointer transition-colors">
                        <Trash2 size={11} />
                      </button>
                    )
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer averages */}
          {filtered.length > 1 && (
            <div className={cn(
              'grid items-center px-3 py-2 bg-[hsl(var(--muted)/0.4)] border-t border-[hsl(var(--border))] text-[10px]',
              isLead ? 'grid-cols-[2.5rem_3rem_2.5rem_5rem_3rem_3rem_3rem_3.5rem_1.5rem]' : 'grid-cols-[2.5rem_3rem_2.5rem_5rem_3rem_3rem_3rem_3.5rem]'
            )}>
              <span className="text-[9px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] col-span-4">avg</span>
              <span className="font-data text-center font-bold text-[hsl(var(--accent))]">{fmt(avg(filtered.map((r) => r.pts.auto)))}</span>
              <span className="font-data text-center font-bold text-[hsl(var(--accent))]">{fmt(avg(filtered.map((r) => r.pts.teleop)))}</span>
              <span className="font-data text-center font-bold text-[hsl(var(--accent))]">{fmt(avg(filtered.map((r) => r.pts.endgame)))}</span>
              <span className="font-data text-center font-bold text-[hsl(var(--accent))]">{fmt(avg(filtered.map((r) => r.pts.total)))}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Teams view (per-team aggregate) ──────────────────────────────────────────

function TeamsView({ matches, allFields, outlierIds, initialTeam = '' }: {
  matches: MatchEntry[];
  allFields: GameField[];
  outlierIds: Set<string>;
  initialTeam?: string;
}) {
  const [search, setSearch]   = useState(initialTeam);
  const [sortKey, setSortKey] = useState('total');
  const [expanded, setExpanded] = useState<number | null>(
    initialTeam ? parseInt(initialTeam) || null : null
  );

  const byTeam = useMemo(() => {
    const map = new Map<number, MatchEntry[]>();
    matches.forEach((m) => {
      if (!map.has(m.teamNumber)) map.set(m.teamNumber, []);
      map.get(m.teamNumber)!.push(m);
    });
    return map;
  }, [matches]);

  const summaryFields = useMemo(() =>
    allFields.filter((f) => (f.pointsPerUnit ?? 0) > 0 && f.type !== 'select'),
    [allFields]
  );

  const numericFields = useMemo(() =>
    allFields.filter((f) => f.type === 'counter' || f.type === 'rating'),
    [allFields]
  );

  const teams = useMemo(() => {
    let list = [...byTeam.entries()].map(([team, entries]) => {
      const scored = entries.map((e) => scorePts(e, allFields));
      const fieldAvgs = Object.fromEntries(
        numericFields.map((f) => {
          const vals = entries.map((e) => e.data[f.id]).filter((v) => typeof v === 'number') as number[];
          return [f.id, vals.length ? avg(vals) : 0];
        })
      );
      return {
        team, entries,
        avgAuto:    avg(scored.map((s) => s.auto)),
        avgTeleop:  avg(scored.map((s) => s.teleop)),
        avgEndgame: avg(scored.map((s) => s.endgame)),
        avgTotal:   avg(scored.map((s) => s.total)),
        fieldAvgs,
        hasOutlier: entries.some((e) => outlierIds.has(e.id ?? '')),
      };
    });
    if (search) list = list.filter((x) => String(x.team).startsWith(search));
    list.sort((a, b) => {
      if (sortKey === 'team') return a.team - b.team;
      if (sortKey === 'entries') return b.entries.length - a.entries.length;
      if (sortKey === 'total') return b.avgTotal - a.avgTotal;
      if (sortKey === 'auto') return b.avgAuto - a.avgAuto;
      if (sortKey === 'teleop') return b.avgTeleop - a.avgTeleop;
      if (sortKey === 'endgame') return b.avgEndgame - a.avgEndgame;
      // field avg sort
      return (b.fieldAvgs[sortKey] ?? 0) - (a.fieldAvgs[sortKey] ?? 0);
    });
    return list;
  }, [byTeam, search, sortKey, allFields, numericFields, outlierIds]);

  if (matches.length === 0) return <p className="text-sm text-center text-[hsl(var(--muted-foreground))] py-8">No match data yet.</p>;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Team #…" type="number" inputMode="numeric"
            className="w-full h-9 pl-7 pr-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] text-sm font-data focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
        </div>
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value)}
          className="h-9 px-2.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] text-xs focus:outline-none cursor-pointer">
          <option value="total">Avg Total</option>
          <option value="auto">Avg Auto</option>
          <option value="teleop">Avg Teleop</option>
          <option value="endgame">Avg Endgame</option>
          <option value="entries">Match Count</option>
          <option value="team">Team #</option>
          {numericFields.map((f) => <option key={f.id} value={f.id}>{shortLabel(f)}</option>)}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        {teams.map(({ team, entries, avgAuto, avgTeleop, avgEndgame, avgTotal, fieldAvgs, hasOutlier }, rank) => {
          const isOpen = expanded === team;
          const sorted = [...entries].sort((a, b) => a.matchNumber - b.matchNumber);
          const maxTotal = Math.max(...teams.map((t) => t.avgTotal), 1);

          return (
            <div key={team} className="rounded-xl border border-[hsl(var(--border)/0.7)] bg-[hsl(var(--muted)/0.2)] overflow-hidden">
              <button type="button" onClick={() => setExpanded(isOpen ? null : team)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[hsl(var(--muted)/0.5)] transition-colors cursor-pointer text-left">
                <span className="text-[10px] text-[hsl(var(--muted-foreground))] w-5 shrink-0">#{rank + 1}</span>
                <span className="font-data text-base font-bold w-12 shrink-0">{team}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{entries.length}× matches</span>
                    {hasOutlier && <AlertTriangle size={10} className="text-amber-400" />}
                  </div>
                  <div className="mt-1 h-1 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                    <div className="h-full rounded-full bg-[hsl(var(--accent)/0.6)]" style={{ width: `${(avgTotal / maxTotal) * 100}%` }} />
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-data text-sm font-bold">{fmt(avgTotal, 0)}</div>
                  <div className="text-[9px] text-[hsl(var(--muted-foreground))]">avg pts</div>
                </div>
                <ChevronDown size={13} className={cn('text-[hsl(var(--muted-foreground))] transition-transform shrink-0', isOpen && 'rotate-180')} />
              </button>

              {isOpen && (
                <div className="border-t border-[hsl(var(--border)/0.5)] px-3 py-3 flex flex-col gap-3">
                  {/* Score breakdown */}
                  <div className="grid grid-cols-4 gap-2">
                    {[['Auto', avgAuto], ['Teleop', avgTeleop], ['Endgame', avgEndgame], ['Total', avgTotal]].map(([label, val]) => (
                      <div key={label as string} className="rounded-lg bg-[hsl(var(--muted)/0.6)] px-2 py-1.5 text-center">
                        <div className="font-data text-sm font-bold">{fmt(val as number, 1)}</div>
                        <div className="text-[9px] text-[hsl(var(--muted-foreground))]">{label as string}</div>
                      </div>
                    ))}
                  </div>

                  {/* Key field averages */}
                  <div className="rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--muted)/0.3)] overflow-hidden">
                    <div className="grid px-3 py-1.5 text-[9px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted)/0.5)]"
                      style={{ gridTemplateColumns: `repeat(${Math.min(summaryFields.length, 6)}, 1fr)` }}>
                      {summaryFields.slice(0, 6).map((f) => (
                        <span key={f.id} className="text-center truncate" title={f.label}>{shortLabel(f).slice(0, 5)}</span>
                      ))}
                    </div>
                    <div className="grid px-3 py-2"
                      style={{ gridTemplateColumns: `repeat(${Math.min(summaryFields.length, 6)}, 1fr)` }}>
                      {summaryFields.slice(0, 6).map((f) => (
                        <span key={f.id} className="font-data text-xs text-center font-bold text-[hsl(var(--accent))]">
                          {fmt(fieldAvgs[f.id] ?? 0)}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Per-match list */}
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Per match</span>
                    {sorted.map((e) => {
                      const pts = scorePts(e, allFields);
                      const isOutlier = outlierIds.has(e.id ?? '');
                      return (
                        <div key={e.id} className={cn(
                          'flex items-center gap-2 text-[10px] py-1 px-2 rounded',
                          isOutlier && 'bg-amber-500/08'
                        )}>
                          <span className="font-data font-bold text-[hsl(var(--muted-foreground))] w-7">Q{e.matchNumber}</span>
                          <span className={cn('font-data font-semibold w-5', e.alliance === 'red' ? 'text-red-400' : 'text-blue-400')}>
                            {e.alliance === 'red' ? 'R' : 'B'}{e.alliancePosition}
                          </span>
                          <span className="text-[hsl(var(--muted-foreground))] truncate flex-1">{e.scoutedByName.split(' ')[0]}</span>
                          <span className="font-data">{pts.auto}+{pts.teleop}+{pts.endgame}</span>
                          <span className={cn('font-data font-bold', isOutlier ? 'text-amber-400' : '')}>={pts.total}</span>
                          {isOutlier && <AlertTriangle size={8} className="text-amber-400 shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Scatter / Bubble chart ────────────────────────────────────────────────────

const VW = 480, VH = 300;
const PAD = { l: 50, r: 20, t: 18, b: 44 };
const CW = VW - PAD.l - PAD.r;
const CH = VH - PAD.t - PAD.b;
const MIN_RANGE = 0.5; // prevent over-zoom

function niceStep(range: number, n: number): number {
  if (range <= 0) return 1;
  const raw = range / n;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  return [1, 2, 2.5, 5, 10].map((s) => s * p).find((s) => s >= raw) ?? p * 10;
}

type ZoomBox = { x0: number; x1: number; y0: number; y1: number };

function ScatterView({ matches, allFields }: { matches: MatchEntry[]; allFields: GameField[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [xKey, setXKey] = useState('auto');
  const [yKey, setYKey] = useState('total');
  const [rKey, setRKey] = useState('entries');
  const [sel, setSel] = useState<number | null>(null);
  const [zoom, setZoom] = useState<ZoomBox | null>(null);

  // Refs that are always current — used inside non-reactive event handlers
  const zoomRef = useRef<ZoomBox | null>(null);
  const boundsRef = useRef<{ xMax: number; yMax: number } | null>(null);
  const dragRef = useRef<{ cx: number; cy: number; vx0: number; vx1: number; vy0: number; vy1: number } | null>(null);
  const touchRef = useRef<{ dist: number; mx: number; my: number; vx0: number; vx1: number; vy0: number; vy1: number } | null>(null);
  const movedRef = useRef(false);

  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  const numericFields = useMemo(
    () => allFields.filter((f) => f.type === 'counter' || f.type === 'rating'),
    [allFields]
  );

  const axes = useMemo<{ key: string; label: string }[]>(() => [
    { key: 'total',   label: 'Avg Total'   },
    { key: 'auto',    label: 'Avg Auto'    },
    { key: 'teleop',  label: 'Avg Teleop'  },
    { key: 'endgame', label: 'Avg Endgame' },
    { key: 'entries', label: 'Match Count' },
    ...numericFields.map((f) => ({ key: f.id, label: shortLabel(f) })),
  ], [numericFields]);

  const teamStats = useMemo(() => {
    const byTeam = new Map<number, MatchEntry[]>();
    matches.forEach((m) => {
      if (!byTeam.has(m.teamNumber)) byTeam.set(m.teamNumber, []);
      byTeam.get(m.teamNumber)!.push(m);
    });
    return [...byTeam.entries()].map(([team, entries]) => {
      const scored = entries.map((e) => scorePts(e, allFields));
      const fAvg: Record<string, number> = {};
      numericFields.forEach((f) => {
        const vals = entries.map((e) => e.data[f.id]).filter((v): v is number => typeof v === 'number');
        fAvg[f.id] = vals.length ? avg(vals) : 0;
      });
      const at = avg(scored.map((s) => s.total));
      const aa = avg(scored.map((s) => s.auto));
      const atl = avg(scored.map((s) => s.teleop));
      const ae = avg(scored.map((s) => s.endgame));
      const get = (k: string): number => {
        if (k === 'total') return at; if (k === 'auto') return aa;
        if (k === 'teleop') return atl; if (k === 'endgame') return ae;
        if (k === 'entries') return entries.length;
        return fAvg[k] ?? 0;
      };
      return { team, get };
    });
  }, [matches, allFields, numericFields]);

  // Reset zoom when axes change
  useEffect(() => { setZoom(null); setSel(null); }, [xKey, yKey]);

  const chart = useMemo(() => {
    if (teamStats.length === 0) return null;
    const xVals = teamStats.map((t) => t.get(xKey));
    const yVals = teamStats.map((t) => t.get(yKey));
    const rVals = teamStats.map((t) => t.get(rKey));
    const xDataMax = Math.max(...xVals, 1) * 1.12;
    const yDataMax = Math.max(...yVals, 1) * 1.12;
    boundsRef.current = { xMax: xDataMax, yMax: yDataMax };

    const x0 = zoom?.x0 ?? 0, x1 = zoom?.x1 ?? xDataMax;
    const y0 = zoom?.y0 ?? 0, y1 = zoom?.y1 ?? yDataMax;
    const rMax = Math.max(...rVals, 1);

    const xStep = niceStep(x1 - x0, 5);
    const yStep = niceStep(y1 - y0, 5);
    const firstXT = Math.ceil(x0 / xStep - 1e-9) * xStep;
    const firstYT = Math.ceil(y0 / yStep - 1e-9) * yStep;
    const xTicks = Array.from({ length: 10 }, (_, i) => +(firstXT + i * xStep).toFixed(10))
      .filter((v) => v <= x1 + xStep * 0.01);
    const yTicks = Array.from({ length: 10 }, (_, i) => +(firstYT + i * yStep).toFixed(10))
      .filter((v) => v <= y1 + yStep * 0.01);

    const toX = (v: number) => PAD.l + ((v - x0) / (x1 - x0)) * CW;
    const toY = (v: number) => PAD.t + CH - ((v - y0) / (y1 - y0)) * CH;

    const points = teamStats.map((t) => {
      const xRaw = t.get(xKey), yRaw = t.get(yKey), rRaw = t.get(rKey);
      return { team: t.team, cx: toX(xRaw), cy: toY(yRaw), r: 5 + (rRaw / rMax) * 13, xRaw, yRaw, rRaw };
    });

    const lx = axes.find((a) => a.key === xKey)?.label ?? xKey;
    const ly = axes.find((a) => a.key === yKey)?.label ?? yKey;
    const lr = axes.find((a) => a.key === rKey)?.label ?? rKey;

    const zoomLevel = zoom ? +((xDataMax / (x1 - x0)).toFixed(1)) : 1;
    return { points, xTicks, yTicks, lx, ly, lr, x0, x1, y0, y1, zoomLevel };
  }, [teamStats, xKey, yKey, rKey, zoom, axes]);

  // ── Coordinate helpers ────────────────────────────────────────────────────

  function getSvgXY(clientX: number, clientY: number) {
    const el = svgRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: (clientX - r.left) * (VW / r.width), y: (clientY - r.top) * (VH / r.height) };
  }

  function applyZoom(pivX: number, pivY: number, f: number, x0: number, x1: number, y0: number, y1: number) {
    const xr = Math.max(MIN_RANGE, (x1 - x0) * f);
    const yr = Math.max(MIN_RANGE, (y1 - y0) * f);
    const nx0 = Math.max(0, pivX - (pivX - x0) * f);
    const ny0 = Math.max(0, pivY - (pivY - y0) * f);
    setZoom({ x0: nx0, x1: nx0 + xr, y0: ny0, y1: ny0 + yr });
  }

  // ── Non-passive wheel event (cannot use React synthetic for passive:false) ──

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const fn = (e: WheelEvent) => {
      e.preventDefault();
      const pt = getSvgXY(e.clientX, e.clientY);
      if (!pt) return;
      const b = boundsRef.current;
      if (!b) return;
      const z = zoomRef.current;
      const x0 = z?.x0 ?? 0, x1 = z?.x1 ?? b.xMax;
      const y0 = z?.y0 ?? 0, y1 = z?.y1 ?? b.yMax;
      const f = e.deltaY > 0 ? 1.25 : 0.8;
      const svgX = Math.max(PAD.l, Math.min(pt.x, PAD.l + CW));
      const svgY = Math.max(PAD.t, Math.min(pt.y, PAD.t + CH));
      const pivX = x0 + ((svgX - PAD.l) / CW) * (x1 - x0);
      const pivY = y0 + ((PAD.t + CH - svgY) / CH) * (y1 - y0);
      applyZoom(pivX, pivY, f, x0, x1, y0, y1);
    };
    el.addEventListener('wheel', fn, { passive: false });
    return () => el.removeEventListener('wheel', fn);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Pointer drag (pan) ────────────────────────────────────────────────────

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (e.button !== 0 || !chart) return;
    const pt = getSvgXY(e.clientX, e.clientY);
    if (!pt || pt.x < PAD.l || pt.x > PAD.l + CW || pt.y < PAD.t || pt.y > PAD.t + CH) return;
    movedRef.current = false;
    dragRef.current = { cx: e.clientX, cy: e.clientY, vx0: chart.x0, vx1: chart.x1, vy0: chart.y0, vy1: chart.y1 };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.cx;
    const dy = e.clientY - dragRef.current.cy;
    if (Math.hypot(dx, dy) < 3 && !movedRef.current) return;
    movedRef.current = true;
    const el = svgRef.current;
    if (!el) return;
    const { width } = el.getBoundingClientRect();
    const s = VW / width;
    const { vx0, vx1, vy0, vy1 } = dragRef.current;
    const xr = vx1 - vx0, yr = vy1 - vy0;
    const nx0 = Math.max(0, vx0 - (dx * s / CW) * xr);
    const ny0 = Math.max(0, vy0 - (dy * s / CH) * yr);
    setZoom({ x0: nx0, x1: nx0 + xr, y0: ny0, y1: ny0 + yr });
  }

  function onPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    dragRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }

  // ── Two-finger pinch zoom ─────────────────────────────────────────────────

  function onTouchStart(e: React.TouchEvent<SVGSVGElement>) {
    if (e.touches.length !== 2 || !chart) return;
    e.preventDefault();
    const t1 = e.touches[0], t2 = e.touches[1];
    touchRef.current = {
      dist: Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY),
      mx: (t1.clientX + t2.clientX) / 2,
      my: (t1.clientY + t2.clientY) / 2,
      vx0: chart.x0, vx1: chart.x1, vy0: chart.y0, vy1: chart.y1,
    };
  }

  function onTouchMove(e: React.TouchEvent<SVGSVGElement>) {
    if (e.touches.length !== 2 || !touchRef.current || !svgRef.current) return;
    e.preventDefault();
    const t1 = e.touches[0], t2 = e.touches[1];
    const newDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    const sf = Math.max(0.1, newDist / touchRef.current.dist); // >1 = zoom in

    const r = svgRef.current.getBoundingClientRect();
    const s = VW / r.width;
    const { mx: imx, my: imy, vx0, vx1, vy0, vy1 } = touchRef.current;
    const xr = Math.max(MIN_RANGE, (vx1 - vx0) / sf);
    const yr = Math.max(MIN_RANGE, (vy1 - vy0) / sf);

    // Initial midpoint → data pivot
    const iSvgX = (imx - r.left) * s;
    const iSvgY = (imy - r.top) * s;
    const pivX = vx0 + ((iSvgX - PAD.l) / CW) * (vx1 - vx0);
    const pivY = vy0 + ((PAD.t + CH - iSvgY) / CH) * (vy1 - vy0);

    // Scale around pivot
    let nx0 = pivX - (pivX - vx0) / sf;
    let ny0 = pivY - (pivY - vy0) / sf;

    // Pan: move pivot from initial midpoint to current midpoint
    const cSvgX = ((t1.clientX + t2.clientX) / 2 - r.left) * s;
    const cSvgY = ((t1.clientY + t2.clientY) / 2 - r.top) * s;
    nx0 -= ((cSvgX - iSvgX) / CW) * xr;
    ny0 -= ((cSvgY - iSvgY) / CH) * yr;

    setZoom({ x0: Math.max(0, nx0), x1: Math.max(0, nx0) + xr, y0: Math.max(0, ny0), y1: Math.max(0, ny0) + yr });
  }

  function onTouchEnd() { touchRef.current = null; }

  // ── Render ────────────────────────────────────────────────────────────────

  const selPt = sel !== null && chart ? chart.points.find((p) => p.team === sel) ?? null : null;

  if (matches.length === 0) {
    return <p className="text-sm text-center text-[hsl(var(--muted-foreground))] py-8">No match data yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Axis selectors + zoom reset */}
      <div className="flex items-end gap-2">
        <div className="grid grid-cols-3 gap-2 flex-1">
          {([
            { id: 'x', label: 'X axis', value: xKey, set: setXKey },
            { id: 'y', label: 'Y axis', value: yKey, set: setYKey },
            { id: 'r', label: 'Bubble', value: rKey, set: setRKey },
          ] as const).map(({ id, label, value, set }) => (
            <div key={id} className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                {label}
              </label>
              <select
                value={value}
                onChange={(e) => { (set as (v: string) => void)(e.target.value); setSel(null); }}
                className="h-8 px-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] text-[11px] text-[hsl(var(--foreground))] focus:outline-none cursor-pointer"
              >
                {axes.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
              </select>
            </div>
          ))}
        </div>
        {zoom && (
          <button
            type="button"
            onClick={() => { setZoom(null); setSel(null); }}
            className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] text-[11px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] cursor-pointer transition-colors shrink-0"
            title="Reset zoom"
          >
            <RotateCcw size={11} />
            {chart && chart.zoomLevel > 1 ? `${chart.zoomLevel}×` : 'Reset'}
          </button>
        )}
      </div>

      {/* SVG chart */}
      {chart && (
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.12)] overflow-hidden">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${VW} ${VH}`}
            className="w-full select-none"
            style={{ touchAction: 'none', cursor: dragRef.current ? 'grabbing' : 'crosshair' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onClick={(e) => { if (!movedRef.current && !(e.target as Element).closest('circle')) setSel(null); }}
          >
            <defs>
              <clipPath id="chart-area">
                <rect x={PAD.l} y={PAD.t} width={CW} height={CH} />
              </clipPath>
            </defs>

            {/* Grid */}
            {chart.yTicks.map((v) => {
              const y = PAD.t + CH - ((v - chart.y0) / (chart.y1 - chart.y0)) * CH;
              return (
                <g key={`yg${v}`}>
                  <line x1={PAD.l} y1={y} x2={PAD.l + CW} y2={y}
                    stroke="hsl(var(--border))" strokeWidth="0.6" strokeDasharray="3 3" opacity="0.7" />
                  <text x={PAD.l - 5} y={y + 3} textAnchor="end" fontSize="7.5"
                    fill="hsl(var(--muted-foreground))" fontFamily="'JetBrains Mono', monospace">
                    {v % 1 === 0 ? v : v.toFixed(1)}
                  </text>
                </g>
              );
            })}
            {chart.xTicks.map((v) => {
              const x = PAD.l + ((v - chart.x0) / (chart.x1 - chart.x0)) * CW;
              return (
                <g key={`xg${v}`}>
                  <line x1={x} y1={PAD.t} x2={x} y2={PAD.t + CH}
                    stroke="hsl(var(--border))" strokeWidth="0.6" strokeDasharray="3 3" opacity="0.7" />
                  <text x={x} y={PAD.t + CH + 12} textAnchor="middle" fontSize="7.5"
                    fill="hsl(var(--muted-foreground))" fontFamily="'JetBrains Mono', monospace">
                    {v % 1 === 0 ? v : v.toFixed(1)}
                  </text>
                </g>
              );
            })}

            {/* Axis borders */}
            <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t + CH} stroke="hsl(var(--border))" strokeWidth="1.2" />
            <line x1={PAD.l} y1={PAD.t + CH} x2={PAD.l + CW} y2={PAD.t + CH} stroke="hsl(var(--border))" strokeWidth="1.2" />

            {/* Axis labels */}
            <text x={PAD.l + CW / 2} y={VH - 5} textAnchor="middle" fontSize="9"
              fill="hsl(var(--muted-foreground))" fontFamily="system-ui, sans-serif">{chart.lx}</text>
            <text x={10} y={PAD.t + CH / 2} textAnchor="middle" fontSize="9"
              fill="hsl(var(--muted-foreground))" fontFamily="system-ui, sans-serif"
              transform={`rotate(-90, 10, ${PAD.t + CH / 2})`}>{chart.ly}</text>

            {/* Bubbles + labels (clipped to chart area) */}
            <g clipPath="url(#chart-area)">
              {[...chart.points]
                .sort((a, b) => (a.team === sel ? 1 : b.team === sel ? -1 : 0))
                .map((p) => {
                  const isSelected = p.team === sel;
                  return (
                    <g key={p.team}
                      onClick={(e) => { e.stopPropagation(); if (!movedRef.current) setSel(isSelected ? null : p.team); movedRef.current = false; }}
                      style={{ cursor: 'pointer' }}>
                      <circle
                        cx={p.cx} cy={p.cy} r={p.r}
                        fill={isSelected ? 'hsla(142,60%,42%,0.45)' : 'hsla(142,60%,42%,0.22)'}
                        stroke={isSelected ? 'hsl(142,60%,55%)' : 'hsl(142,60%,38%)'}
                        strokeWidth={isSelected ? 1.8 : 0.9}
                      />
                      <text
                        x={p.cx}
                        y={p.cy > PAD.t + 18 ? p.cy - p.r - 3 : p.cy + p.r + 10}
                        textAnchor="middle" fontSize="7"
                        fontWeight={isSelected ? 'bold' : 'normal'}
                        fill={isSelected ? 'hsl(142,60%,70%)' : 'hsl(var(--muted-foreground))'}
                        fontFamily="'JetBrains Mono', monospace"
                        style={{ pointerEvents: 'none' }}
                      >
                        {p.team}
                      </text>
                    </g>
                  );
                })}
            </g>

            {/* Tooltip for selected bubble */}
            {selPt && (() => {
              const TW = 120, TH = 62;
              const tx = Math.min(Math.max(selPt.cx - TW / 2, PAD.l + 2), PAD.l + CW - TW - 2);
              const aboveOk = selPt.cy - selPt.r - TH - 10 >= PAD.t;
              const ty = aboveOk ? selPt.cy - selPt.r - TH - 10 : selPt.cy + selPt.r + 8;
              return (
                <g style={{ pointerEvents: 'none' }}>
                  <rect x={tx} y={ty} width={TW} height={TH} rx="5"
                    fill="hsl(var(--primary))" stroke="hsl(142,60%,38%)" strokeWidth="1" opacity="0.97" />
                  <text x={tx + 8} y={ty + 14} fontSize="10" fontWeight="bold"
                    fill="hsl(142,60%,60%)" fontFamily="'JetBrains Mono', monospace">Team {selPt.team}</text>
                  <text x={tx + 8} y={ty + 28} fontSize="8.5"
                    fill="hsl(var(--foreground))" fontFamily="system-ui, sans-serif">
                    {chart.lx}: {selPt.xRaw % 1 === 0 ? selPt.xRaw : selPt.xRaw.toFixed(1)}</text>
                  <text x={tx + 8} y={ty + 41} fontSize="8.5"
                    fill="hsl(var(--foreground))" fontFamily="system-ui, sans-serif">
                    {chart.ly}: {selPt.yRaw % 1 === 0 ? selPt.yRaw : selPt.yRaw.toFixed(1)}</text>
                  <text x={tx + 8} y={ty + 54} fontSize="8.5"
                    fill="hsl(var(--muted-foreground))" fontFamily="system-ui, sans-serif">
                    {chart.lr}: {selPt.rRaw % 1 === 0 ? selPt.rRaw : selPt.rRaw.toFixed(1)}</text>
                </g>
              );
            })()}
          </svg>
        </div>
      )}

      <div className="flex items-center gap-4 text-[10px] text-[hsl(var(--muted-foreground))] flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-[hsl(142,60%,42%,0.35)] border border-[hsl(142,60%,38%)]" />
          Bubble → {chart?.lr}
        </span>
        <span className="ml-auto">{chart?.points.length ?? 0} teams · scroll/pinch to zoom · drag to pan</span>
      </div>
    </div>
  );
}

// ── Pit data view ─────────────────────────────────────────────────────────────

function PitsView() {
  const { pits } = usePits();
  const [statusFilter, setStatus] = useState<'all' | 'scouted' | 'dibbed' | 'unclaimed'>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let list = [...pits];
    if (statusFilter !== 'all') list = list.filter((p) => p.status === statusFilter);
    if (search) list = list.filter((p) => String(p.teamNumber).startsWith(search));
    return list.sort((a, b) => a.teamNumber - b.teamNumber);
  }, [pits, statusFilter, search]);

  const counts = useMemo(() => ({
    scouted: pits.filter((p) => p.status === 'scouted').length,
    dibbed: pits.filter((p) => p.status === 'dibbed').length,
    unclaimed: pits.filter((p) => p.status === 'unclaimed').length,
  }), [pits]);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        {[
          { key: 'scouted', label: 'Scouted', count: counts.scouted, color: 'text-[hsl(var(--accent))]' },
          { key: 'dibbed',  label: 'Claimed',  count: counts.dibbed,   color: 'text-amber-400' },
          { key: 'unclaimed', label: 'Open',   count: counts.unclaimed, color: 'text-[hsl(var(--muted-foreground))]' },
        ].map(({ key, label, count, color }) => (
          <button key={key} type="button" onClick={() => setStatus(statusFilter === key ? 'all' : key as typeof statusFilter)}
            className={cn('rounded-xl border px-3 py-2 text-center cursor-pointer transition-colors',
              statusFilter === key ? 'border-[hsl(var(--accent))] bg-[hsl(var(--accent)/0.08)]' : 'border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] hover:border-[hsl(var(--accent)/0.4)]')}>
            <div className={cn('font-data text-xl font-bold', color)}>{count}</div>
            <div className="text-[10px] text-[hsl(var(--muted-foreground))]">{label}</div>
          </button>
        ))}
      </div>

      <div className="relative">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Team #…" type="number" inputMode="numeric"
          className="w-full h-9 pl-7 pr-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] text-sm font-data focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
      </div>

      <div className="rounded-xl border border-[hsl(var(--border))] overflow-hidden">
        <div className="grid grid-cols-[3rem_4rem_5rem_1fr] text-[9px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] px-3 py-2 bg-[hsl(var(--muted)/0.5)] border-b border-[hsl(var(--border))]">
          <span>Team</span><span>Loc</span><span>Status</span><span>Scout</span>
        </div>
        <div className="overflow-y-auto no-scrollbar" style={{ maxHeight: 'calc(100dvh - 22rem)' }}>
          {filtered.map((p) => (
            <div key={p.teamNumber} className="grid grid-cols-[3rem_4rem_5rem_1fr] items-center px-3 py-2 border-b border-[hsl(var(--border)/0.3)] last:border-0 text-[10px]">
              <span className="font-data font-bold">{p.teamNumber}</span>
              <span className="font-data text-[hsl(var(--muted-foreground))]">
                {String.fromCharCode(65 + p.row)}{p.col + 1}
              </span>
              <span className={cn('font-semibold',
                p.status === 'scouted' ? 'text-[hsl(var(--accent))]' :
                p.status === 'dibbed'  ? 'text-amber-400' : 'text-[hsl(var(--muted-foreground))]')}>
                {p.status === 'scouted' ? '✓ done' : p.status === 'dibbed' ? '⋯ claimed' : 'open'}
              </span>
              <span className="truncate text-[hsl(var(--muted-foreground))]">
                {p.status === 'scouted' ? (p.scoutedBy?.slice(5) ?? '—') :
                 p.status === 'dibbed'  ? (p.dibbedByName ?? '—') : '—'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type DataTab = 'entries' | 'teams' | 'pits' | 'graph';

export function DataManagement() {
  const [searchParams] = useSearchParams();
  const initialTeam = searchParams.get('team') ?? '';

  const { currentEvent } = useEventStore();
  const { matches, loading: matchLoading } = useMatches();
  const [tab, setTab] = useState<DataTab>(initialTeam ? 'teams' : 'teams');

  const gameYear = currentEvent?.activeGameYear ?? 2026;
  const game = getGameConfig(gameYear);
  const allFields = useMemo(() =>
    [...game.match.auto, ...game.match.teleop, ...game.match.endgame],
    [game]
  );

  const outlierIds = useMemo(() => {
    const ids = new Set<string>();
    for (const f of allFields.filter((f) => f.type === 'counter')) {
      for (const issue of findOutliers(matches, f.id, f.label)) {
        if (issue.matchId) ids.add(issue.matchId);
      }
    }
    return ids;
  }, [matches, allFields]);

  if (!currentEvent) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center p-6">
        <CalendarOff size={32} className="text-[hsl(var(--muted-foreground))]" />
        <p className="text-sm text-[hsl(var(--muted-foreground))]">No event selected.</p>
      </div>
    );
  }

  const tabs: { id: DataTab; label: string; icon?: ReactNode }[] = [
    { id: 'teams',   label: 'Teams'   },
    { id: 'entries', label: 'Entries' },
    { id: 'pits',    label: 'Pits'    },
    { id: 'graph',   label: 'Graph', icon: <Crosshair size={11} /> },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b border-[hsl(var(--border))] bg-[hsl(var(--primary))] shrink-0">
        <div className="flex-1 flex items-center px-4">
          <span className="font-[Orbitron] text-xs font-bold tracking-widest text-[hsl(var(--muted-foreground))]">DATA</span>
        </div>
        {tabs.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className={cn('flex items-center gap-1 px-4 py-3 text-xs font-medium transition-colors cursor-pointer',
              tab === t.id ? 'text-[hsl(var(--accent))] border-b-2 border-[hsl(var(--accent))]' : 'text-[hsl(var(--muted-foreground))]')}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0 p-4">
        {matchLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-[hsl(var(--accent))]" size={28} />
          </div>
        ) : (
          <div className="max-w-2xl mx-auto">
            {tab === 'teams'   && <TeamsView   matches={matches} allFields={allFields} outlierIds={outlierIds} initialTeam={initialTeam} />}
            {tab === 'entries' && <RawEntriesView matches={matches} allFields={allFields} outlierIds={outlierIds} initialTeam={initialTeam} />}
            {tab === 'pits'    && <PitsView />}
            {tab === 'graph'   && <ScatterView matches={matches} allFields={allFields} />}
          </div>
        )}
      </div>
    </div>
  );
}
