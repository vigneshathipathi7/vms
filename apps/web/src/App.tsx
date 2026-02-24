import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useCurrentUser } from './hooks/useCurrentUser';
import { useSessionTimeout } from './hooks/useSessionTimeout';
import { apiFetch } from './services/api';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { AuditPage } from './pages/AuditPage';
import { DashboardPage } from './pages/DashboardPage';
import { DataEntryPage } from './pages/DataEntryPage';
import { EditProfilePage } from './pages/EditProfilePage';
import { LoginPage } from './pages/LoginPage';
import { ProfilePage } from './pages/ProfilePage';
import { SignupPage } from './pages/SignupPage';
import { SubUsersPage } from './pages/SubUsersPage';
import { VotedPage } from './pages/VotedPage';
import { ZoneDetailsPage } from './pages/ZoneDetailsPage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { TermsOfServicePage } from './pages/TermsOfServicePage';
import { UsagePage } from './pages/UsagePage';

function ProtectedRoute({
  isLoading,
  user,
  children,
}: {
  isLoading: boolean;
  user: { role: 'SUPER_ADMIN' | 'ADMIN' | 'SUB_USER' } | null;
  children: JSX.Element;
}) {
  if (isLoading) {
    return <p className="text-sm text-slate-600">Loading...</p>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function AdminRoute({
  isLoading,
  user,
  children,
}: {
  isLoading: boolean;
  user: { role: 'SUPER_ADMIN' | 'ADMIN' | 'SUB_USER' } | null;
  children: JSX.Element;
}) {
  if (isLoading) {
    return <p className="text-sm text-slate-600">Loading...</p>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    return <p className="text-sm text-red-600">Admin access required.</p>;
  }

  return children;
}

function SubUserRoute({
  isLoading,
  user,
  children,
}: {
  isLoading: boolean;
  user: { role: 'SUPER_ADMIN' | 'ADMIN' | 'SUB_USER' } | null;
  children: JSX.Element;
}) {
  if (isLoading) {
    return <p className="text-sm text-slate-600">Loading...</p>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'SUB_USER') {
    return <p className="text-sm text-red-600">Sub-user access required.</p>;
  }

  return children;
}

export default function App() {
  const auth = useCurrentUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  // Initialize session timeout (15 minutes of inactivity)
  // Only activate when user is authenticated
  const sessionTimeout = useSessionTimeout();

  const logoutMutation = useMutation({
    mutationFn: () => apiFetch<{ loggedOut: boolean }>('/auth/logout', { method: 'POST' }),
  });

  async function handleLogout() {
    try {
      await logoutMutation.mutateAsync();
    } catch {
      // Best-effort logout.
    } finally {
      queryClient.setQueryData(['auth', 'me'], undefined);
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      navigate('/login', { replace: true });
      setMenuOpen(false);
    }
  }

  const navLinkClass =
    'rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900';

  return (
    <div className="min-h-screen text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <nav className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500" />
            <h1 className="text-base font-semibold sm:text-lg">Voter Management System</h1>
          </div>

          {auth.user && (
            <button
              className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-sm md:hidden"
              onClick={() => setMenuOpen((prev) => !prev)}
              type="button"
            >
              {menuOpen ? 'Close' : 'Menu'}
            </button>
          )}

          {auth.user ? (
            <div className="hidden items-center gap-1 md:flex">
              <Link className={navLinkClass} to="/dashboard">
                Dashboard
              </Link>
              <Link className={navLinkClass} to="/analytics">
                Analytics
              </Link>
              <Link className={navLinkClass} to="/usage">
                Usage
              </Link>
              <Link className={navLinkClass} to="/entry">
                Data Entry
              </Link>
              <Link className={navLinkClass} to="/voted">
                Voted
              </Link>
              {auth.user.role === 'ADMIN' && (
                <>
                  <Link className={navLinkClass} to="/profile">
                    Profile
                  </Link>
                  <Link className={navLinkClass} to="/sub-users">
                    Sub-users
                  </Link>
                  <Link className={navLinkClass} to="/audit">
                    Audit
                  </Link>
                </>
              )}
              <button
                className="ml-2 rounded-lg bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
                onClick={handleLogout}
                type="button"
                disabled={logoutMutation.isPending}
              >
                {logoutMutation.isPending ? 'Logging out...' : `Logout (${auth.user.username})`}
              </button>
            </div>
          ) : (
            <div className="ml-auto flex items-center gap-2">
              <Link className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100" to="/login">
                Login
              </Link>
              <Link
                className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
                to="/signup"
              >
                Request Access
              </Link>
            </div>
          )}
        </nav>

        {auth.user && menuOpen && (
          <div className="border-t border-slate-200 bg-white px-4 py-3 md:hidden">
            <div className="grid grid-cols-2 gap-2">
              <Link className={navLinkClass} onClick={() => setMenuOpen(false)} to="/dashboard">Dashboard</Link>
              <Link className={navLinkClass} onClick={() => setMenuOpen(false)} to="/analytics">Analytics</Link>
              <Link className={navLinkClass} onClick={() => setMenuOpen(false)} to="/usage">Usage</Link>
              <Link className={navLinkClass} onClick={() => setMenuOpen(false)} to="/entry">Data Entry</Link>
              <Link className={navLinkClass} onClick={() => setMenuOpen(false)} to="/voted">Voted</Link>
              {auth.user.role === 'ADMIN' && (
                <>
                  <Link className={navLinkClass} onClick={() => setMenuOpen(false)} to="/profile">Profile</Link>
                  <Link className={navLinkClass} onClick={() => setMenuOpen(false)} to="/sub-users">Sub-users</Link>
                  <Link className={navLinkClass} onClick={() => setMenuOpen(false)} to="/audit">Audit</Link>
                </>
              )}
            </div>
            <button
              className="mt-3 w-full rounded-lg bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
              onClick={handleLogout}
              type="button"
              disabled={logoutMutation.isPending}
            >
              {logoutMutation.isPending ? 'Logging out...' : `Logout (${auth.user.username})`}
            </button>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8">
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute isLoading={auth.isLoading} user={auth.user}>
                <Navigate to="/dashboard" replace />
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<LoginPage user={auth.user} />} />
          <Route path="/signup" element={<SignupPage user={auth.user} />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute isLoading={auth.isLoading} user={auth.user}>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/usage"
            element={
              <AdminRoute isLoading={auth.isLoading} user={auth.user}>
                <UsagePage />
              </AdminRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute isLoading={auth.isLoading} user={auth.user}>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/edit"
            element={
              <ProtectedRoute isLoading={auth.isLoading} user={auth.user}>
                <EditProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/entry"
            element={
              <ProtectedRoute isLoading={auth.isLoading} user={auth.user}>
                <DataEntryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/zones/:zoneId"
            element={
              <ProtectedRoute isLoading={auth.isLoading} user={auth.user}>
                <ZoneDetailsPage currentUser={auth.user} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/voted"
            element={
              <ProtectedRoute isLoading={auth.isLoading} user={auth.user}>
                <VotedPage currentUser={auth.user} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/sub-users"
            element={
              <AdminRoute isLoading={auth.isLoading} user={auth.user}>
                <SubUsersPage />
              </AdminRoute>
            }
          />
          <Route
            path="/audit"
            element={
              <AdminRoute isLoading={auth.isLoading} user={auth.user}>
                <AuditPage />
              </AdminRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <AdminRoute isLoading={auth.isLoading} user={auth.user}>
                <AnalyticsPage />
              </AdminRoute>
            }
          />
          {/* Legal Pages - Public Access */}
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/terms" element={<TermsOfServicePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
