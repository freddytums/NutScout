import { useState, useMemo, useEffect, useRef, type DragEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search, X, ExternalLink, Loader2, Camera, BarChart3, Sliders,
  ChevronDown, ChevronRight, Eye, EyeOff, ArrowUp, ArrowDown,
  Trophy, Play, Filter, Users, ClipboardList, Download, GripVertical,
  Layers, RotateCcw, Pin, PinOff, Table2,
} from 'lucide-react';
import { HelpButton } from '@/components/ui/HelpButton';
import { useMatches } from '@/hooks/useMatches';
import { usePits } from '@/hooks/usePits';
import { useEventStore } from '@/store/eventStore';
import { useTBAStore } from '@/store/tbaStore';
import { getGameConfig } from '@/config/games';
import { buildMatchKey, getMatch, tbaMatchUrl } from '@/lib/tba';
import type { TBAMatch } from '@/lib/tba';
import type { MatchEntry, PitEntry } from '@/types/scout';
import type { GameField } from '@/types/game';
import { cn } from '@/lib/utils';

// ════════════════════════════════════════════════════════════════════════════
// SCORING
// ════════════════════════════════════════════════════════════════════════════

const ENDGAME_SELECT: Record<number, { fieldId: string; pts: Record<string, number> }> = {
  2025: { fieldId: 'endgame_climb', pts: { 'Deep Cage': 15, 'Shallow Cage': 6, Park: 2, None: 0 } },
  2026: { fieldId: 'endgame_tower_level', pts: { 'Level 3': 30, 'Level 2': 20, 'Level 1': 10, None: 0 } },
};

interface ScoreParts { auto: number; teleop: number; endgame: number; total: number }

function scoreMatch(entry: MatchEntry, fields: GameField[], year: number): ScoreParts {
  const eg = ENDGAME_SELECT[year] ?? ENDGAME_SELECT[2025];
  let auto = 0, teleop = 0, endgame = 0;
  for (const f of fields) {
    if (!f.pointsPerUnit) continue;
    const v = entry.data[f.id];
    const pts = f.type === 'counter' ? ((v as number || 0) * f.pointsPerUnit)
      : f.type === 'toggle' ? ((v ? 1 : 0) * f.pointsPerUnit)
      : f.type === 'select' && f.id === eg.fieldId ? (eg.pts[v as string] ?? 0)
      : 0;
    if (f.section === 'auto') auto += pts;
    else if (f.section === 'teleop') teleop += pts;
    else if (f.section === 'endgame') endgame += pts;
  }
  return { auto, teleop, endgame, total: auto + teleop + endgame };
}

// ════════════════════════════════════════════════════════════════════════════
// UNIFIED ROW + COLUMN MODEL
// ════════════════════════════════════════════════════════════════════════════
//
// Every observation (match scouting entry OR pit scouting entry) becomes one
// row in the Excel-style grid. Match columns and pit columns coexist; cells
// outside a row's "kind" are blank. This keeps the model honest and lets
// Excel-style filtering/sorting/grouping operate on a single table.

type RowKind = 'match' | 'pit';

interface UnifiedRow {
  id: string;
  kind: RowKind;
  teamNumber: number;
  matchNumber: number | null;
  alliance: 'red' | 'blue' | null;
  alliancePosition: 1 | 2 | 3 | null;
  scoutedByName: string;
  pitStatus: 'unclaimed' | 'dibbed' | 'scouted' | null;
  photoCount: number;
  score: ScoreParts | null;
  data: Record<string, unknown>;            // match.data OR pit.data
  source: MatchEntry | PitEntry;            // for modal lookups
}

type ColumnKind = 'meta' | 'score' | 'match-field' | 'pit-field';

interface Column {
  id: string;
  label: string;
  kind: ColumnKind;
  width: number;          // px
  numeric?: boolean;
  align?: 'left' | 'right';
  fieldType?: GameField['type'];
  defaultVisible?: boolean;
}

// Meta + score columns are always present. Field columns are derived from the
// active game config so adding new fields to a season automatically shows up.
function buildColumns(matchFields: GameField[], pitFields: GameField[]): Column[] {
  const meta: Column[] = [
    { id: 'kind',       label: 'Type',     kind: 'meta',  width: 60,  defaultVisible: true },
    { id: 'team',       label: 'Team',     kind: 'meta',  width: 64,  numeric: true, align: 'right', defaultVisible: true },
    { id: 'match',      label: 'Match',    kind: 'meta',  width: 56,  numeric: true, align: 'right', defaultVisible: true },
    { id: 'alliance',   label: 'Alliance', kind: 'meta',  width: 64,  defaultVisible: true },
    { id: 'position',   label: 'Pos',      kind: 'meta',  width: 44,  numeric: true, align: 'right', defaultVisible: false },
    { id: 'scout',      label: 'Scout',    kind: 'meta',  width: 110, defaultVisible: false },
    { id: 'status',     label: 'Status',   kind: 'meta',  width: 80,  defaultVisible: false },
    { id: 'photos',     label: 'Photos',   kind: 'meta',  width: 60,  numeric: true, align: 'right', defaultVisible: true },
  ];
  const score: Column[] = [
    { id: 'autoPts',    label: 'Auto',     kind: 'score', width: 56,  numeric: true, align: 'right', defaultVisible: true },
    { id: 'teleopPts',  label: 'Teleop',   kind: 'score', width: 60,  numeric: true, align: 'right', defaultVisible: true },
    { id: 'endgamePts', label: 'Endgame',  kind: 'score', width: 64,  numeric: true, align: 'right', defaultVisible: false },
    { id: 'totalPts',   label: 'Total',    kind: 'score', width: 60,  numeric: true, align: 'right', defaultVisible: true },
  ];
  const matchCols: Column[] = matchFields.map((f) => ({
    id: `m:${f.id}`,
    label: f.label,
    kind: 'match-field',
    width: f.type === 'textarea' || f.type === 'text' ? 180 : 88,
    numeric: f.type === 'counter' || f.type === 'rating',
    align: f.type === 'counter' || f.type === 'rating' ? 'right' : 'left',
    fieldType: f.type,
    defaultVisible: false,
  }));
  const pitCols: Column[] = pitFields.map((f) => ({
    id: `p:${f.id}`,
    label: f.label,
    kind: 'pit-field',
    width: f.type === 'textarea' || f.type === 'text' ? 200 : 100,
    numeric: f.type === 'counter' || f.type === 'rating',
    align: f.type === 'counter' || f.type === 'rating' ? 'right' : 'left',
    fieldType: f.type,
    defaultVisible: false,
  }));
  return [...meta, ...score, ...matchCols, ...pitCols];
}

