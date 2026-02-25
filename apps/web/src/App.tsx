import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useCurrentUser } from './hooks/useCurrentUser';
import { useSessionTimeout } from './hooks/useSessionTimeout';
import { apiFetch } from './services/api';
import { AccessRequestStatsResponse } from './types/api';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { AuditPage } from './pages/AuditPage';
import { AccessRequestsPage } from './pages/AccessRequestsPage';
import { DashboardPage } from './pages/DashboardPage';
import { DataEntryPage } from './pages/DataEntryPage';
import { EditProfilePage } from './pages/EditProfilePage';
import { LoginPage } from './pages/LoginPage';
import { ProfilePage } from './pages/ProfilePage';
import { SignupPage } from './pages/SignupPage';
import { SetupPasswordPage } from './pages/SetupPasswordPage';
import { SubUsersPage } from './pages/SubUsersPage';
import { VotedPage } from './pages/VotedPage';
import { ZoneDetailsPage } from './pages/ZoneDetailsPage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { TermsOfServicePage } from './pages/TermsOfServicePage';
import { UsagePage } from './pages/UsagePage';

type NavItem = {
  to: string;
  label: string;
  icon: JSX.Element;
  badge?: number;
};

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

function SuperAdminRoute({
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

  if (user.role !== 'SUPER_ADMIN') {
    return <p className="text-sm text-red-600">Super admin access required.</p>;
  }

  return children;
}

export default function App() {
  const auth = useCurrentUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [forceLoggedOut, setForceLoggedOut] = useState(false);

  // Initialize session timeout (15 minutes of inactivity)
  // Only activate when user is authenticated
  const sessionTimeout = useSessionTimeout();

  const logoutMutation = useMutation({
    mutationFn: () => apiFetch<{ loggedOut: boolean }>('/auth/logout', { method: 'POST' }),
  });

  const currentUser = forceLoggedOut ? null : auth.user;

  useEffect(() => {
    if (auth.user) {
      setForceLoggedOut(false);
    }
  }, [auth.user]);

  const isPrivilegedUser = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN';
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  const accessRequestStatsQuery = useQuery({
    queryKey: ['access-requests', 'stats', 'sidebar'],
    queryFn: () => apiFetch<AccessRequestStatsResponse>('/access-requests/stats'),
    enabled: isSuperAdmin,
    refetchInterval: 30000,
  });

  async function handleLogout() {
    setForceLoggedOut(true);
    try {
      await logoutMutation.mutateAsync();
    } catch {
      // Best-effort logout.
    } finally {
      queryClient.cancelQueries({ queryKey: ['auth', 'me'] });
      queryClient.removeQueries({ queryKey: ['auth', 'me'], exact: true });
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      navigate('/login', { replace: true });
      setMenuOpen(false);
    }
  }

  const baseNavItems: NavItem[] = [
    {
      to: '/dashboard',
      label: 'Dashboard',
      icon: <span className="text-base">◧</span>,
    },
    {
      to: '/analytics',
      label: 'Analytics',
      icon: <span className="text-base">◔</span>,
    },
    {
      to: '/usage',
      label: 'Usage',
      icon: <span className="text-base">◎</span>,
    },
    {
      to: '/entry',
      label: 'Data Entry',
      icon: <span className="text-base">✎</span>,
    },
    {
      to: '/voted',
      label: 'Voted',
      icon: <span className="text-base">✓</span>,
    },
  ];

  const privilegedNavItems: NavItem[] = [
    {
      to: '/profile',
      label: 'Profile',
      icon: <span className="text-base">◉</span>,
    },
    {
      to: '/sub-users',
      label: 'Sub-users',
      icon: <span className="text-base">◌</span>,
    },
    {
      to: '/audit',
      label: 'Audit',
      icon: <span className="text-base">▤</span>,
    },
  ];

  const superAdminNavItems: NavItem[] = [
    {
      to: '/access-requests',
      label: 'Access Requests',
      icon: <span className="text-base">✉</span>,
      badge: accessRequestStatsQuery.data?.pending ?? 0,
    },
  ];

  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
      isActive
        ? 'bg-indigo-50 text-indigo-700'
        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
    }`;

  if (!currentUser) {
    return (
      <div className="min-h-screen text-slate-900">
        <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur">
          <nav className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500" />
              <h1 className="text-base font-semibold sm:text-lg">Voter Management System</h1>
            </div>
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
          </nav>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8">
          <Routes>
            <Route path="/login" element={<LoginPage user={currentUser} />} />
            <Route path="/signup" element={<SignupPage user={currentUser} />} />
            <Route path="/setup-password" element={<SetupPasswordPage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/terms" element={<TermsOfServicePage />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-slate-900">
      <div className="flex min-h-screen">
        <aside className={`hidden flex-col border-r border-slate-200 bg-white transition-all duration-200 md:flex ${sidebarCollapsed ? 'w-20' : 'w-72'}`}>
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-4">
            <div className="flex items-center gap-3 overflow-hidden">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500" />
              {!sidebarCollapsed && (
                <div>
                  <p className="text-sm font-semibold text-slate-900">Voter Management</p>
                  <p className="text-xs text-slate-500">Control Panel</p>
                </div>
              )}
            </div>
            <button
              className="rounded-lg border border-slate-200 p-1.5 text-xs text-slate-600 hover:bg-slate-100"
              onClick={() => setSidebarCollapsed((prev) => !prev)}
              type="button"
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? '→' : '←'}
            </button>
          </div>

          <nav className="flex-1 space-y-1 px-4 py-4">
            {baseNavItems.map((item) => (
              <NavLink key={item.to} className={navItemClass} title={item.label} to={item.to}>
                <span className="inline-flex h-5 w-5 items-center justify-center">{item.icon}</span>
                {!sidebarCollapsed && <span>{item.label}</span>}
              </NavLink>
            ))}
            {isPrivilegedUser && (
              <>
                {privilegedNavItems.map((item) => (
                  <NavLink key={item.to} className={navItemClass} title={item.label} to={item.to}>
                    <span className="inline-flex h-5 w-5 items-center justify-center">{item.icon}</span>
                    {!sidebarCollapsed && <span>{item.label}</span>}
                  </NavLink>
                ))}
              </>
            )}
            {isSuperAdmin && (
              <>
                {superAdminNavItems.map((item) => (
                  <NavLink key={item.to} className={navItemClass} title={item.label} to={item.to}>
                    <span className="inline-flex h-5 w-5 items-center justify-center">{item.icon}</span>
                    {!sidebarCollapsed && (
                      <>
                        <span>{item.label}</span>
                        {item.badge && item.badge > 0 && (
                          <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                ))}
              </>
            )}
          </nav>

          <div className="border-t border-slate-200 px-4 py-4">
            {!sidebarCollapsed && <p className="mb-3 truncate text-xs text-slate-500">Signed in as {currentUser.username}</p>}
            <button
              className={`rounded-xl bg-slate-900 px-3 py-2.5 text-sm text-white disabled:opacity-60 ${sidebarCollapsed ? 'w-auto' : 'w-full'}`}
              onClick={handleLogout}
              type="button"
              disabled={logoutMutation.isPending}
              title="Logout"
            >
              {sidebarCollapsed ? '↗' : logoutMutation.isPending ? 'Logging out...' : 'Logout'}
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur md:hidden">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-500" />
              <h1 className="text-sm font-semibold">Voter Management</h1>
            </div>
            <button
              className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-sm"
              onClick={() => setMenuOpen((prev) => !prev)}
              type="button"
            >
              {menuOpen ? 'Close' : 'Menu'}
            </button>
          </header>

          {menuOpen && (
            <div className="fixed inset-0 z-50 md:hidden">
              <button
                className="absolute inset-0 bg-black/40"
                onClick={() => setMenuOpen(false)}
                type="button"
                aria-label="Close menu"
              />
              <aside className="absolute left-0 top-0 h-full w-72 border-r border-slate-200 bg-white px-4 py-4 shadow-xl">
                <div className="mb-4 flex items-center gap-2">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500" />
                  <div>
                    <p className="text-sm font-semibold">Voter Management</p>
                    <p className="text-xs text-slate-500">Control Panel</p>
                  </div>
                </div>

                <nav className="space-y-1">
                  {baseNavItems.map((item) => (
                    <NavLink key={item.to} className={navItemClass} onClick={() => setMenuOpen(false)} to={item.to}>
                      <span className="inline-flex h-5 w-5 items-center justify-center">{item.icon}</span>
                      <span>{item.label}</span>
                    </NavLink>
                  ))}
                  {isPrivilegedUser && (
                    <>
                      {privilegedNavItems.map((item) => (
                        <NavLink key={item.to} className={navItemClass} onClick={() => setMenuOpen(false)} to={item.to}>
                          <span className="inline-flex h-5 w-5 items-center justify-center">{item.icon}</span>
                          <span>{item.label}</span>
                        </NavLink>
                      ))}
                    </>
                  )}
                  {isSuperAdmin && (
                    <>
                      {superAdminNavItems.map((item) => (
                        <NavLink key={item.to} className={navItemClass} onClick={() => setMenuOpen(false)} to={item.to}>
                          <span className="inline-flex h-5 w-5 items-center justify-center">{item.icon}</span>
                          <span>{item.label}</span>
                          {item.badge && item.badge > 0 && (
                            <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                              {item.badge}
                            </span>
                          )}
                        </NavLink>
                      ))}
                    </>
                  )}
                </nav>

                <div className="mt-6 border-t border-slate-200 pt-4">
                  <p className="mb-3 truncate text-xs text-slate-500">Signed in as {currentUser.username}</p>
                  <button
                    className="w-full rounded-xl bg-slate-900 px-3 py-2.5 text-sm text-white disabled:opacity-60"
                    onClick={handleLogout}
                    type="button"
                    disabled={logoutMutation.isPending}
                  >
                    {logoutMutation.isPending ? 'Logging out...' : 'Logout'}
                  </button>
                </div>
              </aside>
            </div>
          )}

          <main className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-8">
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute isLoading={auth.isLoading} user={auth.user}>
                <Navigate to="/dashboard" replace />
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<LoginPage user={currentUser} />} />
          <Route path="/signup" element={<SignupPage user={currentUser} />} />
          <Route path="/setup-password" element={<SetupPasswordPage />} />
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
                <ZoneDetailsPage currentUser={currentUser} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/voted"
            element={
              <ProtectedRoute isLoading={auth.isLoading} user={auth.user}>
                <VotedPage currentUser={currentUser} />
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
          <Route
            path="/access-requests"
            element={
              <SuperAdminRoute isLoading={auth.isLoading} user={auth.user}>
                <AccessRequestsPage />
              </SuperAdminRoute>
            }
          />
          {/* Legal Pages - Public Access */}
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/terms" element={<TermsOfServicePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
          </main>
        </div>
      </div>
    </div>
  );
}
