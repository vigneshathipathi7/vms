import { useQuery } from '@tanstack/react-query';
import { apiFetch, buildQuery } from '../services/api';
import { AuditVoterAdditionsResponse } from '../types/api';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useState } from 'react';

interface UsageUserScopeItem {
  userId: string;
  username: string;
  fullName: string | null;
  email: string | null;
  candidateId: string;
  candidateName: string;
}

export function AuditPage() {
  const currentUser = useCurrentUser();
  const isSuperAdmin = currentUser.user?.role === 'SUPER_ADMIN';
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>('ALL');

  const candidateScopeQuery =
    isSuperAdmin && selectedCandidateId !== 'ALL'
      ? buildQuery({ candidateId: selectedCandidateId })
      : '';

  const usageUsersQuery = useQuery({
    queryKey: ['usage', 'users', 'audit-selector'],
    queryFn: () => apiFetch<UsageUserScopeItem[]>('/usage/users'),
    enabled: isSuperAdmin,
    refetchInterval: isSuperAdmin ? 5000 : false,
    refetchOnWindowFocus: true,
  });

  const summaryQuery = useQuery({
    queryKey: ['audit', 'voter-additions', selectedCandidateId],
    queryFn: () =>
      apiFetch<AuditVoterAdditionsResponse>(`/audit/voter-additions${candidateScopeQuery}`),
    refetchInterval: isSuperAdmin ? 5000 : false,
    refetchOnWindowFocus: true,
  });

  if (summaryQuery.isLoading) {
    return <p className="text-sm text-slate-600">Loading audit summary...</p>;
  }

  if (summaryQuery.isError || !summaryQuery.data) {
    return <p className="text-sm text-red-600">Failed to load audit summary.</p>;
  }

  const data = summaryQuery.data;

  return (
    <section className="space-y-6">
      <div>
        <div className="mb-3 inline-flex rounded-xl bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
          Admin Insight
        </div>
        <h2 className="text-2xl font-semibold">Audit Log Summary</h2>
        <p className="mt-1 text-sm text-slate-600">
          Admin-only view of who added how many voters.
          {isSuperAdmin ? ' Auto-refreshes every 5 seconds.' : ''}
        </p>
      </div>

      {isSuperAdmin && (
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-base font-semibold">Scope</h3>
            <button
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                selectedCandidateId === 'ALL' ? 'bg-slate-900 text-white' : 'text-slate-700'
              }`}
              type="button"
              onClick={() => setSelectedCandidateId('ALL')}
            >
              All Users
            </button>
          </div>

          {usageUsersQuery.isLoading ? (
            <p className="text-sm text-slate-500">Loading users...</p>
          ) : usageUsersQuery.data && usageUsersQuery.data.length > 0 ? (
            <select
              className="w-full rounded-lg border px-3 py-2 text-sm"
              value={selectedCandidateId}
              onChange={(event) => setSelectedCandidateId(event.target.value)}
            >
              <option value="ALL">All Users</option>
              {usageUsersQuery.data.map((item) => (
                <option key={item.userId} value={item.candidateId}>
                  {item.fullName || item.username} - {item.candidateName}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-slate-500">No users available.</p>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Tracked users</p>
          <p className="mt-1 text-2xl font-semibold">{data.totals.users}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Total voters added</p>
          <p className="mt-1 text-2xl font-semibold">{data.totals.votersAdded}</p>
        </article>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b text-slate-500">
              <th className="px-2 py-2">User</th>
              <th className="px-2 py-2">Role</th>
              <th className="px-2 py-2">Voters Added</th>
              <th className="px-2 py-2">Last Added At</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={item.userId} className="border-b last:border-b-0">
                <td className="px-2 py-2">{item.username}</td>
                <td className="px-2 py-2">{item.role}</td>
                <td className="px-2 py-2">{item.votersAddedCount}</td>
                <td className="px-2 py-2">
                  {item.lastAddedAt ? new Date(item.lastAddedAt).toLocaleString() : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
