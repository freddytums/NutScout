import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Bell, X, LogOut, ClipboardList, Wrench } from 'lucide-react';
import { useAuth, signOut } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';

export function ProfileMenu() {
  const { user } = useAuth();
  const { notifications, unreadCount, markRead, clear } = useNotifications();
  const [open, setOpen] = useState(false);
  const [clearing, setClearing] = useState<string | null>(null);
  const navigate = useNavigate();

  // Mark all unread as read whenever the dropdown is opened
  useEffect(() => {
    if (!open) return;
    notifications
      .filter((n) => !n.read && n.id)
      .forEach((n) => markRead(n.id!));
  }, [open, notifications, markRead]);

  if (!user) return null;

  function close() { setOpen(false); }

  function goTo(path: string) {
    navigate(path);
    close();
  }

  async function handleClear(id: string) {
    setClearing(id);
    try { await clear(id); } finally { setClearing(null); }
  }

  async function handleClearAll() {
    for (const n of notifications) {
      if (n.id) await clear(n.id);
    }
  }

  return (
    <div className="relative">
      {/* Avatar button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative cursor-pointer"
        aria-label="Profile menu"
        aria-expanded={open}
      >
        {user.photoURL ? (
          <img src={user.photoURL} alt={user.displayName} className="w-8 h-8 rounded-full object-fill" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-[hsl(var(--accent)/0.2)] flex items-center justify-center text-xs font-semibold text-[hsl(var(--accent))]">
            {user.displayName[0]}
          </div>
        )}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[hsl(var(--destructive))] flex items-center justify-center text-[9px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={close} />

          <div className="absolute right-0 top-full mt-2 z-50 w-72 bg-[hsl(var(--primary))] border border-[hsl(var(--border))] rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[80vh]">

            {/* User info */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[hsl(var(--border)/0.6)]">
              {user.photoURL ? (
                <img src={user.photoURL} alt="" className="w-10 h-10 rounded-full object-fill shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-[hsl(var(--accent)/0.2)] flex items-center justify-center text-sm font-semibold text-[hsl(var(--accent))] shrink-0">
                  {user.displayName[0]}
                </div>
              )}
              <div className="min-w-0">
                <div className="font-semibold text-sm truncate">{user.displayName}</div>
                <div className="text-xs text-[hsl(var(--muted-foreground))] truncate">{user.email}</div>
              </div>
            </div>

            {/* Actions */}
            <div className="border-b border-[hsl(var(--border)/0.6)]">
              <button
                type="button"
                onClick={() => goTo('/profile')}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-[hsl(var(--muted)/0.6)] transition-colors cursor-pointer text-left"
              >
                <User size={15} className="text-[hsl(var(--muted-foreground))]" />
                Edit Profile
              </button>
              <button
                type="button"
                onClick={() => { signOut(); close(); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-[hsl(var(--muted)/0.6)] transition-colors cursor-pointer text-left text-[hsl(var(--muted-foreground))]"
              >
                <LogOut size={15} />
                Sign Out
              </button>
            </div>

            {/* Notifications */}
            <div className="flex items-center justify-between px-4 py-2 shrink-0">
              <div className="flex items-center gap-2 text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                <Bell size={12} />
                Notifications
                {unreadCount > 0 && (
                  <span className="bg-[hsl(var(--destructive))] text-white rounded-full px-1.5 py-0.5 text-[10px] font-bold">
                    {unreadCount}
                  </span>
                )}
              </div>
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] cursor-pointer"
                >
                  Clear all
                </button>
              )}
            </div>

            <div className="overflow-y-auto no-scrollbar flex-1">
              {notifications.length === 0 ? (
                <div className="px-4 py-4 text-xs text-[hsl(var(--muted-foreground))] text-center">
                  No notifications
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={cn(
                      'flex items-start gap-2 px-4 py-3 border-b border-[hsl(var(--border)/0.4)] last:border-0 transition-opacity',
                      !n.read && 'bg-[hsl(var(--accent)/0.05)]',
                      clearing === n.id && 'opacity-40 pointer-events-none'
                    )}
                  >
                    {!n.read && (
                      <div className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--accent))] mt-1.5 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-snug">{n.message}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">from {n.fromName}</p>

                      {/* Quick links based on what data the notification carries */}
                      {(n.matchNumber || n.teamNumber) && (
                        <div className="flex gap-2 mt-1.5 flex-wrap">
                          {n.matchNumber && n.teamNumber && (
                            <button
                              type="button"
                              onClick={() => {
                                goTo(`/match?match=${n.matchNumber}&team=${n.teamNumber}`);
                              }}
                              className="flex items-center gap-1 text-[10px] font-medium text-[hsl(var(--accent))] hover:underline cursor-pointer"
                            >
                              <ClipboardList size={10} />
                              Scout Q{n.matchNumber} · #{n.teamNumber}
                            </button>
                          )}
                          {n.teamNumber && !n.matchNumber && (
                            <button
                              type="button"
                              onClick={() => goTo(`/pit?team=${n.teamNumber}`)}
                              className="flex items-center gap-1 text-[10px] font-medium text-[hsl(var(--accent))] hover:underline cursor-pointer"
                            >
                              <Wrench size={10} />
                              Pit scout #{n.teamNumber}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => n.id && handleClear(n.id)}
                      disabled={clearing === n.id}
                      aria-label="Dismiss"
                      className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] cursor-pointer shrink-0 mt-0.5 disabled:pointer-events-none"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
