import { useState, useMemo, useEffect, useRef } from 'react';
import { X, Clock, ChevronRight, Zap, Bell, CheckCircle2, Trophy } from 'lucide-react';
import { NutronsCelebrationOverlay } from '@/components/CelebrationOverlay';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAssignments } from '@/hooks/useAssignments';
import { useSchedule } from '@/hooks/useSchedule';
import { useNotifications, requestNotificationPermission } from '@/hooks/useNotifications';
import { useAuth } from '@/hooks/useAuth';
import { useTBAStore } from '@/store/tbaStore';
import { useNavigate, NavLink } from 'react-router-dom';
import { type Station, type StationAssignment } from '@/types/scout';
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
      <CardHeader className="flex-row items-center gap-2 pb-2">
        <Bell size={15} className="text-[hsl(var(--accent))]" />
        <CardTitle>Notifications</CardTitle>
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
        {notifications.length > 1 && (
          <button
            type="button"
            onClick={() => notifications.forEach((n) => n.id && handleClear(n.id))}
            className="w-full mt-1 py-1.5 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] cursor-pointer border-t border-[hsl(var(--border)/0.5)] text-center transition-colors"
          >
            Clear all
          </button>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function Assignments() {
  const { user } = useAuth();
  const { assignments } = useAssignments();
  const { schedule, getSlotStatus } = useSchedule();
  const { matches: tbaMatches } = useTBAStore();

  if (!user) return null;

  const myStation = useMemo(() =>
    (Object.entries(assignments) as [Station, StationAssignment][]).find(([, a]) => a?.uid === user.uid)?.[0] ?? null,
    [assignments, user.uid]
  );

  const qualMatches = useMemo(() =>
    sortMatches(tbaMatches.filter((m) => m.comp_level === 'qm')),
    [tbaMatches]
  );

  // Celebration: fire once when all played assigned matches are scouted
  const [celebrate, setCelebrate] = useState(false);
  const prevDoneRef = useRef(false);

  const allAssignedDone = useMemo(() => {
    if (!schedule) return false;
    const myPlayed = qualMatches.filter((m) =>
      !!m.actual_time &&
      Object.values(schedule.assignments[m.key] ?? {}).some((slot) => slot?.uid === user.uid)
    );
    if (myPlayed.length === 0) return false;
    return myPlayed.every((m) => {
      const slotEntry = Object.entries(schedule.assignments[m.key] ?? {})
        .find(([, slot]) => slot?.uid === user.uid);
      if (!slotEntry) return false;
      const [station] = slotEntry as [Station, unknown];
      const alliance = stationAlliance(station);
      const pos = stationPosition(station);
      const teamKey = m.alliances[alliance].team_keys[pos - 1];
      const teamNum = teamKey ? teamNumberFromKey(teamKey) : null;
      if (!teamNum) return false;
      const status = getSlotStatus(m.match_number, teamNum, user.uid, true);
      return status === 'scouted' || status === 'scouted-other';
    });
  }, [schedule, qualMatches, user.uid, getSlotStatus]);

  useEffect(() => {
    if (allAssignedDone && !prevDoneRef.current) setCelebrate(true);
    prevDoneRef.current = allAssignedDone;
  }, [allAssignedDone]);

  return (
    <div className="flex flex-col max-w-2xl mx-auto" style={{ height: 'calc(100dvh - 7.5rem)' }}>
      {celebrate && <NutronsCelebrationOverlay />}
      {allAssignedDone && (
        <div className="shrink-0 mx-4 mt-4 rounded-2xl border-2 border-[#DC2626] bg-[rgba(220,38,38,0.08)] backdrop-blur-sm px-6 py-5 flex flex-col items-center gap-1 z-10">
          <span className="font-[Orbitron] text-2xl font-black tracking-widest text-white drop-shadow-[0_0_12px_rgba(220,38,38,0.9)]">
            DONE SCOUTING!
          </span>
          <span className="text-xs text-[#DC2626] font-semibold tracking-widest uppercase">All assigned matches complete</span>
        </div>
      )}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="p-4 flex flex-col gap-4">
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
        </div>
      </div>
    </div>
  );
}
