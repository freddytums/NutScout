import { useState, useEffect } from 'react';
import { HelpButton } from '@/components/ui/HelpButton';
import {
  LogOut, RefreshCw, CheckCircle2, AlertCircle, Key, Users, ShieldAlert,
  FlaskConical, Lock, Unlock, Archive, ArchiveRestore, Plus, Globe, Shield,
} from 'lucide-react';
import { useSandboxStore } from '@/store/sandboxStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { signOut, useAuth } from '@/hooks/useAuth';
import { useEventStore } from '@/store/eventStore';
import { useTBAStore } from '@/store/tbaStore';
import { useTBASync } from '@/hooks/useTBASync';
import { useAppConfig, saveTbaKey, setGlobalDefaults } from '@/hooks/useAppConfig';
import { useAllEvents } from '@/hooks/useAllEvents';
import { updateEventConfig } from '@/lib/firestore';
import { getAvailableYears } from '@/config/games';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { AppUser } from '@/types/scout';
import { Timestamp } from 'firebase/firestore';
import { seedDemoEvent } from '@/lib/demoSeed';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

// ─── Demo scouts ──────────────────────────────────────────────────────────────

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

// ─── General tab ─────────────────────────────────────────────────────────────

function GeneralTab() {
  const { user, realRole } = useAuth();
  const { sandboxRole, sandboxUser, clear: clearSandbox } = useSandboxStore();
  const { currentEvent, currentEventId, setCurrentEventId, setCurrentEvent } = useEventStore();
  const { config: appConfig } = useAppConfig();
  const { visible: visibleEvents } = useAllEvents();
  const availableYears = getAvailableYears();

  const effectiveRole = sandboxRole ?? sandboxUser?.role ?? realRole;

  // Season the user is currently browsing — initialise from their active event,
  // then the admin default, then the latest available year.
  const [browseSeason, setBrowseSeason] = useState<number>(
    currentEvent?.activeGameYear ?? appConfig.defaultGameYear ?? availableYears[0]
  );

  // Keep browseSeason in sync when the active event changes (e.g. demo load)
  useEffect(() => {
    if (currentEvent?.activeGameYear) setBrowseSeason(currentEvent.activeGameYear);
  }, [currentEvent?.activeGameYear]);

  // Events that belong to the browsed season
  const seasonEvents = visibleEvents.filter((e) => e.activeGameYear === browseSeason);

  function handleSwitchSeason(year: number) {
    setBrowseSeason(year);
  }

  function handleSwitchEvent(id: string) {
    const ev = seasonEvents.find((e) => e.id === id);
    if (!ev) return;
    setCurrentEventId(ev.id);
    setCurrentEvent(ev);
    setBrowseSeason(ev.activeGameYear);
  }

  return (
    <div className="flex flex-col gap-4">
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

      {/* TBA key stale banner */}
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

      {/* Account */}
      {user && (
        <Card>
          <CardHeader><CardTitle>Account</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {user.photoURL ? (
                <img src={user.photoURL} alt="" className="w-10 h-10 rounded-full shrink-0 object-fill" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-[hsl(var(--accent)/0.2)] flex items-center justify-center text-[hsl(var(--accent))] font-semibold shrink-0">
                  {user.displayName[0]}
                </div>
              )}
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">{user.displayName}</div>
                <div className="text-xs text-[hsl(var(--muted-foreground))] truncate">{user.email}</div>
                <div className="flex items-center gap-1.5 mt-1">
                  <Badge variant="secondary">{effectiveRole}</Badge>
                  {effectiveRole !== realRole && (
                    <Badge variant="amber" className="text-[10px]">sandbox</Badge>
                  )}
                </div>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
              <LogOut size={18} />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Season + Event selector */}
      <Card>
        <CardHeader><CardTitle>Season &amp; Event</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          {/* Current active event summary */}
          {currentEvent && (
            <div className="flex items-center gap-2 flex-wrap px-3 py-2 rounded-lg bg-[hsl(var(--muted)/0.4)] border border-[hsl(var(--border)/0.5)]">
              <span className="font-medium text-sm flex-1 min-w-0 truncate">{currentEvent.name}</span>
              <Badge variant="secondary" className="font-data shrink-0">{currentEvent.eventKey}</Badge>
              {currentEvent.locked && <Badge variant="amber" className="shrink-0">🔒 locked</Badge>}
            </div>
          )}

          {/* Season picker (tab-style) */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">Season</label>
            <div className="flex gap-1.5 flex-wrap">
              {availableYears.map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => handleSwitchSeason(y)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg border text-sm font-data font-semibold cursor-pointer transition-colors',
                    browseSeason === y
                      ? 'border-[hsl(var(--accent))] bg-[hsl(var(--accent)/0.12)] text-[hsl(var(--accent))]'
                      : 'border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.5)] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--accent)/0.4)]'
                  )}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>

          {/* Event picker filtered to the browsed season */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">Event</label>
            {seasonEvents.length > 0 ? (
              <select
                value={currentEventId && seasonEvents.some((e) => e.id === currentEventId) ? currentEventId : ''}
                onChange={(e) => handleSwitchEvent(e.target.value)}
                className="h-9 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] cursor-pointer"
              >
                <option value="">— Select {browseSeason} event —</option>
                {seasonEvents.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            ) : (
              <p className="text-xs text-[hsl(var(--muted-foreground))] py-1">
                No {browseSeason} events added yet.{' '}
                {effectiveRole === 'admin' ? 'Add one in the Admin tab.' : 'Ask an admin to add events for this season.'}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Admin tab ────────────────────────────────────────────────────────────────

function AdminTab() {
  const { currentEvent, setCurrentEventId, setCurrentEvent } = useEventStore();
  const { event: tbaEvent, teams, matches, lastSynced } = useTBAStore();
  const { config: appConfig } = useAppConfig();
  const { sync, status, error } = useTBASync();
  const { events: allEvents, visible: visibleEvents } = useAllEvents();
  const availableYears = getAvailableYears();

  // TBA key
  const [tbaKeyInput, setTbaKeyInput] = useState('');
  const [tbaKeyVisible, setTbaKeyVisible] = useState(false);
  const [tbaKeySaving, setTbaKeySaving] = useState(false);
  const [tbaKeySaved, setTbaKeySaved] = useState(false);

  // Global defaults
  const [defaultEventSaving, setDefaultEventSaving] = useState(false);
  const [defaultYearSaving, setDefaultYearSaving] = useState(false);
  const [defaultEventId, setDefaultEventId] = useState(appConfig.defaultEventId ?? '');
  const [defaultGameYear, setDefaultGameYear] = useState(appConfig.defaultGameYear ?? 2025);

  // Add event (TBA sync)
  const [eventKeyInput, setEventKeyInput] = useState('');

  // Demo
  const [demoYear, setDemoYear] = useState<number>(availableYears[0]);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);
  const [demoDone, setDemoDone] = useState(false);
  const [scoutSeedLoading, setScoutSeedLoading] = useState(false);
  const [scoutSeedDone, setScoutSeedDone] = useState(false);
  const [scoutSeedError, setScoutSeedError] = useState<string | null>(null);

  const isSyncing = status === 'fetching' || status === 'writing';

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

  async function handleSync() {
    if (!eventKeyInput.trim()) return;
    await sync(eventKeyInput.trim());
  }

  async function handleCreateDemoEvent() {
    setDemoLoading(true);
    setDemoError(null);
    setDemoDone(false);
    try {
      const existing = allEvents.filter((e) => e.id.startsWith(`demo-${demoYear}-`)).length;
      const eventConfig = await seedDemoEvent(demoYear, existing + 1);
      setCurrentEventId(eventConfig.id);
      setCurrentEvent(eventConfig);
      setDemoDone(true);
    } catch (e) {
      setDemoError(`Failed: ${e instanceof Error ? e.message : 'Unknown error'}. Make sure your role is admin and Firestore rules are published.`);
    } finally {
      setDemoLoading(false);
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
      setScoutSeedError(`Failed: ${e instanceof Error ? e.message : 'Unknown error'}.`);
    } finally {
      setScoutSeedLoading(false);
    }
  }

  async function handleSaveDefaultEvent() {
    setDefaultEventSaving(true);
    try { await setGlobalDefaults({ defaultEventId }); } finally { setDefaultEventSaving(false); }
  }

  async function handleSaveDefaultYear() {
    setDefaultYearSaving(true);
    try { await setGlobalDefaults({ defaultGameYear }); } finally { setDefaultYearSaving(false); }
  }

  async function toggleLock(eventId: string, locked: boolean) {
    await updateEventConfig(eventId, { locked });
    if (currentEvent?.id === eventId) setCurrentEvent({ ...currentEvent, locked });
  }

  async function toggleHidden(eventId: string, hidden: boolean) {
    await updateEventConfig(eventId, { hidden });
  }

  return (
    <div className="flex flex-col gap-4">

      {/* ── Global defaults ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex-row items-center gap-2 pb-2">
          <Globe size={15} className="text-[hsl(var(--accent))]" />
          <CardTitle>Global Defaults</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Applied to all users who have not manually selected an event. Existing selections are not affected.
          </p>

          {/* Default event — filtered to the selected default season */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Default Event</label>
            <div className="flex gap-2">
              <select
                value={defaultEventId}
                onChange={(e) => setDefaultEventId(e.target.value)}
                className="flex-1 h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] cursor-pointer"
              >
                <option value="">— None —</option>
                {visibleEvents
                  .filter((e) => e.activeGameYear === defaultGameYear)
                  .map((e) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
              </select>
              <Button size="sm" onClick={handleSaveDefaultEvent} loading={defaultEventSaving} disabled={defaultEventId === (appConfig.defaultEventId ?? '')}>
                Save
              </Button>
            </div>
            {appConfig.defaultEventId && (
              <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                Current: {visibleEvents.find((e) => e.id === appConfig.defaultEventId)?.name ?? appConfig.defaultEventId}
              </p>
            )}
          </div>

          {/* Default game year */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Default Season</label>
            <div className="flex gap-2">
              <select
                value={defaultGameYear}
                onChange={(e) => setDefaultGameYear(parseInt(e.target.value))}
                className="flex-1 h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] cursor-pointer"
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <Button size="sm" onClick={handleSaveDefaultYear} loading={defaultYearSaving} disabled={defaultGameYear === (appConfig.defaultGameYear ?? 2025)}>
                Save
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Event management ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex-row items-center gap-2 pb-2">
          <Shield size={15} className="text-[hsl(var(--accent))]" />
          <CardTitle>Events</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">

          {/* Add event from TBA */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide flex items-center gap-1">
              <Plus size={11} /> Add Event from TBA
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={eventKeyInput}
                onChange={(e) => setEventKeyInput(e.target.value.toLowerCase())}
                placeholder="e.g. 2025casd"
                className="flex-1 h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 text-sm font-data focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
              />
              <Button
                onClick={handleSync}
                loading={isSyncing}
                disabled={!eventKeyInput.trim() || !appConfig.tbaKey}
                className="gap-1.5 shrink-0"
              >
                <RefreshCw size={13} />
                {status === 'fetching' ? 'Fetching…' : status === 'writing' ? 'Saving…' : 'Sync'}
              </Button>
            </div>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
              Game year is detected automatically from the TBA event year.
            </p>

            {!appConfig.tbaKey && (
              <p className="text-xs text-amber-400">Set the TBA API key below first.</p>
            )}

            {status === 'done' && tbaEvent && (
              <div className="rounded-lg border border-[hsl(var(--accent)/0.3)] bg-[hsl(var(--accent)/0.05)] p-3 flex flex-col gap-1">
                <div className="flex items-center gap-2 text-sm text-[hsl(var(--accent))]">
                  <CheckCircle2 size={13} /> Synced — {tbaEvent.name}
                </div>
                <div className="text-xs text-[hsl(var(--muted-foreground))]">
                  {teams.length} teams · {matches.length} matches
                  {lastSynced && ` · ${format(lastSynced, 'MMM d, h:mm a')}`}
                </div>
              </div>
            )}

            {status === 'error' && error && (
              <div className="rounded-lg border border-[hsl(var(--destructive)/0.4)] bg-[hsl(var(--destructive)/0.08)] p-3 flex items-start gap-2">
                <AlertCircle size={13} className="text-[hsl(var(--destructive))] mt-0.5 shrink-0" />
                <span className="text-xs text-[hsl(var(--destructive))]">{error}</span>
              </div>
            )}
          </div>

          {/* Event list */}
          {allEvents.length > 0 && (
            <div className="flex flex-col gap-0.5">
              <label className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1">All Events</label>
              <div className="rounded-xl border border-[hsl(var(--border))] overflow-hidden">
                {allEvents.map((ev, i) => (
                  <div
                    key={ev.id}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2.5 text-sm',
                      i > 0 && 'border-t border-[hsl(var(--border)/0.5)]',
                      ev.hidden && 'opacity-50'
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium truncate">{ev.name}</span>
                        <span className="font-data text-[10px] text-[hsl(var(--muted-foreground))]">{ev.eventKey}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge variant="muted" className="text-[9px] font-data">{ev.activeGameYear}</Badge>
                        {ev.locked && <Badge variant="amber" className="text-[9px]">🔒 locked</Badge>}
                        {ev.hidden && <Badge variant="muted" className="text-[9px]">archived</Badge>}
                      </div>
                    </div>

                    {/* Lock toggle */}
                    <button
                      type="button"
                      onClick={() => toggleLock(ev.id, !ev.locked)}
                      title={ev.locked ? 'Unlock event (allow submissions)' : 'Lock event (read-only for scouts)'}
                      className={cn(
                        'flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border cursor-pointer transition-colors shrink-0',
                        ev.locked
                          ? 'border-amber-500/50 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                          : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--accent)/0.4)] hover:text-[hsl(var(--foreground))]'
                      )}
                    >
                      {ev.locked ? <Lock size={10} /> : <Unlock size={10} />}
                      {ev.locked ? 'Locked' : 'Lock'}
                    </button>

                    {/* Archive toggle */}
                    <button
                      type="button"
                      onClick={() => toggleHidden(ev.id, !ev.hidden)}
                      title={ev.hidden ? 'Restore event (make visible)' : 'Archive event (hide from selectors)'}
                      className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--accent)/0.4)] hover:text-[hsl(var(--foreground))] cursor-pointer transition-colors shrink-0"
                    >
                      {ev.hidden ? <ArchiveRestore size={10} /> : <Archive size={10} />}
                      {ev.hidden ? 'Restore' : 'Archive'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── TBA API key ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex-row items-center gap-2 pb-2">
          <Key size={15} className="text-[hsl(var(--accent))]" />
          <CardTitle>TBA API Key (Shared)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Shared across all users. Get one at thebluealliance.com/account
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
              placeholder="Paste new TBA key to update…"
              className="flex-1 h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 text-sm font-data focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
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

      {/* ── Demo data ────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex-row items-center gap-2 pb-2">
          <Users size={15} className="text-[hsl(var(--accent))]" />
          <CardTitle>Demo Data</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">Year</label>
            <div className="flex gap-1.5 flex-wrap">
              {availableYears.map((y) => (
                <button key={y} type="button" onClick={() => setDemoYear(y)}
                  className={cn('px-3 py-1.5 rounded-lg border text-sm font-data font-semibold cursor-pointer transition-colors',
                    demoYear === y
                      ? 'border-[hsl(var(--accent))] bg-[hsl(var(--accent)/0.12)] text-[hsl(var(--accent))]'
                      : 'border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.5)] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--accent)/0.4)]'
                  )}>
                  {y}
                </button>
              ))}
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={handleCreateDemoEvent} loading={demoLoading} className="gap-2 w-full">
            {demoLoading ? 'Seeding demo data…' : `Generate ${demoYear} Demo Event`}
          </Button>
          {demoDone && <p className="text-xs text-[hsl(var(--accent))]">Demo loaded — 40 teams, 25 completed matches, mixed pit status.</p>}
          {demoError && <p className="text-xs text-[hsl(var(--destructive))]">{demoError}</p>}

          <div className="border-t border-[hsl(var(--border)/0.5)] pt-3">
            <Button variant="secondary" size="sm" onClick={handleSeedDemoScouts} loading={scoutSeedLoading} className="gap-2 w-full">
              <Users size={13} /> Seed Demo Scouts
            </Button>
            {scoutSeedDone && <p className="text-xs text-[hsl(var(--accent))] mt-2">9 demo scouts added.</p>}
            {scoutSeedError && <p className="text-xs text-[hsl(var(--destructive))] mt-2">{scoutSeedError}</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type SettingsTab = 'general' | 'admin';

export function Settings() {
  const { user, realRole } = useAuth();
  const { sandboxRole, sandboxUser } = useSandboxStore();
  const effectiveRole = sandboxRole ?? sandboxUser?.role ?? realRole;
  const isAdmin = effectiveRole === 'admin';

  const [tab, setTab] = useState<SettingsTab>('general');

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b border-[hsl(var(--border))] bg-[hsl(var(--primary))] shrink-0 px-2 items-center">
        {(['general', ...(isAdmin ? ['admin'] : [])] as SettingsTab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-3 text-xs font-medium transition-colors cursor-pointer capitalize',
              tab === t
                ? 'text-[hsl(var(--accent))] border-b-2 border-[hsl(var(--accent))]'
                : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
            )}
          >
            {t === 'admin' && <Shield size={11} />}
            {t === 'general' ? 'General' : 'Admin'}
          </button>
        ))}
        <div className="ml-auto pr-1">
          <HelpButton content={{
            title: 'Settings',
            description: 'Manage your account, choose your active event, and (admins) configure the app for your whole team.',
            steps: [
              { heading: 'General tab', detail: 'Switch season and event. Your selection is saved locally on this device and doesn\'t affect other scouts.' },
              { heading: 'Admin tab', detail: 'Set the global default event/season for new users, add or archive events via TBA sync, lock events to read-only, manage the TBA API key, and seed demo data.' },
            ],
            tip: 'Switching events reloads all scouting data — match entries, pits, and schedule — for the selected event.',
          }} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 max-w-lg mx-auto w-full">
        {tab === 'general' && <GeneralTab />}
        {tab === 'admin' && isAdmin && <AdminTab />}
        {tab === 'admin' && !isAdmin && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <ShieldAlert size={32} className="text-[hsl(var(--muted-foreground))]" />
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Admin access required.</p>
          </div>
        )}
        <p className="text-xs text-[hsl(var(--muted-foreground))] text-center mt-6">NutScout · FRC Scouting · {user ? new Date().getFullYear() : ''}</p>
      </div>
    </div>
  );
}
