import { useState } from 'react';
import { HelpButton } from '@/components/ui/HelpButton';
import { Search, ChevronDown, Star, StarOff, Trash2, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSchedule } from '@/hooks/useSchedule';
import { useAuth } from '@/hooks/useAuth';
import { updateUserProfile, deleteUserAccount, deleteUserAccountsBatch } from '@/lib/firestore';
import { cn } from '@/lib/utils';
import type { AppUser, UserRole } from '@/types/scout';

const ROLES: UserRole[] = ['guest', 'scout', 'team-lead', 'lead', 'admin'];

const ROLE_COLORS: Record<UserRole, string> = {
  guest: 'bg-[hsl(var(--muted)/0.5)] text-[hsl(var(--muted-foreground))] border border-[hsl(var(--border))]',
  scout: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]',
  'team-lead': 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  lead: 'bg-[hsl(var(--accent)/0.15)] text-[hsl(var(--accent))] border border-[hsl(var(--accent)/0.3)]',
  admin: 'bg-purple-500/15 text-purple-400 border border-purple-500/30',
};

const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  guest: 'No access — awaiting authorization',
  scout: 'Submit scouting data',
  'team-lead': 'Manage own team scouts & schedule',
  lead: 'Full scouting oversight',
  admin: 'Full system access',
};

function RolePicker({ current, onSelect }: {
  current: UserRole;
  onSelect: (role: UserRole) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer',
          ROLE_COLORS[current]
        )}
      >
        {current}
        <ChevronDown size={11} className={cn('transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 w-52 bg-[hsl(var(--primary))] border border-[hsl(var(--border))] rounded-xl shadow-xl overflow-hidden">
            {ROLES.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => { onSelect(role); setOpen(false); }}
                className={cn(
                  'w-full flex flex-col items-start px-3 py-2.5 text-left transition-colors cursor-pointer hover:bg-[hsl(var(--muted))]',
                  current === role && 'bg-[hsl(var(--muted)/0.5)]'
                )}
              >
                <span className={cn('text-xs font-semibold px-1.5 py-0.5 rounded-full', ROLE_COLORS[role])}>
                  {role}
                </span>
                <span className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5 ml-0.5">
                  {ROLE_DESCRIPTIONS[role]}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function UserRow({ user, onRoleChange, onPrimaryToggle, onDelete, updating, isAdmin, isSelf }: {
  user: AppUser;
  onRoleChange: (uid: string, role: UserRole) => void;
  onPrimaryToggle: (uid: string, current: boolean) => void;
  onDelete: (uid: string) => void;
  updating: string | null;
  isAdmin: boolean;
  isSelf: boolean;
}) {
  const isUpdating = updating === user.uid;
  const [confirming, setConfirming] = useState(false);

  return (
    <div className={cn(
      'flex items-center gap-3 py-3 border-b border-[hsl(var(--border)/0.5)] last:border-0 transition-opacity',
      isUpdating && 'opacity-50'
    )}>
      {/* Avatar */}
      {user.photoURL ? (
        <img src={user.photoURL} alt="" className="w-9 h-9 rounded-full shrink-0 object-fill" />
      ) : (
        <div className="w-9 h-9 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center text-sm font-semibold shrink-0">
          {user.displayName[0]}
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-medium truncate">{user.displayName}</span>
          {user.isPrimaryScout && (
            <Star size={11} className="text-[hsl(var(--accent))] shrink-0" fill="currentColor" />
          )}
          {isSelf && <span className="text-[10px] text-[hsl(var(--muted-foreground))]">(you)</span>}
        </div>
        <div className="text-xs text-[hsl(var(--muted-foreground))] truncate">{user.email}</div>
        {(user.teamKey || user.teamName) && (
          <div className="flex items-center gap-1 mt-0.5">
            {user.teamKey && (
              <span className="font-data text-[10px] text-[hsl(var(--muted-foreground))]">{user.teamKey}</span>
            )}
            {user.teamName && (
              <span className="text-[10px] text-[hsl(var(--muted-foreground))] truncate">— {user.teamName}</span>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => onPrimaryToggle(user.uid, !!user.isPrimaryScout)}
          disabled={isUpdating}
          aria-label={user.isPrimaryScout ? 'Remove primary scout' : 'Make primary scout'}
          className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--accent))] transition-colors cursor-pointer disabled:pointer-events-none"
          title={user.isPrimaryScout ? 'Primary scout (click to remove)' : 'Make primary scout'}
        >
          {user.isPrimaryScout
            ? <Star size={15} fill="currentColor" className="text-[hsl(var(--accent))]" />
            : <StarOff size={15} />
          }
        </button>

        <RolePicker
          current={user.role}
          onSelect={(role) => onRoleChange(user.uid, role)}
        />

        {isAdmin && !isSelf && (
          confirming ? (
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => { onDelete(user.uid); setConfirming(false); }}
                className="text-[9px] px-1.5 py-0.5 rounded bg-[hsl(var(--destructive))] text-white font-semibold cursor-pointer">
                Del
              </button>
              <button type="button" onClick={() => setConfirming(false)}
                className="text-[hsl(var(--muted-foreground))] cursor-pointer">
                <X size={12} />
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirming(true)} disabled={isUpdating}
              className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))] transition-colors cursor-pointer disabled:pointer-events-none">
              <Trash2 size={14} />
            </button>
          )
        )}
      </div>
    </div>
  );
}

