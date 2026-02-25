/**
 * Usage Page
 * ==========
 * 
 * Resource usage dashboard for monitoring and limits:
 * - Current usage summary
 * - Plan limits and warnings
 * - Export history
 * - Historical usage trends
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch, buildQuery } from '../services/api';
import { useCurrentUser } from '../hooks/useCurrentUser';

interface UsageSummary {
  totalVoters: number;
  totalVoted: number;
  totalPending: number;
  totalSubUsers: number;
  exportsThisMonth: number;
  votersAddedThisMonth: number;
  storageGrowthPercent: number;
}

interface UsageLimits {
  maxVoters: number;
  maxSubUsers: number;
  maxExportsPerMonth: number;
  voterUsagePercent: number;
  subUserUsagePercent: number;
  exportUsagePercent: number;
  warnings: string[];
}

interface UsageSnapshot {
  month: string;
  totalVoters: number;
  totalExports: number;
  totalUsers: number;
}

interface ExportRecord {
  id: string;
  action: string;
  exportedBy: string;
  timestamp: string;
  metadata: unknown;
}

interface UsageUserScopeItem {
  userId: string;
  username: string;
  fullName: string | null;
  email: string | null;
  candidateId: string;
  candidateName: string;
  totalSubUsers: number;
  totalVoters: number;
  totalVoted: number;
}

export function UsagePage() {
  const currentUser = useCurrentUser();
  const isSuperAdmin = currentUser.user?.role === 'SUPER_ADMIN';
  const [selectedCandidateId, setSelectedCandidateId] = React.useState<string>('ALL');

  const selectedCandidateQuery =
    isSuperAdmin && selectedCandidateId !== 'ALL'
      ? buildQuery({ candidateId: selectedCandidateId })
      : '';

  const usageUsersQuery = useQuery({
    queryKey: ['usage', 'users'],
    queryFn: () => apiFetch<UsageUserScopeItem[]>('/usage/users'),
    enabled: isSuperAdmin,
    refetchInterval: isSuperAdmin ? 5000 : false,
    refetchOnWindowFocus: true,
  });

  const summaryQuery = useQuery({
    queryKey: ['usage', 'summary', selectedCandidateId],
    queryFn: () => apiFetch<UsageSummary>(`/usage/summary${selectedCandidateQuery}`),
    refetchInterval: isSuperAdmin ? 5000 : false,
    refetchOnWindowFocus: true,
  });

  const limitsQuery = useQuery({
    queryKey: ['usage', 'limits', selectedCandidateId],
    queryFn: () => apiFetch<UsageLimits>(`/usage/limits${selectedCandidateQuery}`),
    refetchInterval: isSuperAdmin ? 5000 : false,
    refetchOnWindowFocus: true,
  });

  const historyQuery = useQuery({
    queryKey: ['usage', 'history', selectedCandidateId],
    queryFn: () => apiFetch<UsageSnapshot[]>(`/usage/history${selectedCandidateQuery}`),
    refetchInterval: isSuperAdmin ? 5000 : false,
    refetchOnWindowFocus: true,
  });

  const exportsQuery = useQuery({
    queryKey: ['usage', 'exports', selectedCandidateId],
    queryFn: () => apiFetch<ExportRecord[]>(`/usage/exports${selectedCandidateQuery}`),
    refetchInterval: isSuperAdmin ? 5000 : false,
    refetchOnWindowFocus: true,
  });

  if (summaryQuery.isLoading || limitsQuery.isLoading) {
    return <p className="text-sm text-slate-600">Loading usage data...</p>;
  }

  if (summaryQuery.isError || limitsQuery.isError) {
    return <p className="text-sm text-red-600">Failed to load usage data.</p>;
  }

  const summary = summaryQuery.data;
  const limits = limitsQuery.data;
  const history = historyQuery.data || [];
  const exports = exportsQuery.data || [];

  return (
    <section className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">Resource Usage</h2>
        <p className="mt-1 text-sm text-slate-600">
          Monitor your resource consumption and plan limits.
          {isSuperAdmin ? ' Auto-refreshes every 5 seconds.' : ''}
        </p>
      </div>

      {isSuperAdmin && (
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold">User Scope (Admin + Sub-users)</h3>
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
          ) : !(usageUsersQuery.data && usageUsersQuery.data.length > 0) ? (
            <p className="text-sm text-slate-500">No admin users available.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b text-slate-500">
                  <tr>
                    <th className="px-2 py-2">User</th>
                    <th className="px-2 py-2">Candidate</th>
                    <th className="px-2 py-2">Sub-users</th>
                    <th className="px-2 py-2">Voters</th>
                    <th className="px-2 py-2">Voted</th>
                    <th className="px-2 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {usageUsersQuery.data.map((item) => (
                    <tr key={item.userId} className="border-b last:border-b-0">
                      <td className="px-2 py-2">
                        {item.fullName || item.username}
                        {item.email ? <span className="ml-1 text-xs text-slate-500">({item.email})</span> : null}
                      </td>
                      <td className="px-2 py-2">{item.candidateName}</td>
                      <td className="px-2 py-2">{item.totalSubUsers}</td>
                      <td className="px-2 py-2">{item.totalVoters.toLocaleString()}</td>
                      <td className="px-2 py-2">{item.totalVoted.toLocaleString()}</td>
                      <td className="px-2 py-2">
                        <button
                          className={`rounded-lg border px-3 py-1 text-xs font-medium ${
                            selectedCandidateId === item.candidateId
                              ? 'bg-indigo-600 text-white'
                              : 'text-slate-700'
                          }`}
                          type="button"
                          onClick={() => setSelectedCandidateId(item.candidateId)}
                        >
                          View Usage
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Warnings */}
      {limits?.warnings && limits.warnings.length > 0 && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
          <h3 className="font-semibold text-yellow-800">⚠️ Usage Warnings</h3>
          <ul className="mt-2 list-inside list-disc text-sm text-yellow-700">
            {limits.warnings.map((warning, idx) => (
              <li key={idx}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Usage Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* Voters Usage */}
        <article className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-600">Voter Storage</p>
            <span className="text-xs text-slate-500">
              {limits?.voterUsagePercent}% used
            </span>
          </div>
          <p className="mt-2 text-3xl font-semibold">
            {summary?.totalVoters.toLocaleString()}
          </p>
          <p className="text-sm text-slate-500">of {limits?.maxVoters.toLocaleString()} max</p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-full transition-all ${
                (limits?.voterUsagePercent ?? 0) >= 90
                  ? 'bg-red-500'
                  : (limits?.voterUsagePercent ?? 0) >= 75
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(limits?.voterUsagePercent ?? 0, 100)}%` }}
            />
          </div>
        </article>

        {/* Sub-users Usage */}
        <article className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-600">Sub-users</p>
            <span className="text-xs text-slate-500">
              {limits?.subUserUsagePercent}% used
            </span>
          </div>
          <p className="mt-2 text-3xl font-semibold">{summary?.totalSubUsers}</p>
          <p className="text-sm text-slate-500">of {limits?.maxSubUsers} max</p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-full transition-all ${
                (limits?.subUserUsagePercent ?? 0) >= 90
                  ? 'bg-red-500'
                  : (limits?.subUserUsagePercent ?? 0) >= 75
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(limits?.subUserUsagePercent ?? 0, 100)}%` }}
            />
          </div>
        </article>

        {/* Exports Usage */}
        <article className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-600">Monthly Exports</p>
            <span className="text-xs text-slate-500">
              {limits?.exportUsagePercent}% used
            </span>
          </div>
          <p className="mt-2 text-3xl font-semibold">{summary?.exportsThisMonth}</p>
          <p className="text-sm text-slate-500">of {limits?.maxExportsPerMonth} max</p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-full transition-all ${
                (limits?.exportUsagePercent ?? 0) >= 90
                  ? 'bg-red-500'
                  : (limits?.exportUsagePercent ?? 0) >= 75
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(limits?.exportUsagePercent ?? 0, 100)}%` }}
            />
          </div>
        </article>

        {/* Voted */}
        <article className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-600">Total Voted</p>
          </div>
          <p className="mt-2 text-3xl font-semibold text-green-700">
            {summary?.totalVoted.toLocaleString()}
          </p>
          <p className="text-sm text-slate-500">Voters marked as voted</p>
        </article>

        {/* Pending */}
        <article className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-600">Total Pending</p>
          </div>
          <p className="mt-2 text-3xl font-semibold text-orange-700">
            {summary?.totalPending.toLocaleString()}
          </p>
          <p className="text-sm text-slate-500">Voters not yet marked voted</p>
        </article>
      </div>

      {/* Growth Stats */}
      <div className="grid gap-4 sm:grid-cols-2">
        <article className="rounded-xl border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-600">Added This Month</p>
          <p className="mt-2 text-3xl font-semibold text-blue-700">
            +{summary?.votersAddedThisMonth.toLocaleString()}
          </p>
          <p className="text-sm text-slate-500">
            {summary && summary.storageGrowthPercent > 0 ? '+' : ''}
            {summary?.storageGrowthPercent}% growth rate
          </p>
        </article>
        <article className="rounded-xl border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-600">Plan Status</p>
          <p className="mt-2 text-xl font-semibold text-green-700">Active</p>
          <p className="text-sm text-slate-500">Free tier - No billing required</p>
        </article>
      </div>

      {/* Historical Usage */}
      {history.length > 0 && (
        <div className="rounded-xl border bg-white shadow-sm">
          <div className="border-b p-6">
            <h3 className="text-lg font-semibold">Usage History</h3>
            <p className="text-sm text-slate-600">Monthly snapshots of your resource usage.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-slate-50">
                <tr>
                  <th className="px-6 py-3 font-medium">Month</th>
                  <th className="px-6 py-3 font-medium text-right">Total Voters</th>
                  <th className="px-6 py-3 font-medium text-right">Exports</th>
                  <th className="px-6 py-3 font-medium text-right">Users</th>
                </tr>
              </thead>
              <tbody>
                {history.map((snapshot) => (
                  <tr key={snapshot.month} className="border-b">
                    <td className="px-6 py-3 font-medium">{snapshot.month}</td>
                    <td className="px-6 py-3 text-right">
                      {snapshot.totalVoters.toLocaleString()}
                    </td>
                    <td className="px-6 py-3 text-right">{snapshot.totalExports}</td>
                    <td className="px-6 py-3 text-right">{snapshot.totalUsers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Exports */}
      <div className="rounded-xl border bg-white shadow-sm">
        <div className="border-b p-6">
          <h3 className="text-lg font-semibold">Recent Exports</h3>
          <p className="text-sm text-slate-600">History of data exports from your account.</p>
        </div>
        {exportsQuery.isLoading ? (
          <div className="p-6">
            <p className="text-sm text-slate-500">Loading exports...</p>
          </div>
        ) : exports.length === 0 ? (
          <div className="p-6">
            <p className="text-sm text-slate-500">No exports yet this month.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-slate-50">
                <tr>
                  <th className="px-6 py-3 font-medium">Type</th>
                  <th className="px-6 py-3 font-medium">Exported By</th>
                  <th className="px-6 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {exports.slice(0, 10).map((record) => (
                  <tr key={record.id} className="border-b">
                    <td className="px-6 py-3">
                      <span className="inline-block rounded bg-slate-100 px-2 py-0.5 text-xs font-medium">
                        {record.action === 'CSV_EXPORTED' ? 'Voter CSV' : 'Audit Log'}
                      </span>
                    </td>
                    <td className="px-6 py-3">{record.exportedBy}</td>
                    <td className="px-6 py-3 text-slate-500">
                      {new Date(record.timestamp).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
