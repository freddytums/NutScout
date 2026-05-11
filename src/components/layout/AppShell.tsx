import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Map, ClipboardList, LayoutDashboard, Wrench, Settings, CalendarCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { RoleSandbox } from '@/components/RoleSandbox';

const navItems = [
  { to: '/match', icon: ClipboardList, label: 'Match' },
  { to: '/pit', icon: Wrench, label: 'Pit' },
  { to: '/map', icon: Map, label: 'Map' },
  { to: '/assignments', icon: CalendarCheck, label: 'Schedule' },
  { to: '/dashboard', icon: LayoutDashboard, label: 'Lead', roleRequired: 'lead' as const },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function AppShell() {
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();

  const visibleItems = navItems.filter(
    (item) => !item.roleRequired || user?.role === item.roleRequired || user?.role === 'admin'
  );

  return (
    <div className="flex flex-col min-h-dvh bg-[hsl(var(--background))]">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[hsl(var(--border))] bg-[hsl(var(--primary)/0.95)] backdrop-blur-md safe-top">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2.5">
            <img src="/NutScout/NUTRONs.png" alt="Nutrons 125" className="h-8 w-8 object-contain" draggable={false} />
            <span className="font-[Orbitron] font-bold text-sm tracking-widest text-[hsl(var(--foreground))]">
              NUTSCOUT
            </span>
          </div>
          {user && (
            <div className="flex items-center gap-2">
              <RoleSandbox />
            <button
              type="button"
              onClick={() => navigate('/profile')}
              className="relative cursor-pointer"
              aria-label="My profile"
            >
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName} className="w-8 h-8 rounded-full" />
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
            </div>
          )}
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>

      {/* Bottom nav */}
      <nav
        className="fixed bottom-0 inset-x-0 z-40 border-t border-[hsl(var(--border))] bg-[hsl(var(--primary)/0.95)] backdrop-blur-md safe-bottom"
        aria-label="Main navigation"
      >
        <div className="flex items-center justify-around h-16">
          {visibleItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center gap-1 min-w-[44px] min-h-[44px] px-1 py-1 rounded-lg transition-all duration-150',
                  isActive
                    ? 'text-[hsl(var(--accent))]'
                    : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                )
              }
            >
              {({ isActive }: { isActive: boolean }) => (
                <>
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 1.75} />
                  <span className="text-[9px] font-medium">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