function getCellValue(col: Column, row: UnifiedRow): string | number | boolean | null {
  switch (col.id) {
    case 'kind':       return row.kind;
    case 'team':       return row.teamNumber;
    case 'match':      return row.matchNumber ?? '';
    case 'alliance':   return row.alliance ?? '';
    case 'position':   return row.alliancePosition ?? '';
    case 'scout':      return row.scoutedByName;
    case 'status':     return row.pitStatus ?? '';
    case 'photos':     return row.photoCount;
    case 'autoPts':    return row.score?.auto ?? '';
    case 'teleopPts':  return row.score?.teleop ?? '';
    case 'endgamePts': return row.score?.endgame ?? '';
    case 'totalPts':   return row.score?.total ?? '';
    default: {
      // m:fieldId or p:fieldId
      if (col.id.startsWith('m:') && row.kind !== 'match') return '';
      if (col.id.startsWith('p:') && row.kind !== 'pit')   return '';
      const fid = col.id.slice(2);
      const v = row.data[fid];
      if (v === null || v === undefined) return '';
      if (typeof v === 'boolean') return v;
      if (Array.isArray(v)) return v.length;  // e.g. path coords array -> count
      return v as string | number;
    }
  }
}

// ════════════════════════════════════════════════════════════════════════════
// MATCH DETAIL MODAL  (TBA scores + winner + YouTube + external link)
// ════════════════════════════════════════════════════════════════════════════

interface MatchModalProps { matchNumber: number; eventKey: string; onClose: () => void }

