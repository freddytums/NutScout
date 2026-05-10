import { useState } from 'react';
import { LogOut, RefreshCw, CheckCircle2, AlertCircle, Key, CalendarDays, Users, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { signOut, useAuth } from '@/hooks/useAuth';
import { useEventStore } from '@/store/eventStore';
import { useTBAStore } from '@/store/tbaStore';
import { useTBASync } from '@/hooks/useTBASync';
import { useAppConfig, saveTbaKey } from '@/hooks/useAppConfig';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { EventConfig, AppUser } from '@/types/scout';
import { Timestamp } from 'firebase/firestore';
import { format } from 'date-fns';

const DEMO_SCOUTS: Omit<AppUser, 'createdAt'>[] = [
  { uid: 'demo-alex', email: 'alex@demo.com', displayName: 'Alex Chen', role: 'scout', isPrimaryScout: true, photoURL: 'https://robohash.org/alexchen?set=set3&size=80x80' },
  { uid: 'demo-jordan', email: 'jordan@demo.com', displayName: 'Jordan Martinez', role: 'scout', isPrimaryScout: true, photoURL: 'https://robohash.org/jordanmartinez?set=set3&size=80x80' },
  { uid: 'demo-sam', email: 'sam@demo.com', displayName: 'Sam Rivera', role: 'scout', isPrimaryScout: true, photoURL: 'https://robohash.org/samrivera?set=set3&size=80x80' },
  { uid: 'demo-taylor', email: 'taylor@demo.com', displayName: 'Taylor Kim', role: 'scout', isPrimaryScout: true, photoURL: 'https://robohash.org/taylorkim?set=set3&size=80x80' },
  { uid: 'demo-morgan', email: 'morgan@demo.com', displayName: 'Morgan Thompson', role: 'scout', isPrimaryScout: true, photoURL: 'https://robohash.org/morganthompson?set=set3&size=80x80' },
  { uid: 'demo-casey', email: 'casey@demo.com', displayName: 'Casey Williams', role: 'scout', isPrimaryScout: true, photoURL: 'https://robohash.org/caseywilliams?set=set3&size=80x80' },
  { uid: 'demo-riley', email: 'riley@demo.com', displayName: 'Riley Johnson', role: 'scout', isPrimaryScout: false, photoURL: 'https://robohash.org/rileyjohnson?set=set3&size=80x80' },
  { uid: 'demo-drew', email: 'drew@demo.com', displayName: 'Drew Patel', role: 'scout', isPrimaryScout: false, photoURL: 'https://robohash.org/drewpatel?set=set3&size=80x80' },
];

export function Settings() {
  const { user } = useAuth();
  const { currentEvent } = useEventStore();
  const { event: tbaEvent, teams, matches, lastSynced } = useTBAStore();
  const { config: appConfig } = useAppConfig();
  const { sync, status, error } = useTBASync();

  const [eventKeyInput, setEventKeyInput] = useState(currentEvent?.eventKey ?? '');
  const [tbaKeyInput, setTbaKeyInput] = useState('');
  const [tbaKeyVisible, setTbaKeyVisible] = useState(false);
  const [tbaKeySaving, setTbaKeySaving] = useState(false);
  const [tbaKeySaved, setTbaKeySaved] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [scoutSeedLoading, setScoutSeedLoading] = useState(false);
  const [scoutSeedDone, setScoutSeedDone] = useState(false);

  const isAdmin = user?.role === 'admin' || user?.role === 'lead';

  async function handleSaveTbaKey() {
    if (!tbaKeyInput.trim()) return;
    setTbaKeySaving(true);
    try {
      await saveTbaKey(tbaKeyInput.trim());
      setTbaKeyInput('');
      setTbaKeySaved(true);
      setTimeout(() => setTbaKeySaved(false), 3000);
    } finally {
      setTbaKeySaving(false);
    }
  }

  async function handleSeedDemoScouts() {
    setScoutSeedLoading(true);
    try {
      await Promise.all(
        DEMO_SCOUTS.map((scout) =>
          setDoc(doc(db, 'users', scout.uid), { ...scout, createdAt: Timestamp.now() }, { merge: true })
        )
      );
      setScoutSeedDone(true);
    } finally {
      setScoutSeedLoading(false);
    }
  }

  async function handleSync() {
    if (!eventKeyInput.trim()) return;
    await sync(eventKeyInput.trim());
  }

  async function handleCreateDemoEvent() {
    setDemoLoading(true);
    try {
      const demoEvent: EventConfig = {
        id: 'demo-2026',
        name: '2026 Demo Event',
        year: 2026,
        eventKey: 'demo-2026',
        pitLayout: {
          rows: 5,
          cols: 8,
          rowLabels: ['A', 'B', 'C', 'D', 'E'],
          colLabels: ['1', '2', '3', '4', '5', '6', '7', '8'],
        },
        teamAssignments: {
          '0-0': 254, '0-1': 1678, '0-2': 4414, '0-3': 3310, '0-4': 1323, '0-5': 2910, '0-6': 1619, '0-7': 5026,
          '1-0': 2056, '1-1': 148, '1-2': 3538, '1-3': 1114, '1-4': 2767, '1-5': 1241, '1-6': 4910, '1-7': 3015,
          '2-0': 604, '2-1': 6328, '2-2': 3360, '2-3': 2522, '2-4': 1086, '2-5': 3476, '2-6': 5987, '2-7': 2658,
          '3-0': 2451, '3-1': 1690, '3-2': 7461, '3-3': 2220, '3-4': 4613, '3-5': 3255, '3-6': 1720, '3-7': 6672,
          '4-0': 2468, '4-1': 5190, '4-2': 3314, '4-3': 1477, '4-4': 2169, '4-5': 498, '4-6': 8033, '4-7': 5024,
        },
        activeGameYear: 2026,
      };

      await setDoc(doc(db, 'events', 'demo-2026'), demoEvent);
      const teams = Object.values(demoEvent.teamAssignments!);
      await Promise.all(
        teams.map((team, i) =>
          setDoc(
            doc(db, 'events', 'demo-2026', 'pits', String(team)),
            { teamNumber: team, row: Math.floor(i / 8), col: i % 8, status: 'unclaimed', createdAt: Timestamp.now() },
            { merge: true }
          )
        )
      );
    } finally {
      setDemoLoading(false);
    }
  }

  const isSyncing = status === 'fetching' || status === 'writing';

  return (
    <div className="p-4 flex flex-col gap-4 max-w-lg mx-auto">
      <h2 className="text-base font-semibold">Settings</h2>

      {/* Account */}
      {user && (
        <Card>
          <CardHeader><CardTitle>Account</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {user.photoURL ? (
                <img src={user.photoURL} alt="" className="w-10 h-10 rounded-full shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-[hsl(var(--accent)/0.2)] flex items-center justify-center text-[hsl(var(--accent))] font-semibold shrink-0">
                  {user.displayName[0]}
                </div>
              )}
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">{user.displayName}</div>
                <div className="text-xs text-[hsl(var(--muted-foreground))] truncate">{user.email}</div>
                <Badge variant="secondary" className="mt-1">{user.role}</Badge>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
              <LogOut size={18} />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* TBA API Key — stale banner for everyone */}
      {appConfig.tbaKeyStale && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/08 p-3">
          <ShieldAlert size={16} className="text-amber-400 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-amber-300">TBA API key is stale</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
              Contact <span className="font-medium text-[hsl(var(--foreground))]">{appConfig.adminName}</span> to update it.
            </p>
          </div>
        </div>
      )}

      {/* TBA key management — admin/lead only */}
      {isAdmin && (
        <Card>
          <CardHeader className="flex-row items-center gap-2 pb-2">
            <Key size={15} className="text-[hsl(var(--accent))]" />
            <CardTitle>TBA API Key (Shared)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              This key is shared across all users. Get one at thebluealliance.com/account
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[hsl(var(--muted-foreground))]">Status:</span>
              <Badge variant={appConfig.tbaKey ? (appConfig.tbaKeyStale ? 'amber' : 'default') : 'muted'}>
                {appConfig.tbaKey ? (appConfig.tbaKeyStale ? 'stale' : 'active') : 'not set'}
              </Badge>
            </div>
            <div className="flex gap-2">
              <input
                type={tbaKeyVisible ? 'text' : 'password'}
                value={tbaKeyInput}
                onChange={(e) => setTbaKeyInput(e.target.value)}
                className="flex-1 h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 text-sm font-data focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
                placeholder="Paste new TBA key to update..."
              />
              <Button variant="ghost" size="sm" onClick={() => setTbaKeyVisible((v) => !v)}>
                {tbaKeyVisible ? 'Hide' : 'Show'}
              </Button>
              <Button size="sm" onClick={handleSaveTbaKey} loading={tbaKeySaving} disabled={!tbaKeyInput.trim()}>
                {tbaKeySaved ? '✓' : 'Save'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TBA Event Sync */}
      <Card>
        <CardHeader className="flex-row items-center gap-2 pb-2">
          <CalendarDays size={15} className="text-[hsl(var(--accent))]" />
          <CardTitle>Sync Event from TBA</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {currentEvent && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-[hsl(var(--muted-foreground))]">Active:</span>
              <span className="text-[hsl(var(--foreground))] font-medium">{currentEvent.name}</span>
              <Badge variant="secondary" className="font-data">{currentEvent.eventKey}</Badge>
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              value={eventKeyInput}
              onChange={(e) => setEventKeyInput(e.target.value.toLowerCase())}
              className="flex-1 h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 text-sm font-data focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:ring-offset-2 focus:ring-offset-[hsl(var(--primary))]"
              placeholder="e.g. 2026casd"
            />
            <Button
              onClick={handleSync}
              loading={isSyncing}
              disabled={!eventKeyInput.trim() || !appConfig.tbaKey}
              className="gap-2 shrink-0"
            >
              <RefreshCw size={14} />
              {status === 'fetching' ? 'Fetching…' : status === 'writing' ? 'Saving…' : 'Sync'}
            </Button>
          </div>

          {!appConfig.tbaKey && (
            <p className="text-xs text-amber-400">
              {isAdmin ? 'Set the shared TBA key above first' : `TBA key not set — contact ${appConfig.adminName}`}
            </p>
          )}

          {status === 'done' && tbaEvent && (
            <div className="rounded-lg border border-[hsl(var(--accent)/0.3)] bg-[hsl(var(--accent)/0.05)] p-3 flex flex-col gap-1.5">
              <div className="flex items-center gap-2 text-sm text-[hsl(var(--accent))]">
                <CheckCircle2 size={14} />
                Synced successfully
              </div>
              <div className="text-sm font-medium">{tbaEvent.name}</div>
              <div className="text-xs text-[hsl(var(--muted-foreground))]">
                {teams.length} teams · {matches.length} matches
              </div>
              {lastSynced && (
                <div className="text-xs text-[hsl(var(--muted-foreground))]">
                  Last synced {format(lastSynced, 'MMM d, h:mm a')}
                </div>
              )}
            </div>
          )}

          {status === 'error' && error && (
            <div className="rounded-lg border border-[hsl(var(--destructive)/0.4)] bg-[hsl(var(--destructive)/0.08)] p-3 flex items-start gap-2">
              <AlertCircle size={14} className="text-[hsl(var(--destructive))] mt-0.5 shrink-0" />
              <span className="text-xs text-[hsl(var(--destructive))]">{error}</span>
            </div>
          )}

          <div className="border-t border-[hsl(var(--border)/0.5)] pt-3">
            <Button variant="ghost" size="sm" onClick={handleCreateDemoEvent} loading={demoLoading} className="text-xs text-[hsl(var(--muted-foreground))]">
              Load demo event instead
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Demo scout seeder */}
      {(user?.role === 'lead' || user?.role === 'admin') && (
        <Card>
          <CardHeader className="flex-row items-center gap-2 pb-2">
            <Users size={15} className="text-[hsl(var(--accent))]" />
            <CardTitle>Demo Scouts</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Seed 8 fake scout accounts for testing assignments and scheduling. Safe to run multiple times.
            </p>
            <Button variant="secondary" size="sm" onClick={handleSeedDemoScouts} loading={scoutSeedLoading} className="gap-2">
              <Users size={14} /> Seed Demo Scouts
            </Button>
            {scoutSeedDone && <p className="text-xs text-[hsl(var(--accent))]">8 demo scouts added to Firestore</p>}
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-[hsl(var(--muted-foreground))] text-center">
        NutScout · FRC Scouting · 2026
      </p>
    </div>
  );
}