export function UserManagement() {
  const { users, loading } = useSchedule();
  const { user: currentUser } = useAuth();
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<UserRole | 'all'>('all');
  const [updating, setUpdating] = useState<string | null>(null);
  const [clearingDemo, setClearingDemo] = useState(false);
  const [confirmClearDemo, setConfirmClearDemo] = useState(false);

  const isAdmin = currentUser?.role === 'admin';
  const demoScouts = users.filter((u) => u.uid.startsWith('demo-'));

  async function handleRoleChange(uid: string, role: UserRole) {
    setUpdating(uid);
    try {
      await updateUserProfile(uid, { role });
    } finally {
      setUpdating(null);
    }
  }

  async function handlePrimaryToggle(uid: string, current: boolean) {
    setUpdating(uid);
    try {
      await updateUserProfile(uid, { isPrimaryScout: !current });
    } finally {
      setUpdating(null);
    }
  }

  async function handleDelete(uid: string) {
    setUpdating(uid);
    try {
      await deleteUserAccount(uid);
    } finally {
      setUpdating(null);
    }
  }

  async function handleClearDemoScouts() {
    setClearingDemo(true);
    try {
      await deleteUserAccountsBatch(demoScouts.map((u) => u.uid));
    } finally {
      setClearingDemo(false);
      setConfirmClearDemo(false);
    }
  }

  const filtered = users.filter((u) => {
    const matchesSearch =
      u.displayName.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.teamName ?? '').toLowerCase().includes(search.toLowerCase()) ||
      String(u.teamNumber ?? '').includes(search);
    const matchesRole = filterRole === 'all' || u.role === filterRole;
    return matchesSearch && matchesRole;
  });

  // Group counts
  const roleCounts = users.reduce<Record<string, number>>((acc, u) => {
    acc[u.role] = (acc[u.role] ?? 0) + 1;
    return acc;
  }, {});
  const primaryCount = users.filter((u) => u.isPrimaryScout).length;

  return (
    <div className="p-4 flex flex-col gap-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">User Management</h2>
        <HelpButton content={{
          title: 'User Management',
          description: 'View and manage every scout\'s role, primary scout status, and team. Admins only.',
          steps: [
            { heading: 'Roles', detail: 'Scout = basic scouting access · Lead = dashboard + data management · Admin = full settings + user management.' },
            { heading: 'Primary Scout', detail: 'Only scouts marked as Primary appear in the schedule generator. Toggle the star icon.' },
            { heading: 'Edit a user', detail: 'Tap the pencil to change display name, role, or team affiliation.' },
            { heading: 'Remove a user', detail: 'Tap the trash icon to delete the account from the app (does not delete scouting data).' },
          ],
          tip: 'Changing a role takes effect immediately — the scout will see the new permissions on their next page load.',
        }} />
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilterRole('all')}
          className={cn('px-2.5 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer',
            filterRole === 'all'
              ? 'border-[hsl(var(--accent))] bg-[hsl(var(--accent)/0.1)] text-[hsl(var(--accent))]'
              : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--accent)/0.5)]'
          )}
        >
          All ({users.length})
        </button>
        {ROLES.map((role) => {
          const count = roleCounts[role] ?? 0;
          if (count === 0) return null;
          return (
            <button
              key={role}
              type="button"
              onClick={() => setFilterRole(role === filterRole ? 'all' : role)}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer',
                filterRole === role
                  ? ROLE_COLORS[role]
                  : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--accent)/0.5)]'
              )}
            >
              {role} ({count})
            </button>
          );
        })}
        {primaryCount > 0 && (
          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-[hsl(var(--accent)/0.1)] text-[hsl(var(--accent))] flex items-center gap-1">
            <Star size={10} fill="currentColor" /> {primaryCount} primary
          </span>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or team..."
          className="w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:ring-offset-2 focus:ring-offset-[hsl(var(--primary))]"
        />
      </div>

      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="flex items-center justify-between">
            <span>Users</span>
            <span className="text-xs font-normal text-[hsl(var(--muted-foreground))]">
              {filtered.length} of {users.length}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          {loading ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))] py-6 text-center">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))] py-6 text-center">No users match</p>
          ) : (
            filtered.map((user) => (
              <UserRow
                key={user.uid}
                user={user}
                onRoleChange={handleRoleChange}
                onPrimaryToggle={handlePrimaryToggle}
                onDelete={handleDelete}
                updating={updating}
                isAdmin={isAdmin}
                isSelf={user.uid === currentUser?.uid}
              />
            ))
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-[hsl(var(--muted-foreground))]">
        <Star size={10} className="inline mr-1" fill="currentColor" />
        Primary scouts appear in the auto-scheduler. Role changes take effect immediately.
      </p>

      {isAdmin && demoScouts.length > 0 && (
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] p-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Demo scouts</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">{demoScouts.length} demo account{demoScouts.length !== 1 ? 's' : ''} in the system</p>
          </div>
          {confirmClearDemo ? (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="destructive" loading={clearingDemo} onClick={handleClearDemoScouts}>
                Remove all
              </Button>
              <button type="button" onClick={() => setConfirmClearDemo(false)}
                className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] cursor-pointer">
                <X size={14} />
              </button>
            </div>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => setConfirmClearDemo(true)}>
              <Trash2 size={13} className="mr-1.5" /> Remove Demo Scouts
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