function MatchDetailModal({ matchNumber, eventKey, onClose }: MatchModalProps) {
  const { matches: cachedMatches } = useTBAStore();
  const cached = useMemo(
    () => cachedMatches.find((m) => m.comp_level === 'qm' && m.match_number === matchNumber) ?? null,
    [cachedMatches, matchNumber]
  );
  const [tbaMatch, setTbaMatch] = useState<TBAMatch | null>(cached);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const matchKey = buildMatchKey(eventKey, matchNumber);

  useEffect(() => {
    const needsRefresh = !tbaMatch || (!tbaMatch.videos && tbaMatch.alliances?.red?.score == null);
    if (!needsRefresh) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setErr(null);
    getMatch(matchKey)
      .then((m) => { if (!cancelled) setTbaMatch(m); })
      .catch((e: unknown) => { if (!cancelled) setErr(e instanceof Error ? e.message : 'Failed to fetch match'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchKey]);

  const youtube = tbaMatch?.videos?.find((v) => v.type === 'youtube');
  const redScore = tbaMatch?.alliances?.red?.score ?? null;
  const blueScore = tbaMatch?.alliances?.blue?.score ?? null;
  const winner = tbaMatch?.winning_alliance;
  const hasResult = redScore !== null && blueScore !== null && redScore >= 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose} role="dialog" aria-modal="true">
      <div className="w-full max-w-2xl bg-[hsl(var(--primary))] border border-[hsl(var(--border))] rounded-xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--border))]">
          <div className="flex items-center gap-2">
            <span className="font-[Orbitron] font-bold text-sm tracking-wider">Q{matchNumber}</span>
            {loading && <Loader2 size={12} className="animate-spin text-[hsl(var(--muted-foreground))]" />}
          </div>
          <div className="flex items-center gap-2">
            <a href={tbaMatchUrl(matchKey)} target="_blank" rel="noopener noreferrer"
               className="flex items-center gap-1 px-2 h-7 rounded-md border border-[hsl(var(--border))] text-[10px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--accent))] hover:border-[hsl(var(--accent)/0.5)] transition-colors">
              <ExternalLink size={10} /> TBA
            </a>
            <button type="button" onClick={onClose} aria-label="Close"
                    className="w-7 h-7 rounded-md hover:bg-[hsl(var(--muted))] flex items-center justify-center text-[hsl(var(--muted-foreground))] cursor-pointer">
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {err && (
            <p className="text-xs text-[hsl(var(--destructive))] rounded-lg px-3 py-2 bg-[hsl(var(--destructive)/0.08)] border border-[hsl(var(--destructive)/0.3)]">{err}</p>
          )}

          {tbaMatch ? (
            <div className="grid grid-cols-2 gap-2">
              {(['red', 'blue'] as const).map((side) => {
                const teams = tbaMatch.alliances[side].team_keys.map((k) => k.replace('frc', ''));
                const score = side === 'red' ? redScore : blueScore;
                const isWinner = hasResult && winner === side;
                return (
                  <div key={side}
                       className={cn('rounded-xl border p-3 flex flex-col gap-2',
                         side === 'red' ? 'border-red-500/40 bg-red-500/10' : 'border-blue-500/40 bg-blue-500/10',
                         isWinner && 'ring-2 ring-[hsl(var(--accent))] glow-green')}>
                    <div className="flex items-center justify-between">
                      <span className={cn('text-[10px] font-bold uppercase tracking-widest', side === 'red' ? 'text-red-400' : 'text-blue-400')}>{side}</span>
                      {isWinner && <Trophy size={12} className="text-[hsl(var(--accent))]" />}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col gap-0.5">
                        {teams.map((t) => (<span key={t} className="font-data text-sm font-bold">{t}</span>))}
                      </div>
                      <span className={cn('font-data text-2xl font-black', isWinner ? 'text-[hsl(var(--accent))]' : 'text-[hsl(var(--foreground))]')}>{score ?? '—'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : !loading && !err ? (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Match data not found.</p>
          ) : null}

          {youtube && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-[hsl(var(--muted-foreground))] font-semibold">
                <Play size={10} /> Match video
              </div>
              <div className="relative w-full rounded-lg overflow-hidden border border-[hsl(var(--border))] bg-black" style={{ paddingTop: '56.25%' }}>
                <iframe className="absolute inset-0 w-full h-full"
                        src={`https://www.youtube.com/embed/${youtube.key}`}
                        title={`Q${matchNumber} match video`}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen />
              </div>
            </div>
          )}
          {tbaMatch && !youtube && !loading && (
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] italic">No video posted yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// PHOTOS MODAL
// ════════════════════════════════════════════════════════════════════════════

function TeamPhotosModal({ pit, onClose }: { pit: PitEntry; onClose: () => void }) {
  const [idx, setIdx] = useState(0);
  const photos = pit.photos ?? [];

  if (photos.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-[hsl(var(--primary))] rounded-xl border border-[hsl(var(--border))] p-6 flex flex-col items-center gap-2 max-w-xs">
          <Camera size={28} className="text-[hsl(var(--muted-foreground))]" />
          <p className="text-sm font-medium">No photos for Team {pit.teamNumber}</p>
          <button type="button" onClick={onClose} className="text-xs text-[hsl(var(--accent))] hover:underline mt-2 cursor-pointer">Close</button>
        </div>
      </div>
    );
  }

  const photo = photos[idx];

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose} role="dialog" aria-modal="true">
      <button type="button" onClick={(e) => { e.stopPropagation(); onClose(); }} aria-label="Close"
              className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/70 hover:bg-[hsl(var(--destructive))] text-white flex items-center justify-center cursor-pointer transition-colors">
        <X size={18} />
      </button>
      <div className="flex flex-col items-center gap-3 max-w-[92vw] max-h-[92vh]" onClick={(e) => e.stopPropagation()}>
        <img src={photo.url} alt={photo.caption || `Team ${pit.teamNumber} photo`} className="max-w-full max-h-[72vh] object-contain rounded-lg" />
        <div className="text-center">
          <div className="font-data text-sm font-bold text-white">Team {pit.teamNumber}</div>
          {photo.caption && <div className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{photo.caption}</div>}
        </div>
        {photos.length > 1 && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setIdx((idx - 1 + photos.length) % photos.length)} className="h-8 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs cursor-pointer transition-colors">← Prev</button>
            <span className="text-xs font-data text-[hsl(var(--muted-foreground))]">{idx + 1} / {photos.length}</span>
            <button type="button" onClick={() => setIdx((idx + 1) % photos.length)} className="h-8 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs cursor-pointer transition-colors">Next →</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// CHARTS (collapsible)
// ════════════════════════════════════════════════════════════════════════════

function TeamAverageChart({ matches, fields, year }: { matches: MatchEntry[]; fields: GameField[]; year: number }) {
  const data = useMemo(() => {
    const byTeam = new Map<number, ScoreParts[]>();
    matches.forEach((m) => {
      const sc = scoreMatch(m, fields, year);
      if (!byTeam.has(m.teamNumber)) byTeam.set(m.teamNumber, []);
      byTeam.get(m.teamNumber)!.push(sc);
    });
    return [...byTeam.entries()].map(([team, scores]) => {
      const n = scores.length;
      const auto    = scores.reduce((a, s) => a + s.auto, 0) / n;
      const teleop  = scores.reduce((a, s) => a + s.teleop, 0) / n;
      const endgame = scores.reduce((a, s) => a + s.endgame, 0) / n;
      return { team, auto, teleop, endgame, total: auto + teleop + endgame, n };
    }).sort((a, b) => b.total - a.total);
  }, [matches, fields, year]);

  if (data.length === 0) return <p className="text-xs text-[hsl(var(--muted-foreground))] py-6 text-center">No match data to chart yet.</p>;
  const max = Math.max(...data.map((d) => d.total), 1);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-3 text-[10px] text-[hsl(var(--muted-foreground))]">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-400 inline-block" /> Auto</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[hsl(var(--accent))] inline-block" /> Teleop</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-purple-400 inline-block" /> Endgame</span>
      </div>
      <div className="flex flex-col gap-1 max-h-80 overflow-y-auto pr-1">
        {data.map((d) => (
          <div key={d.team} className="grid items-center gap-2" style={{ gridTemplateColumns: '3.5rem 1fr 4rem 2.5rem' }}>
            <span className="font-data text-xs font-bold text-right">{d.team}</span>
            <div className="h-4 rounded-md bg-[hsl(var(--muted)/0.5)] overflow-hidden flex">
              <div className="bg-amber-400/80" style={{ width: `${(d.auto / max) * 100}%` }} title={`Auto ${d.auto.toFixed(1)}`} />
              <div className="bg-[hsl(var(--accent)/0.85)]" style={{ width: `${(d.teleop / max) * 100}%` }} title={`Teleop ${d.teleop.toFixed(1)}`} />
              <div className="bg-purple-400/80" style={{ width: `${(d.endgame / max) * 100}%` }} title={`Endgame ${d.endgame.toFixed(1)}`} />
            </div>
            <span className="font-data text-xs font-semibold text-[hsl(var(--accent))]">{d.total.toFixed(1)}</span>
            <span className="text-[10px] text-[hsl(var(--muted-foreground))] font-data">{d.n}m</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════════════

type GroupDim = 'none' | 'team' | 'match' | 'alliance' | 'kind' | 'scout';
type SourceFilter = 'all' | 'match' | 'pit';

const GROUP_LABELS: Record<GroupDim, string> = {
  none: 'None', team: 'Team', match: 'Match', alliance: 'Alliance', kind: 'Type', scout: 'Scout',
};

export function DataViewer() {
  const [params] = useSearchParams();
  const { currentEvent } = useEventStore();
  const { matches, loading: matchLoading } = useMatches();
  const { pits } = usePits();

  const year = currentEvent?.activeGameYear ?? 2025;
  const game = useMemo(() => { try { return getGameConfig(year); } catch { return null; } }, [year]);

  const matchFields = useMemo(
    () => game ? [...game.match.auto, ...game.match.teleop, ...game.match.endgame] : [],
    [game]
  );
  const pitFields = useMemo(() => game ? game.pit : [], [game]);
  const columns = useMemo(() => buildColumns(matchFields, pitFields), [matchFields, pitFields]);

  // ── Unified rows ────────────────────────────────────────────────────────────
  const allRows = useMemo<UnifiedRow[]>(() => {
    const rows: UnifiedRow[] = [];
    const pitByTeam = new Map<number, PitEntry>();
    pits.forEach((p) => pitByTeam.set(p.teamNumber, p));

    matches.forEach((m) => {
      rows.push({
        id: `m:${m.id ?? `${m.matchNumber}-${m.teamNumber}-${m.alliance}-${m.alliancePosition}`}`,
        kind: 'match',
        teamNumber: m.teamNumber,
        matchNumber: m.matchNumber,
        alliance: m.alliance,
        alliancePosition: m.alliancePosition,
        scoutedByName: m.scoutedByName,
        pitStatus: null,
        photoCount: pitByTeam.get(m.teamNumber)?.photos?.length ?? 0,
        score: scoreMatch(m, matchFields, year),
        data: m.data,
        source: m,
      });
    });
    pits.forEach((p) => {
      if (p.status === 'unclaimed' && !p.data) return; // skip placeholder pit cells
      rows.push({
        id: `p:${p.teamNumber}`,
        kind: 'pit',
        teamNumber: p.teamNumber,
        matchNumber: null,
        alliance: null,
        alliancePosition: null,
        scoutedByName: '',
        pitStatus: p.status,
        photoCount: p.photos?.length ?? 0,
        score: null,
        data: p.data ?? {},
        source: p,
      });
    });
    return rows;
  }, [matches, pits, matchFields, year]);

  // Quick lookup for pit photos modal
  const pitByTeam = useMemo(() => {
    const m = new Map<number, PitEntry>();
    pits.forEach((p) => m.set(p.teamNumber, p));
    return m;
  }, [pits]);

  // ── Layout / column state (persisted in localStorage) ───────────────────────
  const initialTeam = params.get('team');
  const [columnOrder, setColumnOrder] = useState<string[]>(() => loadOrder() ?? columns.map((c) => c.id));
  const [visibleCols, setVisibleCols]   = useState<Set<string>>(() => loadVisible() ?? new Set(columns.filter((c) => c.defaultVisible).map((c) => c.id)));
  const [pinnedCount, setPinnedCount]   = useState<number>(() => loadPinned() ?? 2); // pin kind+team by default
  const [source, setSource]             = useState<SourceFilter>('all');
  const [groupBy, setGroupBy]           = useState<GroupDim>('none');
  const [sortKey, setSortKey]           = useState<string>('team');
  const [sortDir, setSortDir]           = useState<'asc' | 'desc'>('asc');
  const [search, setSearch]             = useState('');
  const [selectedTeams, setSelectedTeams] = useState<Set<number>>(
    () => initialTeam ? new Set([parseInt(initialTeam)]) : new Set()
  );
  const [allianceFilter, setAllianceFilter] = useState<'all' | 'red' | 'blue'>('all');
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [showTeamPicker, setShowTeamPicker]     = useState(false);
  const [showCharts, setShowCharts]             = useState(false);
  const [collapsedGroups, setCollapsedGroups]   = useState<Set<string>>(new Set());

  // When the column set changes (e.g. event year switch adds fields), append
  // unknown columns to the order so they're available in the picker.
  useEffect(() => {
    const knownIds = new Set(columnOrder);
    const missing = columns.map((c) => c.id).filter((id) => !knownIds.has(id));
    if (missing.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setColumnOrder((prev) => [...prev, ...missing]);
    }
    // Drop stale order entries that no longer exist in the column set
    const validIds = new Set(columns.map((c) => c.id));
    if (columnOrder.some((id) => !validIds.has(id))) {
      setColumnOrder((prev) => prev.filter((id) => validIds.has(id)));
    }
  }, [columns, columnOrder]);

  // Persist column prefs
  useEffect(() => { saveOrder(columnOrder);     }, [columnOrder]);
  useEffect(() => { saveVisible(visibleCols);   }, [visibleCols]);
  useEffect(() => { savePinned(pinnedCount);    }, [pinnedCount]);

  // Modals
  const [matchModal, setMatchModal] = useState<number | null>(null);
  const [photoModal, setPhotoModal] = useState<PitEntry | null>(null);

  // ── Derived: filtered + sorted rows ────────────────────────────────────────
  const colById = useMemo(() => new Map(columns.map((c) => [c.id, c])), [columns]);

  const filteredRows = useMemo(() => {
    return allRows.filter((r) => {
      if (source !== 'all' && r.kind !== source) return false;
      if (selectedTeams.size > 0 && !selectedTeams.has(r.teamNumber)) return false;
      if (allianceFilter !== 'all' && r.kind === 'match' && r.alliance !== allianceFilter) return false;
      if (allianceFilter !== 'all' && r.kind === 'pit') return false; // pits aren't per-alliance
      if (search) {
        const q = search.toLowerCase();
        const hit =
          String(r.teamNumber).includes(q) ||
          String(r.matchNumber ?? '').includes(q) ||
          r.scoutedByName.toLowerCase().includes(q) ||
          (r.pitStatus ?? '').includes(q) ||
          r.kind.includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [allRows, source, selectedTeams, allianceFilter, search]);

  const sortedRows = useMemo(() => {
    const col = colById.get(sortKey);
    if (!col) return filteredRows;
    return [...filteredRows].sort((a, b) => {
      const va = getCellValue(col, a);
      const vb = getCellValue(col, b);
      const cmp = (typeof va === 'number' && typeof vb === 'number')
        ? va - vb
        : String(va).localeCompare(String(vb), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filteredRows, sortKey, sortDir, colById]);

  // ── Grouping ───────────────────────────────────────────────────────────────
  const grouped = useMemo(() => {
    if (groupBy === 'none') return null;
    const map = new Map<string, UnifiedRow[]>();
    sortedRows.forEach((r) => {
      let key: string;
      switch (groupBy) {
        case 'team':     key = String(r.teamNumber); break;
        case 'match':    key = r.matchNumber !== null ? `Q${r.matchNumber}` : '— (pit)'; break;
        case 'alliance': key = r.alliance ?? '— (pit)'; break;
        case 'kind':     key = r.kind; break;
        case 'scout':    key = r.scoutedByName || '—'; break;
        default:         key = '—';
      }
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    });
    const arr = [...map.entries()].map(([key, rows]) => {
      const matches = rows.filter((r) => r.kind === 'match');
      const totalScores = matches.map((r) => r.score?.total ?? 0);
      const avg = totalScores.length ? totalScores.reduce((a, b) => a + b, 0) / totalScores.length : null;
      return { key, rows, matchCount: matches.length, pitCount: rows.length - matches.length, avgTotal: avg };
    });
    // Sort groups: numeric keys naturally, else lexicographically
    return arr.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));
  }, [sortedRows, groupBy]);

  // ── Visible / pinned columns ───────────────────────────────────────────────
  const orderedVisible = useMemo(
    () => columnOrder.map((id) => colById.get(id)).filter((c): c is Column => !!c && visibleCols.has(c.id)),
    [columnOrder, visibleCols, colById]
  );
  const pinned = orderedVisible.slice(0, Math.min(pinnedCount, orderedVisible.length));

  // Cumulative left offsets for pinned columns
  const pinnedLefts: number[] = [];
  { let acc = 0; for (const c of pinned) { pinnedLefts.push(acc); acc += c.width; } }
  const pinnedTotalWidth = pinned.reduce((a, c) => a + c.width, 0);
  const totalWidth = orderedVisible.reduce((a, c) => a + c.width, 0);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const allTeams = useMemo(() => {
    const s = new Set<number>();
    matches.forEach((m) => s.add(m.teamNumber));
    pits.forEach((p) => s.add(p.teamNumber));
    return [...s].sort((a, b) => a - b);
  }, [matches, pits]);

  function toggleSort(colId: string) {
    if (sortKey === colId) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(colId); setSortDir(colById.get(colId)?.numeric ? 'desc' : 'asc'); }
  }
  function toggleCol(id: string) {
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleTeam(t: number) {
    setSelectedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t); else next.add(t);
      return next;
    });
  }
  function toggleGroupCollapse(key: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }
  function resetView() {
    setColumnOrder(columns.map((c) => c.id));
    setVisibleCols(new Set(columns.filter((c) => c.defaultVisible).map((c) => c.id)));
    setPinnedCount(2);
    setSource('all');
    setGroupBy('none');
    setSortKey('team');
    setSortDir('asc');
    setSearch('');
    setSelectedTeams(new Set());
    setAllianceFilter('all');
    setCollapsedGroups(new Set());
  }
  function exportCsv() {
    const cols = orderedVisible;
    const header = cols.map((c) => `"${c.label}"`).join(',');
    const lines = [header];
    sortedRows.forEach((r) => {
      lines.push(cols.map((c) => {
        const v = getCellValue(c, r);
        return `"${String(v).replace(/"/g, '""')}"`;
      }).join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nutscout-${currentEvent?.eventKey ?? 'data'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Drag-to-reorder columns ────────────────────────────────────────────────
  const dragColRef = useRef<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  function onDragStart(e: DragEvent<HTMLDivElement>, colId: string) {
    dragColRef.current = colId;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', colId);
  }
  function onDragOver(e: DragEvent<HTMLDivElement>, colId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragColRef.current && dragColRef.current !== colId) setDragOverCol(colId);
  }
  function onDragLeave() { setDragOverCol(null); }
  function onDrop(e: DragEvent<HTMLDivElement>, targetId: string) {
    e.preventDefault();
    const fromId = dragColRef.current;
    dragColRef.current = null;
    setDragOverCol(null);
    if (!fromId || fromId === targetId) return;
    setColumnOrder((prev) => {
      const next = [...prev];
      const fromIdx = next.indexOf(fromId);
      const toIdx = next.indexOf(targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, fromId);
      return next;
    });
  }

  if (!currentEvent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 p-6 text-center">
        <BarChart3 size={32} className="text-[hsl(var(--muted-foreground))]" />
        <p className="text-sm text-[hsl(var(--muted-foreground))]">No event selected.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-2 sm:p-3 max-w-[100rem] mx-auto">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 flex-wrap px-1">
        <div className="flex items-center gap-2">
          <Table2 size={16} className="text-[hsl(var(--accent))]" />
          <h2 className="text-sm font-semibold tracking-wide">Data Viewer</h2>
          <span className="text-[10px] font-data text-[hsl(var(--muted-foreground))]">{currentEvent.eventKey}</span>
          <HelpButton content={{
            title: 'Data Viewer',
            description: 'An Excel-style spreadsheet of every scouting observation — match entries and pit entries together in one table. Read-only.',
            steps: [
              { heading: 'Source', detail: 'Filter to All / Matches / Pits. "All" shows every entry; empty cells mean the field doesn\'t apply to that row.' },
              { heading: 'Group by', detail: 'Pivot the table — group rows by Team, Match, Alliance, Type, or Scout. Group headers show counts and average score.' },
              { heading: 'Columns', detail: 'Click "Columns" to show/hide fields. Drag column headers to reorder. The first N columns stay frozen — adjust with the pin counter.' },
              { heading: 'Click a Match cell', detail: 'Opens the TBA match modal with red/blue scores, winner, and embedded video.' },
              { heading: 'Click a Team cell', detail: 'Opens that team\'s pit photos.' },
            ],
            tip: 'Column layout, visibility, and pin count are remembered across sessions.',
          }} />
        </div>
        <div className="flex items-center gap-2 text-[10px] text-[hsl(var(--muted-foreground))] font-data">
          <span><ClipboardList size={9} className="inline mr-0.5" />{matches.length} matches</span>
          <span><Camera size={9} className="inline mr-0.5" />{pits.filter((p) => p.status === 'scouted').length} pits</span>
          <span><Users size={9} className="inline mr-0.5" />{allTeams.length} teams</span>
        </div>
      </div>

      {/* ─── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.25)] p-2 flex flex-wrap items-center gap-2 sticky top-0 z-30 backdrop-blur-md">
        {/* Source toggle */}
        <div className="flex items-center rounded-md border border-[hsl(var(--border))] overflow-hidden">
          {(['all', 'match', 'pit'] as SourceFilter[]).map((s) => (
            <button key={s} type="button" onClick={() => setSource(s)}
                    className={cn(
                      'px-2 h-7 text-[10px] font-semibold uppercase tracking-wider transition-colors cursor-pointer border-l border-[hsl(var(--border))] first:border-l-0',
                      source === s ? 'bg-[hsl(var(--accent))] text-black' : 'bg-[hsl(var(--primary))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                    )}>
              {s}
            </button>
          ))}
        </div>

        {/* Group by */}
        <div className="flex items-center gap-1.5">
          <Layers size={11} className="text-[hsl(var(--muted-foreground))]" />
          <span className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] font-semibold">Group</span>
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupDim)}
                  className="h-7 px-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--primary))] text-[11px] cursor-pointer focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]">
            {(['none', 'team', 'match', 'alliance', 'kind', 'scout'] as GroupDim[]).map((g) => (
              <option key={g} value={g}>{GROUP_LABELS[g]}</option>
            ))}
          </select>
          {groupBy !== 'none' && (
            <button type="button" onClick={() => setGroupBy('none')} aria-label="Clear grouping"
                    className="px-2 h-7 rounded-md border border-[hsl(var(--accent)/0.4)] bg-[hsl(var(--accent)/0.1)] text-[10px] text-[hsl(var(--accent))] flex items-center gap-1 cursor-pointer hover:bg-[hsl(var(--accent)/0.2)] transition-colors">
              {GROUP_LABELS[groupBy]} <X size={10} />
            </button>
          )}
        </div>

        {/* Columns */}
        <button type="button" onClick={() => setShowColumnPicker((v) => !v)}
                className={cn(
                  'flex items-center gap-1 h-7 px-2 rounded-md border text-[10px] uppercase tracking-wider font-semibold cursor-pointer transition-colors',
                  showColumnPicker
                    ? 'border-[hsl(var(--accent))] bg-[hsl(var(--accent)/0.1)] text-[hsl(var(--accent))]'
                    : 'border-[hsl(var(--border))] bg-[hsl(var(--primary))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                )}>
          <Sliders size={11} /> Columns ({orderedVisible.length}/{columns.length})
        </button>

        {/* Pin counter */}
        <div className="flex items-center gap-1 h-7 px-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--primary))] text-[10px]">
          <Pin size={10} className="text-[hsl(var(--muted-foreground))]" />
          <span className="uppercase tracking-wider text-[hsl(var(--muted-foreground))] font-semibold">Frozen</span>
          <button type="button" onClick={() => setPinnedCount((n) => Math.max(0, n - 1))} aria-label="Unfreeze a column"
                  className="w-4 h-4 rounded hover:bg-[hsl(var(--muted))] flex items-center justify-center cursor-pointer disabled:opacity-30">−</button>
          <span className="font-data font-semibold w-4 text-center">{pinnedCount}</span>
          <button type="button" onClick={() => setPinnedCount((n) => Math.min(orderedVisible.length, n + 1))} aria-label="Freeze another column"
                  className="w-4 h-4 rounded hover:bg-[hsl(var(--muted))] flex items-center justify-center cursor-pointer">+</button>
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-[280px]">
          <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search team, match, scout…"
                 className="w-full h-7 pl-6 pr-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--primary))] text-[11px] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]" />
        </div>

        {/* Alliance */}
        <div className="flex items-center rounded-md border border-[hsl(var(--border))] overflow-hidden">
          {(['all', 'red', 'blue'] as const).map((a) => (
            <button key={a} type="button" onClick={() => setAllianceFilter(a)}
                    className={cn(
                      'px-2 h-7 text-[10px] uppercase tracking-wider font-semibold transition-colors cursor-pointer border-l border-[hsl(var(--border))] first:border-l-0',
                      allianceFilter === a
                        ? a === 'red' ? 'bg-red-500/20 text-red-300'
                          : a === 'blue' ? 'bg-blue-500/20 text-blue-300'
                          : 'bg-[hsl(var(--accent))] text-black'
                        : 'bg-[hsl(var(--primary))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                    )}>
              {a}
            </button>
          ))}
        </div>

        {/* Teams */}
        <button type="button" onClick={() => setShowTeamPicker((v) => !v)}
                className={cn(
                  'flex items-center gap-1 h-7 px-2 rounded-md border text-[10px] uppercase tracking-wider font-semibold cursor-pointer transition-colors',
                  selectedTeams.size > 0 || showTeamPicker
                    ? 'border-[hsl(var(--accent))] bg-[hsl(var(--accent)/0.1)] text-[hsl(var(--accent))]'
                    : 'border-[hsl(var(--border))] bg-[hsl(var(--primary))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                )}>
          <Filter size={11} /> Teams {selectedTeams.size > 0 && `(${selectedTeams.size})`}
        </button>

        <div className="flex-1" />

        {/* Charts toggle */}
        <button type="button" onClick={() => setShowCharts((v) => !v)}
                className={cn(
                  'flex items-center gap-1 h-7 px-2 rounded-md border text-[10px] uppercase tracking-wider font-semibold cursor-pointer transition-colors',
                  showCharts
                    ? 'border-[hsl(var(--accent))] bg-[hsl(var(--accent)/0.1)] text-[hsl(var(--accent))]'
                    : 'border-[hsl(var(--border))] bg-[hsl(var(--primary))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                )}>
          <BarChart3 size={11} /> Charts
        </button>

        {/* Reset */}
        <button type="button" onClick={resetView}
                className="flex items-center gap-1 h-7 px-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--primary))] text-[10px] uppercase tracking-wider font-semibold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] cursor-pointer transition-colors">
          <RotateCcw size={11} /> Reset
        </button>

        {/* CSV */}
        <button type="button" onClick={exportCsv} disabled={sortedRows.length === 0}
                className="flex items-center gap-1 h-7 px-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--primary))] text-[10px] uppercase tracking-wider font-semibold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--accent))] hover:border-[hsl(var(--accent)/0.4)] cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-default">
          <Download size={11} /> CSV
        </button>
      </div>

      {/* ─── Column picker drawer ────────────────────────────────────────── */}
      {showColumnPicker && (
        <div className="rounded-lg border border-[hsl(var(--accent)/0.4)] bg-[hsl(var(--muted)/0.3)] p-2 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest font-semibold text-[hsl(var(--accent))]">Show columns</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setVisibleCols(new Set(columns.map((c) => c.id)))}
                      className="text-[10px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] cursor-pointer">All</button>
              <button type="button" onClick={() => setVisibleCols(new Set(columns.filter((c) => c.defaultVisible).map((c) => c.id)))}
                      className="text-[10px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] cursor-pointer">Default</button>
              <button type="button" onClick={() => setShowColumnPicker(false)} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] cursor-pointer">
                <X size={12} />
              </button>
            </div>
          </div>
          <ColumnPickerGrouped columns={columns} visibleCols={visibleCols} toggleCol={toggleCol} />
        </div>
      )}

      {/* ─── Team picker drawer ──────────────────────────────────────────── */}
      {showTeamPicker && (
        <div className="rounded-lg border border-[hsl(var(--accent)/0.4)] bg-[hsl(var(--muted)/0.3)] p-2 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest font-semibold text-[hsl(var(--accent))]">Filter teams ({selectedTeams.size}/{allTeams.length})</span>
            <div className="flex items-center gap-2">
              {selectedTeams.size > 0 && (
                <button type="button" onClick={() => setSelectedTeams(new Set())}
                        className="text-[10px] text-[hsl(var(--accent))] hover:underline cursor-pointer">Clear</button>
              )}
              <button type="button" onClick={() => setShowTeamPicker(false)} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] cursor-pointer">
                <X size={12} />
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
            {allTeams.map((t) => {
              const on = selectedTeams.has(t);
              return (
                <button key={t} type="button" onClick={() => toggleTeam(t)}
                        className={cn('font-data text-[10px] px-2 h-6 rounded-md border cursor-pointer transition-colors',
                          on ? 'border-[hsl(var(--accent))] bg-[hsl(var(--accent)/0.15)] text-[hsl(var(--accent))]'
                             : 'border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.4)] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                        )}>
                  {t}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Charts ─────────────────────────────────────────────────────── */}
      {showCharts && (
        <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.2)] p-3 flex flex-col gap-2">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-[hsl(var(--muted-foreground))]">
            Average score per team {selectedTeams.size > 0 ? `(${selectedTeams.size} filtered)` : '(all teams)'}
          </div>
          <TeamAverageChart
            matches={selectedTeams.size > 0 ? matches.filter((m) => selectedTeams.has(m.teamNumber)) : matches}
            fields={matchFields}
            year={year}
          />
        </div>
      )}

      {/* ═══════ THE SPREADSHEET ═══════════════════════════════════════════ */}
      <div className="rounded-lg border border-[hsl(var(--border))] overflow-hidden bg-[hsl(var(--primary))]">
        {/* Status bar */}
        <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.5)] text-[10px]">
          <span className="font-data text-[hsl(var(--muted-foreground))]">
            <span className="text-[hsl(var(--foreground))] font-semibold">{sortedRows.length}</span> row{sortedRows.length !== 1 ? 's' : ''}
            {sortedRows.length !== allRows.length && <span> · {allRows.length} total</span>}
            {grouped && <span> · {grouped.length} groups</span>}
            {' · '}<span className="text-[hsl(var(--foreground))]">{orderedVisible.length}</span> cols
          </span>
          <span className="font-data text-[hsl(var(--muted-foreground))] flex items-center gap-2">
            {pinnedCount > 0 && <span className="flex items-center gap-1"><Pin size={9} /> {pinnedCount} frozen</span>}
            {pinnedCount === 0 && <span className="flex items-center gap-1 opacity-50"><PinOff size={9} /> none frozen</span>}
            <span>· sort: <span className="text-[hsl(var(--foreground))]">{colById.get(sortKey)?.label ?? sortKey}</span> {sortDir === 'asc' ? '↑' : '↓'}</span>
          </span>
        </div>

        {matchLoading ? (
          <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-[hsl(var(--accent))]" /></div>
        ) : sortedRows.length === 0 ? (
          <p className="text-xs text-[hsl(var(--muted-foreground))] py-12 text-center">No entries match your filters.</p>
        ) : (
          <div className="overflow-auto max-h-[calc(100dvh-16rem)] no-scrollbar-x" style={{ scrollbarGutter: 'stable' }}>
            <div style={{ width: totalWidth, minWidth: '100%' }}>
              {/* Header row */}
              <div className="flex sticky top-0 z-20 bg-[hsl(var(--muted))] border-b border-[hsl(var(--border))]" style={{ width: totalWidth }}>
                {orderedVisible.map((c, idx) => {
                  const isPinned = idx < pinnedCount;
                  const isSortKey = sortKey === c.id;
                  const isDragOver = dragOverCol === c.id;
                  return (
                    <div
                      key={c.id}
                      draggable
                      onDragStart={(e) => onDragStart(e, c.id)}
                      onDragOver={(e) => onDragOver(e, c.id)}
                      onDragLeave={onDragLeave}
                      onDrop={(e) => onDrop(e, c.id)}
                      className={cn(
                        'group flex items-center gap-1 px-1.5 py-1.5 border-r border-[hsl(var(--border)/0.6)] last:border-r-0 cursor-grab active:cursor-grabbing select-none text-[9px] uppercase tracking-wider font-semibold transition-colors',
                        isSortKey ? 'text-[hsl(var(--accent))] bg-[hsl(var(--accent)/0.08)]' : 'text-[hsl(var(--muted-foreground))]',
                        isPinned && 'bg-[hsl(var(--muted))]',
                        isDragOver && 'ring-2 ring-inset ring-[hsl(var(--accent))]',
                      )}
                      style={{
                        width: c.width, minWidth: c.width, flexShrink: 0,
                        ...(isPinned ? { position: 'sticky', left: pinnedLefts[idx], zIndex: 22, background: 'hsl(var(--muted))', boxShadow: idx === pinnedCount - 1 ? '2px 0 4px hsl(0 0% 0% / 0.4)' : undefined } : {}),
                      }}
                      title={`${c.label} — drag to reorder, click to sort`}
                    >
                      <GripVertical size={9} className="text-[hsl(var(--muted-foreground)/0.5)] opacity-40 group-hover:opacity-100 transition-opacity shrink-0" />
                      <button type="button" onClick={() => toggleSort(c.id)}
                              className={cn('flex-1 min-w-0 flex items-center gap-1 truncate cursor-pointer',
                                c.align === 'right' && 'justify-end')}>
                        <span className="truncate" title={c.label}>{c.label}</span>
                        {isSortKey && (sortDir === 'asc' ? <ArrowUp size={9} className="shrink-0" /> : <ArrowDown size={9} className="shrink-0" />)}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Body */}
              {grouped ? (
                grouped.map((g) => {
                  const isCollapsed = collapsedGroups.has(g.key);
                  return (
                    <div key={g.key}>
                      {/* Group header row spans full width */}
                      <div
                        className="sticky z-10 flex items-center gap-2 px-2 py-1 bg-[hsl(var(--accent)/0.08)] border-b border-[hsl(var(--accent)/0.3)] text-[10px] cursor-pointer hover:bg-[hsl(var(--accent)/0.14)] transition-colors"
                        style={{ width: totalWidth, top: 30 }}
                        onClick={() => toggleGroupCollapse(g.key)}
                      >
                        <span style={{ position: 'sticky', left: 0 }} className="flex items-center gap-2">
                          {isCollapsed ? <ChevronRight size={11} className="text-[hsl(var(--accent))]" /> : <ChevronDown size={11} className="text-[hsl(var(--accent))]" />}
                          <span className="text-[9px] uppercase tracking-widest text-[hsl(var(--accent))] font-semibold">{GROUP_LABELS[groupBy]}</span>
                          <span className="font-data font-bold text-[hsl(var(--foreground))]">{g.key}</span>
                          <span className="font-data text-[hsl(var(--muted-foreground))]">{g.rows.length} row{g.rows.length !== 1 ? 's' : ''}</span>
                          {g.matchCount > 0 && (
                            <span className="font-data text-[hsl(var(--muted-foreground))]">
                              · {g.matchCount} match{g.matchCount !== 1 ? 'es' : ''}
                              {g.avgTotal !== null && <span className="text-[hsl(var(--accent))] font-semibold"> · avg {g.avgTotal.toFixed(1)} pts</span>}
                            </span>
                          )}
                          {g.pitCount > 0 && <span className="font-data text-[hsl(var(--muted-foreground))]">· {g.pitCount} pit</span>}
                        </span>
                      </div>

                      {!isCollapsed && g.rows.map((r) => (
                        <DataRow
                          key={r.id}
                          row={r}
                          columns={orderedVisible}
                          pinnedCount={pinnedCount}
                          pinnedLefts={pinnedLefts}
                          totalWidth={totalWidth}
                          onMatchClick={(m) => setMatchModal(m)}
                          onTeamClick={(t) => { const p = pitByTeam.get(t); if (p) setPhotoModal(p); }}
                        />
                      ))}
                    </div>
                  );
                })
              ) : (
                sortedRows.map((r) => (
                  <DataRow
                    key={r.id}
                    row={r}
                    columns={orderedVisible}
                    pinnedCount={pinnedCount}
                    pinnedLefts={pinnedLefts}
                    totalWidth={totalWidth}
                    onMatchClick={(m) => setMatchModal(m)}
                    onTeamClick={(t) => { const p = pitByTeam.get(t); if (p) setPhotoModal(p); }}
                  />
                ))
              )}
            </div>
            {/* Spacer to allow horizontal scrolling beyond viewport when content wider */}
            <div style={{ height: 1, width: Math.max(totalWidth, pinnedTotalWidth) }} />
          </div>
        )}
      </div>

      {/* Modals */}
      {matchModal !== null && (
        <MatchDetailModal matchNumber={matchModal} eventKey={currentEvent.eventKey} onClose={() => setMatchModal(null)} />
      )}
      {photoModal && (
        <TeamPhotosModal pit={photoModal} onClose={() => setPhotoModal(null)} />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SUBCOMPONENTS
// ════════════════════════════════════════════════════════════════════════════

interface DataRowProps {
  row: UnifiedRow;
  columns: Column[];
  pinnedCount: number;
  pinnedLefts: number[];
  totalWidth: number;
  onMatchClick: (matchNumber: number) => void;
  onTeamClick: (team: number) => void;
}

function renderCellContent(
  c: Column,
  v: string | number | boolean | null,
  row: UnifiedRow,
  onMatchClick: (m: number) => void,
  onTeamClick: (t: number) => void,
): React.ReactNode {
  if (c.id === 'kind') {
    return (
      <span className={cn('font-data text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded',
        row.kind === 'match' ? 'bg-[hsl(var(--accent)/0.15)] text-[hsl(var(--accent))]' : 'bg-amber-500/15 text-amber-400'
      )}>
        {row.kind}
      </span>
    );
  }
  if (c.id === 'team') {
    return (
      <button type="button" onClick={() => onTeamClick(row.teamNumber)}
              className={cn('font-data font-bold cursor-pointer flex items-center gap-1',
                row.photoCount > 0 ? 'text-[hsl(var(--foreground))] hover:text-[hsl(var(--accent))]' : 'text-[hsl(var(--foreground))]'
              )}
              title={row.photoCount > 0 ? `View ${row.photoCount} pit photos` : 'No pit photos'}>
        {row.teamNumber}
        {row.photoCount > 0 && <Camera size={9} className="text-[hsl(var(--accent))]" />}
      </button>
    );
  }
  if (c.id === 'match' && row.matchNumber !== null) {
    const matchNum = row.matchNumber;
    return (
      <button type="button" onClick={() => onMatchClick(matchNum)}
              className="font-data text-[hsl(var(--accent))] hover:underline cursor-pointer"
              title="Open match details (TBA)">
        Q{matchNum}
      </button>
    );
  }
  if (c.id === 'alliance' && row.alliance) {
    return (
      <span className={cn('font-data text-[9px] uppercase tracking-wider font-semibold',
        row.alliance === 'red' ? 'text-red-400' : 'text-blue-400'
      )}>{row.alliance}</span>
    );
  }
  if (c.id === 'status' && row.pitStatus) {
    return (
      <span className={cn('font-data text-[9px] uppercase tracking-wider font-semibold',
        row.pitStatus === 'scouted' ? 'text-[hsl(var(--accent))]' :
        row.pitStatus === 'dibbed' ? 'text-amber-400' : 'text-[hsl(var(--muted-foreground))]'
      )}>{row.pitStatus}</span>
    );
  }
  if (c.id === 'totalPts' && row.score) {
    return <span className="font-data font-bold text-[hsl(var(--accent))]">{row.score.total}</span>;
  }
  if (c.id === 'photos' && row.photoCount > 0) {
    return (
      <button type="button" onClick={() => onTeamClick(row.teamNumber)} className="font-data text-[hsl(var(--accent))] hover:underline cursor-pointer">
        {row.photoCount}
      </button>
    );
  }
  if (typeof v === 'boolean') {
    return v
      ? <span className="text-[hsl(var(--accent))]">✓</span>
      : <span className="text-[hsl(var(--muted-foreground)/0.5)]">·</span>;
  }
  if (v === '' || v === null || v === undefined) {
    return <span className="text-[hsl(var(--muted-foreground)/0.35)]">·</span>;
  }
  return String(v);
}

function DataRow({ row, columns, pinnedCount, pinnedLefts, totalWidth, onMatchClick, onTeamClick }: DataRowProps) {
  return (
    <div
      className={cn(
        'flex border-b border-[hsl(var(--border)/0.25)] text-[11px] hover:bg-[hsl(var(--muted)/0.4)] transition-colors',
        row.kind === 'pit' && 'bg-[hsl(var(--muted)/0.15)]'
      )}
      style={{ width: totalWidth, height: 26 }}
    >
      {columns.map((c, idx) => {
        const isPinned = idx < pinnedCount;
        const v = getCellValue(c, row);
        const content = renderCellContent(c, v, row, onMatchClick, onTeamClick);

        return (
          <div
            key={c.id}
            className={cn(
              'flex items-center px-1.5 border-r border-[hsl(var(--border)/0.2)] last:border-r-0 truncate',
              c.numeric || c.align === 'right' ? 'justify-end font-data' : 'justify-start',
              c.kind === 'match-field' && row.kind === 'match' && 'text-[hsl(var(--foreground))]',
              c.kind === 'pit-field' && row.kind === 'pit' && 'text-[hsl(var(--foreground))]',
            )}
            style={{
              width: c.width, minWidth: c.width, flexShrink: 0,
              ...(isPinned ? { position: 'sticky', left: pinnedLefts[idx], zIndex: 5, background: row.kind === 'pit' ? 'hsl(var(--primary))' : 'hsl(var(--primary))', boxShadow: idx === pinnedCount - 1 ? '2px 0 4px hsl(0 0% 0% / 0.4)' : undefined } : {}),
            }}
            title={typeof v === 'string' && v.length > 12 ? v : undefined}
          >
            <span className="truncate">{content}</span>
          </div>
        );
      })}
    </div>
  );
}

// Column picker with semantic grouping (Meta / Score / Match fields / Pit fields)
function ColumnPickerGrouped({ columns, visibleCols, toggleCol }: {
  columns: Column[]; visibleCols: Set<string>; toggleCol: (id: string) => void;
}) {
  const groups: { label: string; cols: Column[] }[] = [
    { label: 'Meta',         cols: columns.filter((c) => c.kind === 'meta') },
    { label: 'Score',        cols: columns.filter((c) => c.kind === 'score') },
    { label: 'Match fields', cols: columns.filter((c) => c.kind === 'match-field') },
    { label: 'Pit fields',   cols: columns.filter((c) => c.kind === 'pit-field') },
  ];
  return (
    <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
      {groups.map((g) => g.cols.length > 0 && (
        <div key={g.label} className="flex flex-col gap-1">
          <span className="text-[9px] uppercase tracking-widest text-[hsl(var(--muted-foreground))] font-semibold">{g.label}</span>
          <div className="flex flex-wrap gap-1">
            {g.cols.map((c) => {
              const on = visibleCols.has(c.id);
              return (
                <button key={c.id} type="button" onClick={() => toggleCol(c.id)}
                        className={cn('flex items-center gap-1 px-2 h-6 rounded-full text-[10px] border transition-colors cursor-pointer',
                          on ? 'border-[hsl(var(--accent))] bg-[hsl(var(--accent)/0.12)] text-[hsl(var(--accent))]'
                             : 'border-[hsl(var(--border))] bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                        )}>
                  {on ? <Eye size={9} /> : <EyeOff size={9} />}
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// LOCAL STORAGE (column prefs)
// ════════════════════════════════════════════════════════════════════════════

const LS_ORDER   = 'nutscout.viewer.colOrder';
const LS_VISIBLE = 'nutscout.viewer.colVisible';
const LS_PINNED  = 'nutscout.viewer.pinnedCount';

function loadOrder(): string[] | null {
  try { const raw = localStorage.getItem(LS_ORDER); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function saveOrder(o: string[]) {
  try { localStorage.setItem(LS_ORDER, JSON.stringify(o)); } catch { /* quota / disabled */ }
}
function loadVisible(): Set<string> | null {
  try { const raw = localStorage.getItem(LS_VISIBLE); return raw ? new Set(JSON.parse(raw)) : null; } catch { return null; }
}
function saveVisible(s: Set<string>) {
  try { localStorage.setItem(LS_VISIBLE, JSON.stringify([...s])); } catch { /* */ }
}
function loadPinned(): number | null {
  try { const raw = localStorage.getItem(LS_PINNED); return raw ? parseInt(raw) : null; } catch { return null; }
}
function savePinned(n: number) {
  try { localStorage.setItem(LS_PINNED, String(n)); } catch { /* */ }
}
