import { useMutation, useQueryClient } from '@tanstack/react-query';
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

function ProtectedRoute({
  isLoading,
  user,
  children,
}: {
  isLoading: boolean;
  user: { role: 'ADMIN' | 'SUB_USER' } | null;
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
  user: { role: 'ADMIN' | 'SUB_USER' } | null;
  children: JSX.Element;
}) {
  if (isLoading) {
    return <p className="text-sm text-slate-600">Loading...</p>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'ADMIN') {
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
  user: { role: 'ADMIN' | 'SUB_USER' } | null;
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
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b bg-white">
        <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-6 py-4">
          <h1 className="mr-2 text-lg font-semibold">Voter Management System</h1>

          {auth.user ? (
            <>
              <Link className="text-sm text-blue-700" to="/profile">
                Profile
              </Link>
              <Link className="text-sm text-blue-700" to="/dashboard">
                Dashboard
              </Link>
              <Link className="text-sm text-blue-700" to="/entry">
                Data Entry
              </Link>
              <Link className="text-sm text-blue-700" to="/voted">
                Voted
              </Link>
              {auth.user.role === 'ADMIN' && (
                <>
                  <Link className="text-sm text-blue-700" to="/sub-users">
                    Sub-users
                  </Link>
                  <Link className="text-sm text-blue-700" to="/audit">
                    Audit
                  </Link>
                  <Link className="text-sm text-blue-700" to="/analytics">
                    Analytics
                  </Link>
                </>
              )}
              <button
                className="ml-auto rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-60"
                onClick={handleLogout}
                type="button"
                disabled={logoutMutation.isPending}
              >
                {logoutMutation.isPending ? 'Logging out...' : `Logout (${auth.user.username})`}
              </button>
            </>
          ) : (
            <div className="ml-auto flex items-center gap-4">
              <Link className="text-sm text-blue-700" to="/login">
                Login
              </Link>
              <Link
                className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white"
                to="/signup"
              >
                Request Access
              </Link>
            </div>
          )}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute isLoading={auth.isLoading} user={auth.user}>
                <Navigate to="/profile" replace />
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
