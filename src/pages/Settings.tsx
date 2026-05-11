import { useState } from 'react';
import { LogOut, RefreshCw, CheckCircle2, AlertCircle, Key, CalendarDays, Users, ShieldAlert, FlaskConical } from 'lucide-react';
import { useSandboxStore } from '@/store/sandboxStore';
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
import type { AppUser } from '@/types/scout';
import { Timestamp } from 'firebase/firestore';
import { seedDemoEvent } from '@/lib/demoSeed';
import { format } from 'date-fns';

const DEMO_SCOUTS: Omit<AppUser, 'createdAt'>[] = [
  { uid: 'demo-brando',  email: 'brando@demo.com',  displayName: 'Brando',   role: 'scout', isPrimaryScout: true,  teamNumber: 1678, teamKey: 'frc1678', teamName: 'Citrus Circuits',   photoURL: 'https://robohash.org/brando?set=set3&size=80x80' },
  { uid: 'demo-kyle',    email: 'kyle@demo.com',    displayName: 'Kyle',     role: 'scout', isPrimaryScout: true,  teamNumber: 1678, teamKey: 'frc1678', teamName: 'Citrus Circuits',   photoURL: 'https://robohash.org/kyle?set=set3&size=80x80' },
  { uid: 'demo-victor',  email: 'victor@demo.com',  displayName: 'Victor',   role: 'scout', isPrimaryScout: true,  teamNumber: 1678, teamKey: 'frc1678', teamName: 'Citrus Circuits',   photoURL: 'https://robohash.org/victor?set=set3&size=80x80' },
  { uid: 'demo-jack',    email: 'jack@demo.com',    displayName: 'Jack',     role: 'scout', isPrimaryScout: true,  teamNumber: 254,  teamKey: 'frc254',  teamName: 'The Cheesy Poofs', photoURL: 'https://robohash.org/jack?set=set3&size=80x80' },
  { uid: 'demo-henry',   email: 'henry@demo.com',   displayName: 'Henry',    role: 'scout', isPrimaryScout: true,  teamNumber: 254,  teamKey: 'frc254',  teamName: 'The Cheesy Poofs', photoURL: 'https://robohash.org/henry?set=set3&size=80x80' },
  { uid: 'demo-walshie', email: 'walshie@demo.com', displayName: 'Walshie',  role: 'scout', isPrimaryScout: true,  teamNumber: 254,  teamKey: 'frc254',  teamName: 'The Cheesy Poofs', photoURL: 'https://robohash.org/walshie?set=set3&size=80x80' },
  { uid: 'demo-zach',    email: 'zach@demo.com',    displayName: 'Zach',     role: 'scout', isPrimaryScout: false, teamNumber: 1678, teamKey: 'frc1678', teamName: 'Citrus Circuits',   photoURL: 'https://robohash.org/zach?set=set3&size=80x80' },
  { uid: 'demo-goldman', email: 'goldman@demo.com', displayName: 'Goldman',  role: 'scout', isPrimaryScout: false, teamNumber: 254,  teamKey: 'frc254',  teamName: 'The Cheesy Poofs', photoURL: 'https://robohash.org/goldman?set=set3&size=80x80' },
  { uid: 'demo-bashir',  email: 'bashir@demo.com',  displayName: 'Bashir',   role: 'scout', isPrimaryScout: false, teamNumber: 1678, teamKey: 'frc1678', teamName: 'Citrus Circuits',   photoURL: 'https://robohash.org/bashir?set=set3&size=80x80' },
];

