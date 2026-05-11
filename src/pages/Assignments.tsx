import { useState, useMemo } from 'react';
import type React from 'react';
import { X, Clock, ChevronRight, Zap, Bell, CheckCircle2, AlertCircle, RefreshCw, Trophy, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAssignments } from '@/hooks/useAssignments';
import { useSchedule, type SlotStatus } from '@/hooks/useSchedule';
import { useNotifications, requestNotificationPermission } from '@/hooks/useNotifications';
import { useAuth } from '@/hooks/useAuth';
import { useTBAStore } from '@/store/tbaStore';
import { useNavigate, NavLink } from 'react-router-dom';
import { updateUserProfile } from '@/lib/firestore';
import { STATIONS, type Station, type StationAssignment, type ScheduleMethod } from '@/types/scout';
import type { AppUser } from '@/types/scout';
import { matchLabel, teamNumberFromKey, sortMatches } from '@/lib/tba';
import type { TBAMatch } from '@/lib/tba';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATION_LABELS: Record<Station, string> = {
  red1: 'Red 1', red2: 'Red 2', red3: 'Red 3',
  blue1: 'Blue 1', blue2: 'Blue 2', blue3: 'Blue 3',
};

function stationAlliance(s: Station): 'red' | 'blue' {
  return s.startsWith('red') ? 'red' : 'blue';
}
function stationPosition(s: Station): 1 | 2 | 3 {
  return parseInt(s.slice(-1)) as 1 | 2 | 3;
}

// ─── Schedule row (per match) ─────────────────────────────────────────────────

