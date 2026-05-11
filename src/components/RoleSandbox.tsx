import { useState } from 'react';
import { FlaskConical, X, ChevronDown } from 'lucide-react';
import { useSandboxStore } from '@/store/sandboxStore';
import { useAuthStore } from '@/store/authStore';
import { subscribeToAllUsers } from '@/lib/firestore';
import { useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { UserRole, AppUser } from '@/types/scout';

const ROLES: UserRole[] = ['scout', 'team-lead', 'lead', 'admin'];

const ROLE_COLORS: Record<UserRole, string> = {
  scout:       'bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]',
  'team-lead': 'bg-blue-500/20 text-blue-300',
  lead:        'bg-[hsl(var(--accent)/0.2)] text-[hsl(var(--accent))]',
  admin:       'bg-purple-500/20 text-purple-300',
};

type SandboxTab = 'role' | 'user';

export function RoleSandbox() {
  const { user: realUser } = useAuthStore();
  const { sandboxRole, sandboxUser, setSandboxRole, setSandboxUser, clear } = useSandboxStore();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SandboxTab>('role');
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [userSearch, setUserSearch] = useState('');

  // Only render for actual admins
  if (realUser?.role !== 'admin') return null;

  // Load user list when panel opens
  useEffect(() => {
    if (!open) return;
    const unsub = subscribeToAllUsers(setAllUsers);
    return unsub;
  }, [open]);

  const isActive = sandboxRole !== null || sandboxUser !== null;
  const displayedRole = sandboxUser?.role ?? sandboxRole ?? realUser?.role;

  const filteredUsers = allUsers
    .filter((u) => u.uid !== realUser?.uid) // exclude yourself
    .filter((u) =>
      u.displayName.toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.teamName ?? '').toLowerCase().includes(userSearch.toLowerCase())
    );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Role sandbox"
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer',
          isActive
            ? 'border-amber-500/60 bg-amber-500/15 text-amber-300 glow-amber'
            : 'border-[hsl(var(--border))] bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--accent)/0.4)]'
        )}
      >
        <FlaskConical size={11} />
        {sandboxUser ? (
          <span className="max-w-[80px] truncate">{sandboxUser.displayName}</span>
        ) : isActive ? (
          `${displayedRole} (sandbox)`
        ) : (
          displayedRole
        )}
        <ChevronDown size={10} className={cn('transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 w-64 bg-[hsl(var(--primary))] border border-[hsl(var(--border))] rounded-xl shadow-xl flex flex-col max-h-[80vh]">

            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-[hsl(var(--border)/0.5)]">
              <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
                <FlaskConical size={11} /> Dev Sandbox
              </div>
              {isActive && (
                <button type="button" onClick={() => { clear(); setOpen(false); }}
                  className="flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300 cursor-pointer">
                  <X size={10} /> Exit
                </button>
              )}
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[hsl(var(--border)/0.5)]">
              {(['role', 'user'] as SandboxTab[]).map((t) => (
                <button key={t} type="button" onClick={() => setActiveTab(t)}
                  className={cn('flex-1 py-2 text-[11px] font-medium cursor-pointer transition-colors capitalize',
                    activeTab === t ? 'text-[hsl(var(--accent))] border-b-2 border-[hsl(var(--accent))]' : 'text-[hsl(var(--muted-foreground))]')}>
                  {t === 'role' ? 'By Role' : 'As User'}
                </button>
              ))}
            </div>

            {/* Role tab */}
            {activeTab === 'role' && (
              <div className="overflow-y-auto">
                {ROLES.map((role) => (
                  <button key={role} type="button"
                    onClick={() => { setSandboxRole(role); setOpen(false); }}
                    className={cn('w-full flex items-center justify-between px-3 py-2.5 transition-colors cursor-pointer hover:bg-[hsl(var(--muted))]',
                      displayedRole === role && !sandboxUser && 'bg-[hsl(var(--muted)/0.6)]')}>
                    <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', ROLE_COLORS[role])}>
                      {role}
                    </span>
                    {role === realUser?.role && (
                      <span className="text-[10px] text-[hsl(var(--muted-foreground))]">real role</span>
                    )}
                    {displayedRole === role && !sandboxUser && role !== realUser?.role && (
                      <span className="text-[10px] text-amber-400">active</span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* User impersonation tab */}
            {activeTab === 'user' && (
              <>
                <div className="p-2 border-b border-[hsl(var(--border)/0.5)]">
                  <input
                    autoFocus
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search users..."
                    className="w-full h-8 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                  />
                </div>
                <div className="overflow-y-auto flex-1">
                  {filteredUsers.length === 0 && (
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))] text-center py-4">
                      {allUsers.length <= 1 ? 'Seed demo scouts in Settings first' : 'No users match'}
                    </p>
                  )}
                  {filteredUsers.map((u) => (
                    <button key={u.uid} type="button"
                      onClick={() => { setSandboxUser(u); setOpen(false); }}
                      className={cn('w-full flex items-center gap-2.5 px-3 py-2 transition-colors cursor-pointer hover:bg-[hsl(var(--muted))]',
                        sandboxUser?.uid === u.uid && 'bg-[hsl(var(--muted)/0.6)]')}>
                      {u.photoURL ? (
                        <img src={u.photoURL} alt="" className="w-6 h-6 rounded-full shrink-0 object-fill" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center text-[10px] font-semibold shrink-0">
                          {u.displayName[0]}
                        </div>
                      )}
                      <div className="flex-1 min-w-0 text-left">
                        <div className="text-xs font-medium truncate">{u.displayName}</div>
                        <div className="text-[10px] text-[hsl(var(--muted-foreground))] truncate">
                          {u.role}{u.teamName ? ` · ${u.teamName}` : ''}
                        </div>
                      </div>
                      {sandboxUser?.uid === u.uid && (
                        <span className="text-[9px] text-amber-400 shrink-0">active</span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}

            <div className="px-3 py-2 border-t border-[hsl(var(--border)/0.5)]">
              <p className="text-[10px] text-[hsl(var(--muted-foreground))] leading-relaxed">
                {activeTab === 'role'
                  ? 'UI-only — Firestore uses your real auth.'
                  : 'Shows that user\'s view. Firestore uses your real auth.'}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
