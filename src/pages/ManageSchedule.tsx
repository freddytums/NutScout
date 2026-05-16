import { useState, useMemo } from 'react';
import { HelpButton } from '@/components/ui/HelpButton';
import type React from 'react';
import {
  Clock, Bell, CheckCircle2, AlertCircle, RefreshCw, AlertTriangle, Zap,
  UserX, UserCheck, ChevronRight, X, ArrowLeftRight, Trash2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSchedule, type SlotStatus } from '@/hooks/useSchedule';
import { useNotifications } from '@/hooks/useNotifications';
import { useAuth } from '@/hooks/useAuth';
import { useTBAStore } from '@/store/tbaStore';
import { useEventStore } from '@/store/eventStore';
import { updateUserProfile, patchScheduleSlot, clearSchedule } from '@/lib/firestore';
import { STATIONS, type Station, type ScheduleMethod, type ScheduledSlot } from '@/types/scout';
import type { AppUser } from '@/types/scout';
import { matchLabel, teamNumberFromKey, sortMatches } from '@/lib/tba';
import type { TBAMatch } from '@/lib/tba';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stationAlliance(s: Station): 'red' | 'blue' {
  return s.startsWith('red') ? 'red' : 'blue';
}
function stationPosition(s: Station): 1 | 2 | 3 {
  return parseInt(s.slice(-1)) as 1 | 2 | 3;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface OpenSlot {
  match: TBAMatch;
  station: Station;
  slot: ScheduledSlot | null;
  teamNum: number | null;
  status: SlotStatus;
}

// ─── Slot action menu (bottom sheet) ─────────────────────────────────────────

function SlotMenu({
  open,
  onClose,
  onNotify,
  onReassign,
  onClear,
  users,
}: {
  open: OpenSlot | null;
  onClose: () => void;
  onNotify: (uid: string, matchNum: number, teamNum: number) => Promise<void>;
  onReassign: (matchKey: string, station: Station, scout: AppUser) => Promise<void>;
  onClear: (matchKey: string, station: Station) => Promise<void>;
  users: AppUser[];
}) {
  const [view, setView] = useState<'main' | 'reassign'>('main');
  const [busy, setBusy] = useState(false);

  // Reset sub-view when menu opens/closes
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    setView('main');
  }

  if (!open) return null;

  const { match, station, slot, teamNum, status } = open;
  const alliance = stationAlliance(station);
  const stationLabel = station.replace('red', 'R').replace('blue', 'B');
  const isPlayed = !!match.actual_time;

  const statusMessages: Partial<Record<SlotStatus, string>> = {
    missed:          'Match was played but no data was submitted.',
    'scouted-other': 'Data was submitted by a different scout than assigned.',
  };
  const statusMsg = statusMessages[status];

  async function wrap(fn: () => Promise<void>) {
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-[hsl(var(--primary))] border-t border-[hsl(var(--border))] shadow-2xl max-w-2xl mx-auto">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[hsl(var(--border))]" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[hsl(var(--border))]">
          {slot ? (
            <>
              {slot.photoURL
                ? <img src={slot.photoURL} alt="" className="w-9 h-9 rounded-full object-fill shrink-0" />
                : <div className="w-9 h-9 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center text-sm font-bold shrink-0">{slot.name[0]}</div>}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{slot.name}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  {matchLabel(match)} · <span className={alliance === 'red' ? 'text-red-400' : 'text-blue-400'}>{stationLabel}</span>
                  {teamNum ? ` · Team ${teamNum}` : ''}
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="w-9 h-9 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center shrink-0">
                <UserX size={16} className="text-[hsl(var(--muted-foreground))]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">Unassigned slot</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  {matchLabel(match)} · <span className={alliance === 'red' ? 'text-red-400' : 'text-blue-400'}>{stationLabel}</span>
                  {teamNum ? ` · Team ${teamNum}` : ''}
                </p>
              </div>
            </>
          )}
          <button type="button" onClick={onClose} className="p-1.5 rounded-full hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] cursor-pointer">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 py-3 flex flex-col gap-1 pb-6">
          {view === 'main' && (
            <>
              {/* Status alert */}
              {statusMsg && (
                <div className={cn(
                  'flex items-start gap-2 rounded-lg px-3 py-2.5 mb-2 text-xs',
                  status === 'missed'
                    ? 'bg-[hsl(var(--destructive)/0.12)] text-[hsl(var(--destructive))] border border-[hsl(var(--destructive)/0.25)]'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/25',
                )}>
                  {status === 'missed'
                    ? <AlertCircle size={13} className="shrink-0 mt-0.5" />
                    : <AlertTriangle size={13} className="shrink-0 mt-0.5" />}
                  <span>{statusMsg}</span>
                </div>
              )}

              {/* Reassign */}
              <button type="button" disabled={busy}
                onClick={() => setView('reassign')}
                className="flex items-center gap-3 w-full px-3 py-3 rounded-lg hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer text-left disabled:opacity-50">
                <ArrowLeftRight size={16} className="text-[hsl(var(--accent))] shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Reassign scout</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Replace {slot ? slot.name.split(' ')[0] : 'the empty slot'} with another scout</p>
                </div>
                <ChevronRight size={14} className="text-[hsl(var(--muted-foreground))]" />
              </button>

              {/* Notify — only when there's an assigned scout */}
              {slot && teamNum && (
                <button type="button" disabled={busy}
                  onClick={() => wrap(() => onNotify(slot.uid, match.match_number, teamNum).then(onClose))}
                  className="flex items-center gap-3 w-full px-3 py-3 rounded-lg hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer text-left disabled:opacity-50">
                  <Bell size={16} className="text-amber-400 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Send reminder</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">Ping {slot.name.split(' ')[0]} for {matchLabel(match)}</p>
                  </div>
                </button>
              )}

              {/* Clear slot */}
              {slot && !isPlayed && (
                <button type="button" disabled={busy}
                  onClick={() => wrap(() => onClear(match.key, station).then(onClose))}
                  className="flex items-center gap-3 w-full px-3 py-3 rounded-lg hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer text-left disabled:opacity-50">
                  <UserX size={16} className="text-[hsl(var(--destructive))] shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[hsl(var(--destructive))]">Clear assignment</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">Remove {slot.name.split(' ')[0]} from this slot</p>
                  </div>
                </button>
              )}
            </>
          )}

          {view === 'reassign' && (
            <>
              <button type="button" onClick={() => setView('main')}
                className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] mb-2 cursor-pointer">
                <ChevronRight size={11} className="rotate-180" /> Back
              </button>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mb-1 px-1">Select a scout to assign to this slot:</p>
              <div className="flex flex-col gap-0.5 max-h-64 overflow-y-auto">
                {users.map((u) => {
                  const isCurrent = slot?.uid === u.uid;
                  return (
                    <button key={u.uid} type="button" disabled={busy || isCurrent}
                      onClick={() => wrap(() => onReassign(match.key, station, u).then(onClose))}
                      className={cn(
                        'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-colors cursor-pointer text-left disabled:opacity-50',
                        isCurrent
                          ? 'bg-[hsl(var(--accent)/0.12)] border border-[hsl(var(--accent)/0.3)]'
                          : 'hover:bg-[hsl(var(--muted))]',
                      )}>
                      {u.photoURL
                        ? <img src={u.photoURL} alt="" className="w-8 h-8 rounded-full object-fill shrink-0" />
                        : <div className="w-8 h-8 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center text-xs font-bold shrink-0">{u.displayName[0]}</div>}
                      <span className="flex-1 text-sm">{u.displayName}</span>
                      {isCurrent && (
                        <span className="flex items-center gap-1 text-[10px] text-[hsl(var(--accent))]">
                          <UserCheck size={11} /> current
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Schedule row ─────────────────────────────────────────────────────────────

function ScheduleRow({ match, assignments, getSlotStatus, onSlotTap }: {
  match: TBAMatch;
  assignments: ReturnType<typeof useSchedule>['schedule'];
  getSlotStatus: (matchNum: number, teamNum: number, assignedUid: string | undefined, played: boolean) => SlotStatus;
  onSlotTap: (info: OpenSlot) => void;
}) {
  const rowAssignments = assignments?.assignments[match.key] ?? {};
  const time = match.predicted_time ?? match.time;
  const isPlayed = !!match.actual_time;

  const rowBg: Record<SlotStatus, string> = {
    scouted:         'bg-[hsl(142,60%,42%,0.1)]',
    'scouted-other': 'bg-amber-500/08',
    missed:          'bg-[hsl(var(--destructive)/0.07)]',
    upcoming:        '',
  };
  const statusIcon: Record<SlotStatus, React.ReactNode> = {
    scouted:         <CheckCircle2 size={8} className="text-[hsl(142,60%,42%)]" />,
    'scouted-other': <AlertTriangle size={8} className="text-amber-400" />,
    missed:          <AlertCircle size={8} className="text-[hsl(var(--destructive))]" />,
    upcoming:        null,
  };

  return (
    <div className="border-b border-[hsl(var(--border)/0.4)] last:border-0">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-[hsl(var(--muted)/0.3)]">
        <span className="font-data text-xs font-bold text-[hsl(var(--muted-foreground))] w-10">{matchLabel(match)}</span>
        {time && <span className="text-xs text-[hsl(var(--muted-foreground))]">{format(time * 1000, 'h:mm a')}</span>}
        {isPlayed && <Badge variant="muted" className="text-[10px] ml-auto">played</Badge>}
      </div>
      <div className="grid grid-cols-6 divide-x divide-[hsl(var(--border)/0.3)]">
        {STATIONS.map((station) => {
          const slot = rowAssignments[station];
          const alliance = stationAlliance(station);
          const teamKey = match.alliances[alliance].team_keys[stationPosition(station) - 1];
          const teamNum = teamKey ? teamNumberFromKey(teamKey) : null;
          const status = teamNum ? getSlotStatus(match.match_number, teamNum, slot?.uid, isPlayed) : 'upcoming';

          return (
            <button
              key={station}
              type="button"
              onClick={() => onSlotTap({ match, station, slot: slot ?? null, teamNum, status })}
              className={cn(
                'flex flex-col items-center gap-0.5 p-1 min-h-[52px] text-center w-full cursor-pointer transition-colors active:brightness-150',
                rowBg[status],
                'hover:brightness-125',
              )}
            >
              {teamNum && (
                <span className={cn('font-data text-[10px] font-bold', alliance === 'red' ? 'text-red-400' : 'text-blue-400')}>
                  {teamNum}
                </span>
              )}
              {slot ? (
                <div className="flex flex-col items-center gap-0.5 w-full">
                  {slot.photoURL ? (
                    <img src={slot.photoURL} alt="" className="w-5 h-5 rounded-full object-fill" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center text-[10px] font-bold">
                      {slot.name[0]}
                    </div>
                  )}
                  <span className="text-[9px] leading-tight truncate max-w-[40px] text-[hsl(var(--foreground))]">
                    {slot.name.split(' ')[0]}
                  </span>
                  {statusIcon[status]}
                </div>
              ) : (
                <span className="text-[10px] text-[hsl(var(--muted-foreground))/0.5]">—</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Auto-generate panel ──────────────────────────────────────────────────────

function AutoGeneratePanel({ onGenerate, primaryCount }: {
  onGenerate: (method: ScheduleMethod, sort: 'alpha' | 'experience', fillGaps: boolean) => Promise<void>;
  primaryCount: number;
}) {
  const [method, setMethod] = useState<ScheduleMethod>('rotate-3');
  const [sort, setSort] = useState<'alpha' | 'experience'>('alpha');
  const [fillGaps, setFillGaps] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  const methods: { value: ScheduleMethod; label: string; desc: string }[] = [
    { value: 'fixed',      label: 'Fixed stations',       desc: 'All scouts active every match. Best with exactly 6 scouts.' },
    { value: 'rotate-1',   label: 'Rotate every match',   desc: 'Groups swap after every single match. High scout variety, more complex.' },
    { value: 'rotate-2',   label: 'Rotate every 2',       desc: 'Groups switch every 2 matches. Balanced rest with frequent changes.' },
    { value: 'rotate-3',   label: 'Rotate every 3 ★',    desc: 'Recommended. Groups switch every 3 matches — good rest, consistent coverage.' },
    { value: 'time-block', label: '30-min time blocks',   desc: 'Groups rotate by scheduled time, not match count. Needs TBA schedule loaded.' },
    { value: 'alt-halves', label: 'Alternate halves',     desc: 'One group covers the first half of quals, another covers the second.' },
    { value: 'snake',      label: 'Snake rotation',       desc: 'Groups cycle A → B → C → C → B → A → repeat. Smooth transitions, no hard cutoffs.' },
  ];

  const sortOptions: { value: 'alpha' | 'experience'; label: string; desc: string }[] = [
    { value: 'alpha',      label: 'Alphabetical',  desc: 'Scouts assigned to stations in A–Z order.' },
    { value: 'experience', label: 'By experience', desc: 'Most active scouts placed at Red 1 and Blue 1 first.' },
  ];

  async function handle() {
    setGenerating(true);
    setGenerated(false);
    try {
      await onGenerate(method, sort, fillGaps);
      setGenerated(true);
      setTimeout(() => setGenerated(false), 5000);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-[hsl(var(--muted-foreground))]">Primary scouts:</span>
        <Badge variant={primaryCount >= 6 ? 'default' : 'amber'}>{primaryCount} selected</Badge>
        {primaryCount < 6 && <span className="text-xs text-amber-400">Need at least 6 for a full rotation</span>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Scheduling method</label>
        <div className="flex flex-col gap-1.5">
          {methods.map(({ value, label, desc }) => (
            <button key={value} type="button" onClick={() => setMethod(value)}
              className={cn('flex flex-col items-start px-3 py-2.5 rounded-lg border text-left transition-all cursor-pointer',
                method === value
                  ? 'border-[hsl(var(--accent))] bg-[hsl(var(--accent)/0.08)] text-[hsl(var(--foreground))]'
                  : 'border-[hsl(var(--border))] bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]')}>
              <span className="text-sm font-medium">{label}</span>
              <span className="text-xs mt-0.5 leading-snug">{desc}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Station assignment order</label>
        <div className="flex flex-col gap-1.5">
          {sortOptions.map(({ value, label, desc }) => (
            <button key={value} type="button" onClick={() => setSort(value)}
              className={cn('flex flex-col items-start px-3 py-2.5 rounded-lg border text-left transition-all cursor-pointer',
                sort === value
                  ? 'border-[hsl(var(--accent))] bg-[hsl(var(--accent)/0.08)] text-[hsl(var(--accent))]'
                  : 'border-[hsl(var(--border))] bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]')}>
              <span className="text-sm font-medium">{label}</span>
              <span className="text-xs mt-0.5 leading-snug">{desc}</span>
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-[hsl(var(--muted-foreground))]">
        Each scout keeps the same alliance color throughout their active blocks. All primary scouts are notified when the schedule is published.
      </p>

      <button type="button" onClick={() => setFillGaps((v) => !v)}
        className="flex items-center justify-between w-full px-3 py-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] cursor-pointer transition-colors hover:border-[hsl(var(--accent)/0.5)]">
        <div className="flex flex-col items-start gap-0.5">
          <span className="text-sm font-medium">Fill unassigned slots</span>
          <span className="text-xs text-[hsl(var(--muted-foreground))] text-left">When scouts aren't a multiple of 6, backfill empty stations fairly across the whole team</span>
        </div>
        <div className={cn(
          'relative w-10 h-5.5 rounded-full shrink-0 transition-colors ml-3',
          fillGaps ? 'bg-[hsl(var(--accent))]' : 'bg-[hsl(var(--muted-foreground)/0.3)]'
        )}>
          <div className={cn(
            'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
            fillGaps ? 'translate-x-5' : 'translate-x-0.5'
          )} />
        </div>
      </button>

      <Button onClick={handle} loading={generating} disabled={primaryCount < 1} className="gap-2 w-full">
        <RefreshCw size={14} /> Generate Full Schedule
      </Button>

      {generated && (
        <div className="flex items-center gap-2 rounded-lg border border-[hsl(var(--accent)/0.3)] bg-[hsl(var(--accent)/0.08)] px-3 py-2.5">
          <CheckCircle2 size={14} className="text-[hsl(var(--accent))] shrink-0" />
          <span className="text-sm text-[hsl(var(--accent))]">Schedule generated — all primary scouts notified.</span>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'schedule' | 'generate';

export function ManageSchedule() {
  const { user } = useAuth();
  const { schedule, users, primaryScouts, generate, getSlotStatus } = useSchedule();
  const { send: sendNotif } = useNotifications();
  const { matches: tbaMatches } = useTBAStore();
  const { currentEventId } = useEventStore();
  const [tab, setTab] = useState<Tab>('schedule');
  const [openSlot, setOpenSlot] = useState<OpenSlot | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  const isAdmin = user?.role === 'admin';

  async function handleClearSchedule() {
    if (!currentEventId) return;
    setClearing(true);
    try { await clearSchedule(currentEventId); } finally { setClearing(false); setConfirmClear(false); }
  }

  const qualMatches = useMemo(
    () => sortMatches(tbaMatches.filter((m) => m.comp_level === 'qm')),
    [tbaMatches],
  );

  async function handlePing(uid: string, matchNum: number, teamNum: number) {
    await sendNotif(uid, `Reminder: Scout Q${matchNum} (Team ${teamNum})`, { matchNumber: matchNum, teamNumber: teamNum });
  }

  async function handleReassign(matchKey: string, station: Station, scout: AppUser) {
    if (!currentEventId) return;
    await patchScheduleSlot(currentEventId, matchKey, station, {
      uid: scout.uid,
      name: scout.displayName,
      photoURL: scout.photoURL ?? undefined,
    });
  }

  async function handleClear(matchKey: string, station: Station) {
    if (!currentEventId) return;
    await patchScheduleSlot(currentEventId, matchKey, station, null);
  }

  async function togglePrimary(u: AppUser) {
    await updateUserProfile(u.uid, { isPrimaryScout: !u.isPrimaryScout });
  }

  if (!user) return null;

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'schedule', label: 'Full Schedule', icon: <Clock size={12} /> },
    { id: 'generate', label: 'Auto-Generate', icon: <Zap size={12} /> },
  ];

  return (
    <>
      <div className="p-4 flex flex-col gap-4 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Schedule</h2>
          <HelpButton content={{
            title: 'Schedule',
            description: 'Generate and manage the scouting schedule — which scout covers which robot in every match.',
            steps: [
              { heading: 'Generate tab', detail: 'Pick a rotation method (e.g. Rotate-3, Snake) and click Generate. All primary scouts are notified automatically.' },
              { heading: 'Schedule tab', detail: 'Full match-by-match grid. Each cell shows the scout assigned to that alliance station.' },
              { heading: 'Slot colors', detail: 'Green = submitted · Amber = missed (match played, no entry) · White = upcoming · Gray = unassigned.' },
              { heading: 'Reassign a slot', detail: 'Go to Lead Dashboard → Missing Coverage and use the Assign button on any missed slot.' },
            ],
            tip: 'Only scouts marked as Primary appear in the schedule. Set primary status in User Management.',
          }} />
        </div>

        {/* Sub-tabs */}
        <div className="flex rounded-lg border border-[hsl(var(--border))] overflow-hidden shrink-0">
          {tabs.map((t) => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors cursor-pointer',
                tab === t.id
                  ? 'bg-[hsl(var(--accent)/0.15)] text-[hsl(var(--accent))]'
                  : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
              )}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* Full Schedule */}
        {tab === 'schedule' && (
          <>
            {isAdmin && schedule && (
              <div className="flex justify-end">
                {confirmClear ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">Delete entire schedule?</span>
                    <button type="button" onClick={handleClearSchedule} disabled={clearing}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[hsl(var(--destructive))] text-white text-xs font-semibold cursor-pointer disabled:opacity-50">
                      {clearing ? 'Clearing…' : 'Yes, clear'}
                    </button>
                    <button type="button" onClick={() => setConfirmClear(false)}
                      className="px-3 py-1.5 rounded-lg border border-[hsl(var(--border))] text-xs text-[hsl(var(--muted-foreground))] cursor-pointer">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setConfirmClear(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[hsl(var(--destructive)/0.4)] text-[hsl(var(--destructive))] text-xs font-medium hover:bg-[hsl(var(--destructive)/0.08)] cursor-pointer transition-colors">
                    <Trash2 size={12} /> Clear Schedule
                  </button>
                )}
              </div>
            )}
            {qualMatches.length === 0 ? (
              <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-6">Sync a TBA event first to see the schedule.</p>
            ) : (
              <div className="rounded-lg border border-[hsl(var(--border))] overflow-hidden">
                <div className="grid grid-cols-6 border-b border-[hsl(var(--border))]">
                  {STATIONS.map((s) => (
                    <div key={s} className={cn('py-1.5 text-center text-[10px] font-bold', stationAlliance(s) === 'red' ? 'bg-red-500/25 text-red-400' : 'bg-blue-500/25 text-blue-400')}>
                      {s.replace('red', 'R').replace('blue', 'B')}
                    </div>
                  ))}
                </div>
                {qualMatches.map((match) => (
                  <ScheduleRow
                    key={match.key}
                    match={match}
                    assignments={schedule}
                    getSlotStatus={getSlotStatus}
                    onSlotTap={setOpenSlot}
                  />
                ))}
              </div>
            )}
            <div className="flex gap-3 text-xs text-[hsl(var(--muted-foreground))] flex-wrap">
              <span className="flex items-center gap-1"><CheckCircle2 size={10} className="text-[hsl(142,60%,42%)]" /> Scouted by assigned</span>
              <span className="flex items-center gap-1"><AlertTriangle size={10} className="text-amber-400" /> Data exists, different scout</span>
              <span className="flex items-center gap-1"><AlertCircle size={10} className="text-[hsl(var(--destructive))]" /> No data</span>
              <span className="text-[hsl(var(--accent))/0.7]">Tap any slot to manage</span>
            </div>

          </>
        )}

        {/* Auto-Generate */}
        {tab === 'generate' && (
          <>
            <Card>
              <CardHeader><CardTitle>Primary Scouts</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-1">
                <p className="text-xs text-[hsl(var(--muted-foreground))] mb-2">
                  Primary scouts appear in the auto-scheduler. Toggle to add/remove.
                </p>
                {users.map((u) => (
                  <div key={u.uid} className="flex items-center gap-3 py-1.5">
                    {u.photoURL
                      ? <img src={u.photoURL} alt="" className="w-7 h-7 rounded-full shrink-0 object-fill" />
                      : <div className="w-7 h-7 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center text-xs shrink-0">{u.displayName[0]}</div>}
                    <span className="flex-1 text-sm">{u.displayName}</span>
                    <button type="button" onClick={() => togglePrimary(u)}
                      className={cn('px-3 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer',
                        u.isPrimaryScout
                          ? 'border-[hsl(var(--accent))] bg-[hsl(var(--accent)/0.15)] text-[hsl(var(--accent))]'
                          : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]')}>
                      {u.isPrimaryScout ? 'Primary' : 'Add'}
                    </button>
                  </div>
                ))}
              </CardContent>
            </Card>
            <AutoGeneratePanel primaryCount={primaryScouts.length} onGenerate={(m, s, f) => generate(m, s, f)} />
          </>
        )}
      </div>

      <SlotMenu
        open={openSlot}
        onClose={() => setOpenSlot(null)}
        onNotify={handlePing}
        onReassign={handleReassign}
        onClear={handleClear}
        users={users}
      />
    </>
  );
}
