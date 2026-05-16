import { NavLink, Outlet } from 'react-router-dom';
import { ClipboardList, Wrench, CalendarCheck, LayoutDashboard, Settings, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { RoleSandbox } from '@/components/RoleSandbox';
import { ProfileMenu } from '@/components/ProfileMenu';
import { ChatDrawer } from '@/components/ai/ChatDrawer';

const navItems = [
  { to: '/match',       icon: ClipboardList,   label: 'Match'    },
  { to: '/pits',        icon: Wrench,           label: 'Pits'     },
  { to: '/ai-chat',     icon: Bot,              label: 'Ask AI'   },
  { to: '/assignments', icon: CalendarCheck,    label: 'Schedule' },
  { to: '/manage',      icon: LayoutDashboard,  label: 'Manage',  roleRequired: 'lead' as const },
  { to: '/settings',    icon: Settings,         label: 'Settings' },
];

export function AppShell() {
  const { user } = useAuth();

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
              <ProfileMenu />
            </div>
          )}
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>

      {/* Global AI chat drawer */}
      <ChatDrawer />

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
