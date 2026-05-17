import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuthInit, useAuth } from '@/hooks/useAuth';
import { useAppConfigSync } from '@/hooks/useAppConfig';
import { useCurrentEventSync, useDefaultEvent } from '@/hooks/useCurrentEventSync';
import { AppShell } from '@/components/layout/AppShell';
import { Login } from '@/pages/Login';

const MatchScouting = lazy(() => import('@/pages/MatchScouting').then((m) => ({ default: m.MatchScouting })));
const PitScouting = lazy(() => import('@/pages/PitScouting').then((m) => ({ default: m.PitScouting })));
const PitMap = lazy(() => import('@/pages/PitMap').then((m) => ({ default: m.PitMap })));
const Assignments = lazy(() => import('@/pages/Assignments').then((m) => ({ default: m.Assignments })));
const Leaderboard = lazy(() => import('@/pages/Leaderboard').then((m) => ({ default: m.Leaderboard })));
const Profile = lazy(() => import('@/pages/Profile').then((m) => ({ default: m.Profile })));
const UserManagement = lazy(() => import('@/pages/UserManagement').then((m) => ({ default: m.UserManagement })));
const ManageSchedule = lazy(() => import('@/pages/ManageSchedule').then((m) => ({ default: m.ManageSchedule })));
const ManageHub = lazy(() => import('@/pages/ManageHub').then((m) => ({ default: m.ManageHub })));
const LeadDashboard = lazy(() => import('@/pages/LeadDashboard').then((m) => ({ default: m.LeadDashboard })));
const DataManagement = lazy(() => import('@/pages/DataManagement').then((m) => ({ default: m.DataManagement })));
const DataViewer = lazy(() => import('@/pages/DataViewer').then((m) => ({ default: m.DataViewer })));
const PickList = lazy(() => import('@/pages/PickList').then((m) => ({ default: m.PickList })));
const Settings = lazy(() => import('@/pages/Settings').then((m) => ({ default: m.Settings })));

function PageLoader() {
  return (
    <div className="flex justify-center items-center py-16">
      <Loader2 className="animate-spin text-[hsl(var(--accent))]" size={28} />
    </div>
  );
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <div className="flex flex-col items-center gap-3">
          <img src="/NutScout/NUTRONs.png" alt="Nutrons 125" className="w-16 h-16 object-contain animate-pulse" />
          <span className="text-xs text-[hsl(var(--muted-foreground))] font-[Orbitron] tracking-widest">
            NUTSCOUT
          </span>
        </div>
      </div>
    );
  }

  if (!user) return <Login />;
  return <>{children}</>;
}

function App() {
  useAuthInit();
  useAppConfigSync();
  useCurrentEventSync();
  useDefaultEvent();

  return (
    <BrowserRouter basename="/NutScout">
      <AuthGuard>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<Navigate to="/match" replace />} />
              <Route path="match" element={<MatchScouting />} />
              <Route path="pit" element={<PitScouting />} />
              <Route path="pits" element={<PitMap />} />
              <Route path="assignments" element={<Assignments />} />
              <Route path="leaderboard" element={<Leaderboard />} />
              <Route path="viewer" element={<DataViewer />} />
              <Route path="picklist" element={<PickList />} />
              <Route path="profile" element={<Profile />} />
              <Route path="settings" element={<Settings />} />

              {/* Lead / admin workspace */}
              <Route path="manage" element={<ManageHub />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<LeadDashboard />} />
                <Route path="data" element={<DataManagement />} />
                <Route path="users" element={<UserManagement />} />
                <Route path="schedule" element={<ManageSchedule />} />
              </Route>

              {/* Backward-compat redirects so old links / bookmarks keep working */}
              <Route path="map"       element={<Navigate to="/pits"             replace />} />
              <Route path="dashboard" element={<Navigate to="/manage/dashboard" replace />} />
              <Route path="data"      element={<Navigate to="/manage/data"      replace />} />
              <Route path="users"     element={<Navigate to="/manage/users"     replace />} />
            </Route>
          </Routes>
        </Suspense>
      </AuthGuard>
    </BrowserRouter>
  );
}

export default App;