function ScheduleRow({ match, assignments, getSlotStatus, onPing, isLead }: {
  match: TBAMatch;
  assignments: ReturnType<typeof useSchedule>['schedule'];
  getSlotStatus: (matchNum: number, teamNum: number, assignedUid: string | undefined, played: boolean) => SlotStatus;
  onPing: (uid: string, scoutName: string, matchNum: number, teamNum: number) => void;
  isLead: boolean;
}) {
  const rowAssignments = assignments?.assignments[match.key] ?? {};
  const time = match.predicted_time ?? match.time;
  const isPlayed = !!match.actual_time;

  const rowBg: Record<SlotStatus, string> = {
    scouted:       'bg-[hsl(142,60%,42%,0.1)]',
    'scouted-other': 'bg-amber-500/08',
    missed:        'bg-[hsl(var(--destructive)/0.07)]',
    upcoming:      '',
  };
  const statusInfo: Record<SlotStatus, { icon: React.ReactNode; tooltip: string | null }> = {
    scouted:         { icon: <CheckCircle2 size={8} className="text-[hsl(142,60%,42%)]" />, tooltip: null },
    'scouted-other': { icon: <AlertTriangle size={8} className="text-amber-400" />, tooltip: 'Data submitted by a different scout than assigned' },
    missed:          { icon: <AlertCircle size={8} className="text-[hsl(var(--destructive))]" />, tooltip: 'Match was played but no data was submitted' },
    upcoming:        { icon: null, tooltip: null },
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
            <div
              key={station}
              className={cn('flex flex-col items-center gap-0.5 p-1 min-h-[52px] text-center', rowBg[status])}
            >
              {teamNum && (
                <span className={cn('font-data text-[10px] font-bold', alliance === 'red' ? 'text-red-400' : 'text-blue-400')}>
                  {teamNum}
                </span>
              )}
              {slot ? (
                <div className="flex flex-col items-center gap-0.5 w-full rounded">
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
                  {statusInfo[status].tooltip ? (
                    <span title={statusInfo[status].tooltip} className="cursor-help">{statusInfo[status].icon}</span>
                  ) : statusInfo[status].icon}
                </div>
              ) : (
                <span className="text-[10px] text-[hsl(var(--muted-foreground))]">—</span>
              )}
              {isLead && slot && teamNum && (
                <button
                  type="button"
                  onClick={() => onPing(slot.uid, slot.name, match.match_number, teamNum)}
                  className="text-[9px] text-[hsl(var(--muted-foreground))] hover:text-amber-400 cursor-pointer"
                  aria-label="Ping scout"
                >
                  <Bell size={8} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Auto-generate panel ──────────────────────────────────────────────────────

function AutoGeneratePanel({ onGenerate, primaryCount }: {
  onGenerate: (method: ScheduleMethod, sort: 'alpha' | 'experience') => Promise<void>;
  primaryCount: number;
}) {
  const [method, setMethod] = useState<ScheduleMethod>('rotate-3');
  const [sort, setSort] = useState<'alpha' | 'experience'>('alpha');
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  const methods: { value: ScheduleMethod; label: string; desc: string }[] = [
    { value: 'fixed',    label: 'Fixed stations',       desc: 'All scouts active every match. Best with exactly 6 scouts.' },
    { value: 'rotate-1', label: 'Rotate every match',   desc: 'Groups swap after every single match. High scout variety, more complex.' },
    { value: 'rotate-2', label: 'Rotate every 2',       desc: 'Groups switch every 2 matches. Balanced rest with frequent changes.' },
    { value: 'rotate-3', label: 'Rotate every 3 ★',    desc: 'Recommended. Groups switch every 3 matches — good rest, consistent coverage.' },
    { value: 'time-block', label: '30-min time blocks', desc: 'Groups rotate by scheduled time, not match count. Needs TBA schedule loaded.' },
    { value: 'alt-halves', label: 'Alternate halves',   desc: 'One group covers the first half of quals, another covers the second. Good for morning/afternoon crews.' },
    { value: 'snake',    label: 'Snake rotation',       desc: 'Groups cycle A → B → C → C → B → A → repeat. Smooth transitions, no hard cutoffs.' },
  ];

  const sortOptions: { value: 'alpha' | 'experience'; label: string; desc: string }[] = [
    { value: 'alpha',      label: 'Alphabetical', desc: 'Scouts assigned to stations in A–Z order.' },
    { value: 'experience', label: 'By experience', desc: 'Scouts with the most submitted matches are placed at Red 1 and Blue 1 (primary positions) first. Puts your most active scouts in the top spots.' },
  ];

  async function handle() {
    setGenerating(true);
    setGenerated(false);
    try {
      await onGenerate(method, sort);
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
                method === value ? 'border-[hsl(var(--accent))] bg-[hsl(var(--accent)/0.08)] text-[hsl(var(--foreground))]' : 'border-[hsl(var(--border))] bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]')}>
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
                sort === value ? 'border-[hsl(var(--accent))] bg-[hsl(var(--accent)/0.08)] text-[hsl(var(--accent))]' : 'border-[hsl(var(--border))] bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]')}>
              <span className="text-sm font-medium">{label}</span>
              <span className="text-xs mt-0.5 leading-snug">{desc}</span>
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-[hsl(var(--muted-foreground))]">
        Each scout keeps the same alliance color throughout their active blocks. All primary scouts are notified when the schedule is published.
      </p>

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

// ─── My schedule (scout personal view) ───────────────────────────────────────

function MySchedule({ uid, myStation }: { uid: string; myStation: Station | null }) {
  const { matches: tbaMatches } = useTBAStore();
  const { schedule, getSlotStatus } = useSchedule();
  const navigate = useNavigate();

  const upcoming = useMemo(() => {
    if (!schedule) return [];
    return sortMatches(tbaMatches.filter((m) => m.comp_level === 'qm'))
      .map((match) => {
        const slotEntry = Object.entries(schedule.assignments[match.key] ?? {})
          .find(([, slot]) => slot?.uid === uid);
        if (!slotEntry) return null;
        const [station, slot] = slotEntry as [Station, { uid: string; name: string }];
        const alliance = stationAlliance(station);
        const pos = stationPosition(station);
        const teamKey = match.alliances[alliance].team_keys[pos - 1];
        const teamNum = teamKey ? teamNumberFromKey(teamKey) : null;
        return { match, station, slot, teamNum };
      })
      .filter(Boolean)
      .slice(0, 10) as { match: TBAMatch; station: Station; slot: { uid: string }; teamNum: number | null }[];
  }, [tbaMatches, schedule, uid]);

  // Also fall back to station-based view
  const stationMatches = useMemo(() => {
    if (upcoming.length > 0 || !myStation) return [];
    const alliance = stationAlliance(myStation);
    const pos = stationPosition(myStation);
    return sortMatches(tbaMatches.filter((m) => m.comp_level === 'qm'))
      .map((m) => {
        const teamKey = m.alliances[alliance].team_keys[pos - 1];
        return { match: m, teamNum: teamKey ? teamNumberFromKey(teamKey) : null };
      })
      .filter((x) => x.teamNum)
      .slice(0, 10);
  }, [tbaMatches, myStation, upcoming.length]);

  const rows = upcoming.length > 0
    ? upcoming.map(({ match, station, teamNum }) => ({ match, station, teamNum }))
    : stationMatches.map(({ match, teamNum }) => ({ match, station: myStation!, teamNum }));

  if (rows.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 pb-2">
        <Clock size={15} className="text-[hsl(var(--accent))]" />
        <CardTitle>Your Schedule</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col divide-y divide-[hsl(var(--border)/0.5)]">
        {rows.map(({ match, station, teamNum }) => {
          const status = teamNum ? getSlotStatus(match.match_number, teamNum, undefined, !!match.actual_time) : 'upcoming';
          const scouted = status === 'scouted' || status === 'scouted-other';
          const time = match.predicted_time ?? match.time;
          return (
            <button key={match.key} type="button"
              onClick={() => navigate(`/match?match=${match.match_number}&team=${teamNum ?? ''}&alliance=${stationAlliance(station)}&pos=${stationPosition(station)}`)}
              className="flex items-center gap-3 py-2.5 -mx-4 px-4 hover:bg-[hsl(var(--muted)/0.5)] transition-colors cursor-pointer text-left">
              <div className="font-data text-sm font-bold text-[hsl(var(--muted-foreground))] w-10 shrink-0">{matchLabel(match)}</div>
              <div className="flex-1 min-w-0">
                <span className="font-data text-base font-bold">{teamNum ?? '—'}</span>
                {time && <span className="text-xs text-[hsl(var(--muted-foreground))] ml-2">{format(time * 1000, 'h:mm a')}</span>}
              </div>
              <span className={cn(
                'text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0',
                stationAlliance(station) === 'red' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
              )}>
                {station.replace('red', 'R').replace('blue', 'B')}
              </span>
              {scouted ? <CheckCircle2 size={14} className="text-[hsl(var(--accent))] shrink-0" /> : <ChevronRight size={14} className="text-[hsl(var(--muted-foreground))] shrink-0" />}
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ─── Notifications panel ──────────────────────────────────────────────────────

function NotificationsPanel() {
  const { notifications, clear } = useNotifications();
  const notificationsSupported = typeof Notification !== 'undefined';
  const [notifEnabled, setNotifEnabled] = useState(
    notificationsSupported && Notification.permission === 'granted'
  );
  const [clearing, setClearing] = useState<string | null>(null);
  const [clearError, setClearError] = useState<string | null>(null);

  async function enableNotifications() {
    const ok = await requestNotificationPermission();
    setNotifEnabled(ok);
  }

  async function handleClear(id: string) {
    setClearing(id);
    setClearError(null);
    try {
      await clear(id);
    } catch {
      setClearError('Could not dismiss — check your connection.');
    } finally {
      setClearing(null);
    }
  }

  if (notifications.length === 0 && (notifEnabled || !notificationsSupported)) return null;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 pb-2">
        <div className="flex items-center gap-2">
          <Bell size={15} className="text-[hsl(var(--accent))]" />
          <CardTitle>Notifications</CardTitle>
        </div>
        {notifications.length > 1 && (
          <button
            type="button"
            onClick={() => notifications.forEach((n) => n.id && handleClear(n.id))}
            className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] cursor-pointer"
          >
            Clear all
          </button>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {!notifEnabled && notificationsSupported && (
          <div className="flex items-center justify-between gap-2 py-1">
            <span className="text-xs text-[hsl(var(--muted-foreground))]">Enable match reminders</span>
            <Button size="sm" variant="secondary" onClick={enableNotifications}>Enable</Button>
          </div>
        )}
        {notifications.slice(0, 10).map((n) => (
          <div key={n.id} className={cn(
            'flex items-start gap-2 py-2 rounded-lg px-2 transition-opacity',
            !n.read && 'bg-[hsl(var(--accent)/0.06)]',
            clearing === n.id && 'opacity-40 pointer-events-none'
          )}>
            <div className="flex-1 min-w-0">
              <p className="text-sm leading-snug">{n.message}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">from {n.fromName}</p>
            </div>
            <button
              type="button"
              onClick={() => n.id && handleClear(n.id)}
              disabled={clearing === n.id}
              aria-label="Dismiss notification"
              className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] cursor-pointer shrink-0 mt-0.5 disabled:pointer-events-none"
            >
              <X size={14} />
            </button>
          </div>
        ))}
        {clearError && (
          <p className="text-xs text-[hsl(var(--destructive))]" role="alert">{clearError}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'my' | 'schedule' | 'generate';

export function Assignments() {
  const { user } = useAuth();
  const { assignments } = useAssignments();
  const { schedule, users, primaryScouts, generate, getSlotStatus } = useSchedule();
  const { send: sendNotif } = useNotifications();
  const { matches: tbaMatches } = useTBAStore();
  const [tab, setTab] = useState<Tab>('my');

  if (!user) return null;

  const isLead = user.role === 'lead' || user.role === 'admin';

  const myStation = useMemo(() =>
    (Object.entries(assignments) as [Station, StationAssignment][]).find(([, a]) => a?.uid === user.uid)?.[0] ?? null,
    [assignments, user.uid]
  );

  const qualMatches = useMemo(() =>
    sortMatches(tbaMatches.filter((m) => m.comp_level === 'qm')),
    [tbaMatches]
  );

  async function handlePing(uid: string, _scoutName: string, matchNum: number, teamNum: number) {
    await sendNotif(uid, `Reminder: Scout Q${matchNum} (Team ${teamNum})`, { matchNumber: matchNum, teamNumber: teamNum });
  }

  async function togglePrimary(u: AppUser) {
    await updateUserProfile(u.uid, { isPrimaryScout: !u.isPrimaryScout });
  }

  const tabs: { id: Tab; label: string; leadOnly?: boolean }[] = [
    { id: 'my', label: 'My Schedule' },
    { id: 'schedule', label: 'Full Schedule', leadOnly: true },
    { id: 'generate', label: 'Auto-Generate', leadOnly: true },
  ];

  const visibleTabs = tabs.filter((t) => !t.leadOnly || isLead);

  return (
    /* Self-contained height — tab bar sits above a scrollable content area so
       it never overlaps content and doesn't rely on the page's sticky positioning */
    <div className="flex flex-col max-w-2xl mx-auto" style={{ height: 'calc(100dvh - 7.5rem)' }}>
      {/* Tab bar — fixed in layout, NOT sticky */}
      <div className="flex border-b border-[hsl(var(--border))] bg-[hsl(var(--primary))] shrink-0">
        {visibleTabs.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className={cn('flex-1 py-3 text-xs font-medium transition-colors cursor-pointer',
              tab === t.id ? 'text-[hsl(var(--accent))] border-b-2 border-[hsl(var(--accent))]' : 'text-[hsl(var(--muted-foreground))]')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Scrollable content — independent of the page scroll */}
      <div className="flex-1 overflow-y-auto min-h-0">
      <div className="p-4 flex flex-col gap-4">
        {/* ── My Schedule tab ── */}
        {tab === 'my' && (
          <>
            <NotificationsPanel />
            {myStation && (
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-[hsl(var(--accent))]" />
                <span className="text-sm">Your station: <Badge variant={stationAlliance(myStation) === 'red' ? 'destructive' : 'secondary'}>{STATION_LABELS[myStation]}</Badge></span>
              </div>
            )}
            <MySchedule uid={user.uid} myStation={myStation} />
            {!myStation && (
              <Card>
                <CardContent className="py-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
                  No station assigned yet. Ask your scouting lead.
                </CardContent>
              </Card>
            )}
            <NavLink to="/leaderboard" className="flex items-center gap-2 text-sm text-[hsl(var(--accent))] hover:underline">
              <Trophy size={14} /> View Scout Leaderboard
            </NavLink>
          </>
        )}

        {/* ── Full Schedule tab (lead) ── */}
        {tab === 'schedule' && isLead && (
          <>
            {qualMatches.length === 0 ? (
              <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-6">Sync a TBA event first to see the schedule.</p>
            ) : (
              /* Self-contained scroll container — sticky header lives inside, no viewport collision */
              <div className="rounded-lg border border-[hsl(var(--border))] overflow-hidden">
                <div className="no-scrollbar overflow-y-auto overflow-x-auto" style={{ maxHeight: 'calc(100dvh - 13rem)' }}>
                  {/* Sticky column header within this scroll container */}
                  <div className="grid grid-cols-6 sticky top-0 z-10 border-b border-[hsl(var(--border))]">
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
                      onPing={handlePing}
                      isLead={isLead}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 text-xs text-[hsl(var(--muted-foreground))] flex-wrap">
              <span className="flex items-center gap-1"><CheckCircle2 size={10} className="text-[hsl(142,60%,42%)]" /> Scouted by assigned</span>
              <span className="flex items-center gap-1"><AlertTriangle size={10} className="text-amber-400" /> Data exists, different scout</span>
              <span className="flex items-center gap-1"><AlertCircle size={10} className="text-[hsl(var(--destructive))]" /> No data</span>
              <span className="flex items-center gap-1"><Bell size={10} /> Ping scout</span>
            </div>
          </>
        )}

        {/* ── Auto-generate tab (lead) ── */}
        {tab === 'generate' && isLead && (
          <>
            <Card>
              <CardHeader><CardTitle>Primary Scouts</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-1">
                <p className="text-xs text-[hsl(var(--muted-foreground))] mb-2">Primary scouts appear in the auto-scheduler. Toggle to add/remove.</p>
                {users.map((u) => (
                  <div key={u.uid} className="flex items-center gap-3 py-1.5">
                    {u.photoURL ? <img src={u.photoURL} alt="" className="w-7 h-7 rounded-full shrink-0 object-fill" /> : <div className="w-7 h-7 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center text-xs shrink-0">{u.displayName[0]}</div>}
                    <span className="flex-1 text-sm">{u.displayName}</span>
                    <button type="button" onClick={() => togglePrimary(u)}
                      className={cn('px-3 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer',
                        u.isPrimaryScout ? 'border-[hsl(var(--accent))] bg-[hsl(var(--accent)/0.15)] text-[hsl(var(--accent))]' : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]')}>
                      {u.isPrimaryScout ? 'Primary' : 'Add'}
                    </button>
                  </div>
                ))}
              </CardContent>
            </Card>
            <AutoGeneratePanel
              primaryCount={primaryScouts.length}
              onGenerate={generate}
            />
          </>
        )}
      </div>
      </div>{/* end scrollable content */}

    </div>
  );
}