export function Settings() {
  const { user, realRole } = useAuth();
  const { sandboxRole, sandboxUser, clear: clearSandbox } = useSandboxStore();
  const { currentEvent, setCurrentEventId, setCurrentEvent } = useEventStore();
  const { event: tbaEvent, teams, matches, lastSynced } = useTBAStore();
  const { config: appConfig } = useAppConfig();
  const { sync, status, error } = useTBASync();

  const [eventKeyInput, setEventKeyInput] = useState(currentEvent?.eventKey ?? '');
  const [tbaKeyInput, setTbaKeyInput] = useState('');
  const [tbaKeyVisible, setTbaKeyVisible] = useState(false);
  const [tbaKeySaving, setTbaKeySaving] = useState(false);
  const [tbaKeySaved, setTbaKeySaved] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);
  const [demoDone, setDemoDone] = useState(false);
  const [scoutSeedLoading, setScoutSeedLoading] = useState(false);
  const [scoutSeedDone, setScoutSeedDone] = useState(false);
  const [scoutSeedError, setScoutSeedError] = useState<string | null>(null);

  // Always use real role for Settings — sandbox role should not hide admin controls
  const isAdmin = realRole === 'admin' || realRole === 'lead';

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
    setScoutSeedError(null);
    setScoutSeedDone(false);
    try {
      await Promise.all(
        DEMO_SCOUTS.map((scout) =>
          setDoc(doc(db, 'users', scout.uid), { ...scout, createdAt: Timestamp.now() }, { merge: true })
        )
      );
      setScoutSeedDone(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setScoutSeedError(`Failed: ${msg}. Make sure your role is lead/admin and rules are published.`);
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
    setDemoError(null);
    setDemoDone(false);
    try {
      const eventConfig = await seedDemoEvent();
      setCurrentEventId(eventConfig.id);
      setCurrentEvent(eventConfig);
      setDemoDone(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setDemoError(`Failed: ${msg}. Make sure your role is lead/admin and Firestore rules are published.`);
    } finally {
      setDemoLoading(false);
    }
  }

  const isSyncing = status === 'fetching' || status === 'writing';

  return (
    <div className="p-4 flex flex-col gap-4 max-w-lg mx-auto">
      <h2 className="text-base font-semibold">Settings</h2>

      {/* Sandbox mode warning */}
      {(sandboxRole || sandboxUser) && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/08 px-3 py-2.5">
          <div className="flex items-center gap-2 text-sm text-amber-300">
            <FlaskConical size={14} />
            {sandboxUser
              ? <>Viewing as <strong>{sandboxUser.displayName}</strong> ({sandboxUser.role}). Settings show your real role.</>
              : <>Sandbox active — viewing as <strong>{sandboxRole}</strong>. Settings show your real role.</>
            }
          </div>
          <button type="button" onClick={clearSandbox} className="text-xs text-amber-400 hover:text-amber-200 cursor-pointer shrink-0 underline">
            Exit
          </button>
        </div>
      )}

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

          <div className="border-t border-[hsl(var(--border)/0.5)] pt-3 flex flex-col gap-2">
            <Button variant="secondary" size="sm" onClick={handleCreateDemoEvent} loading={demoLoading} className="gap-2 w-full">
              {demoLoading ? 'Seeding mid-event data…' : 'Load Demo Event (mid-event state)'}
            </Button>
            {demoDone && (
              <p className="text-xs text-[hsl(var(--accent))]">
                Demo loaded — 40 teams, 18 completed matches, mixed pit status. Event is now active.
              </p>
            )}
            {demoError && (
              <p className="text-xs text-[hsl(var(--destructive))]">{demoError}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Demo scout seeder */}
      {isAdmin && (
        <Card>
          <CardHeader className="flex-row items-center gap-2 pb-2">
            <Users size={15} className="text-[hsl(var(--accent))]" />
            <CardTitle>Demo Scouts</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Seed 9 demo scout accounts for testing assignments and scheduling. Safe to run multiple times.
            </p>
            <Button variant="secondary" size="sm" onClick={handleSeedDemoScouts} loading={scoutSeedLoading} className="gap-2">
              <Users size={14} /> Seed Demo Scouts
            </Button>
            {scoutSeedDone && <p className="text-xs text-[hsl(var(--accent))]">9 demo scouts added — visible in User Management.</p>}
            {scoutSeedError && <p className="text-xs text-[hsl(var(--destructive))]">{scoutSeedError}</p>}
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-[hsl(var(--muted-foreground))] text-center">
        NutScout · FRC Scouting · 2026
      </p>
    </div>
  );
}
