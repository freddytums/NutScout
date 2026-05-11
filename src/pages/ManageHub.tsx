import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { LayoutDashboard, BarChart2, Users } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { isAtLeastLead } from '@/types/scout';
import { cn } from '@/lib/utils';

export function ManageHub() {
  const { user } = useAuth();

  if (!user || !isAtLeastLead(user.role)) return <Navigate to="/match" replace />;

  const tabs = [
    { to: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: 'data',      icon: BarChart2,       label: 'Data'      },
    ...(user.role === 'admin' ? [{ to: 'users', icon: Users, label: 'Users' }] : []),
  ] as const;

  return (
    <div className="flex flex-col" style={{ height: 'calc(100dvh - 7.5rem)' }}>
      {/* Secondary tab bar */}
      <div className="flex border-b border-[hsl(var(--border))] bg-[hsl(var(--primary))] shrink-0">
        {tabs.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => cn(
              'flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors',
              isActive
                ? 'border-[hsl(var(--accent))] text-[hsl(var(--accent))]'
                : 'border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
            )}
          >
            <Icon size={13} />
            {label}
          </NavLink>
        ))}
      </div>

      {/* Page content — scrollable for Dashboard/Users, self-managed for Data */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}
