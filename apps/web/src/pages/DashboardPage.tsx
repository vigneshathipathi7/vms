import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { apiFetch } from '../services/api';
import { DashboardStatsResponse } from '../types/api';

export function DashboardPage() {
  const currentUser = useCurrentUser();
  const isSuperAdmin = currentUser.user?.role === 'SUPER_ADMIN';
  const [selectedElectionType, setSelectedElectionType] = useState<
    'ALL' | 'LOCAL_BODY' | 'ASSEMBLY' | 'PARLIAMENT'
  >('ALL');

  const electionTypeLabel: Record<'LOCAL_BODY' | 'ASSEMBLY' | 'PARLIAMENT', string> = {
    LOCAL_BODY: 'Local Body',
    ASSEMBLY: 'Assembly',
    PARLIAMENT: 'Parliament',
  };

  const statsQuery = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => apiFetch<DashboardStatsResponse>('/dashboard/stats'),
    refetchInterval: isSuperAdmin ? 5000 : false,
    refetchOnWindowFocus: true,
  });

  if (statsQuery.isLoading) {
    return <p className="text-sm text-slate-600">Loading dashboard...</p>;
  }

  if (statsQuery.isError || !statsQuery.data) {
    return <p className="text-sm text-red-600">Failed to load dashboard stats.</p>;
  }

  const stats = statsQuery.data;
  const filteredSuperAdminVoters =
    selectedElectionType === 'ALL'
      ? stats.superAdminVoters ?? []
      : (stats.superAdminVoters ?? []).filter(
          (voter) => voter.candidate.electionType === selectedElectionType,
        );

  const getHierarchySummary = (voter: NonNullable<DashboardStatsResponse['superAdminVoters']>[number]) => {
    const electionType = voter.candidate.electionType;

    if (electionType === 'LOCAL_BODY') {
      return [
        voter.candidate.district ? `District: ${voter.candidate.district}` : null,
        (voter.taluk?.name || voter.candidate.taluk) ? `Taluk: ${voter.taluk?.name || voter.candidate.taluk}` : null,
        voter.village?.name ? `Village: ${voter.village.name}` : null,
        `Ward: ${voter.ward.wardNumber}`,
      ]
        .filter(Boolean)
        .join(' • ');
    }

    if (electionType === 'ASSEMBLY') {
      return [
        voter.candidate.district ? `District: ${voter.candidate.district}` : null,
        (voter.constituency || voter.candidate.constituency)
          ? `Constituency: ${voter.constituency || voter.candidate.constituency}`
          : null,
        `Ward: ${voter.ward.wardNumber}`,
      ]
        .filter(Boolean)
        .join(' • ');
    }

    return [
      (voter.state || voter.candidate.state) ? `State: ${voter.state || voter.candidate.state}` : null,
      (voter.constituency || voter.candidate.constituency)
        ? `Parliament: ${voter.constituency || voter.candidate.constituency}`
        : null,
      (voter.assemblyConstituency || voter.candidate.assemblyConstituency)
        ? `Assembly: ${voter.assemblyConstituency || voter.candidate.assemblyConstituency}`
        : null,
      `Ward: ${voter.ward.wardNumber}`,
    ]
      .filter(Boolean)
      .join(' • ');
  };

  return (
    <section className="space-y-6">
      <div>
        <div className="mb-3 inline-flex rounded-xl bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
          Overview
        </div>
        <h2 className="text-2xl font-semibold">Dashboard</h2>
        <p className="mt-1 text-sm text-slate-600">
          Zone-wise overview and voter progress.
          {isSuperAdmin ? ' Includes cross-election hierarchy and auto-refreshes every 5 seconds.' : ''}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Total voters</p>
          <p className="mt-1 text-2xl font-semibold">{stats.totals.total}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Voted</p>
          <p className="mt-1 text-2xl font-semibold text-green-700">{stats.totals.voted}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Pending</p>
          <p className="mt-1 text-2xl font-semibold text-orange-700">{stats.totals.pending}</p>
        </article>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {stats.zones.map((entry) => (
          <article key={entry.zone.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="h-2" style={{ backgroundColor: entry.zone.colorHex }} />
            <div className="space-y-2 p-4">
              <h3 className="text-base font-semibold">{entry.zone.name}</h3>
              <div className="grid grid-cols-3 gap-2 text-sm text-slate-600">
                <p>Total: {entry.total}</p>
                <p>Voted: {entry.voted}</p>
                <p>Pending: {entry.pending}</p>
              </div>
              <Link className="inline-block text-sm font-semibold text-indigo-700" to={`/zones/${entry.zone.id}`}>
                View details
              </Link>
            </div>
          </article>
        ))}
      </div>

      {isSuperAdmin && stats.superAdminVoters && (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="mr-2 text-base font-semibold">All voters (all users)</h3>
            <button
              type="button"
              className={`rounded-lg border px-3 py-1 text-xs font-medium ${
                selectedElectionType === 'ALL' ? 'bg-slate-900 text-white' : 'text-slate-700'
              }`}
              onClick={() => setSelectedElectionType('ALL')}
            >
              All
            </button>
            {(['LOCAL_BODY', 'ASSEMBLY', 'PARLIAMENT'] as const).map((type) => (
              <button
                key={type}
                type="button"
                className={`rounded-lg border px-3 py-1 text-xs font-medium ${
                  selectedElectionType === type
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700'
                }`}
                onClick={() => setSelectedElectionType(type)}
              >
                {electionTypeLabel[type]}
              </button>
            ))}
          </div>
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b text-slate-500">
                <th className="px-2 py-2">Voter</th>
                <th className="px-2 py-2">Voter ID</th>
                <th className="px-2 py-2">Contact</th>
                <th className="px-2 py-2">Address</th>
                <th className="px-2 py-2">Election</th>
                <th className="px-2 py-2">Hierarchy</th>
                <th className="px-2 py-2">Candidate</th>
                <th className="px-2 py-2">Zone</th>
                <th className="px-2 py-2">Added By</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {filteredSuperAdminVoters.length === 0 ? (
                <tr>
                  <td className="px-2 py-3 text-slate-500" colSpan={14}>
                    No voters found for selected election type.
                  </td>
                </tr>
              ) : (
                filteredSuperAdminVoters.map((voter) => (
                  <tr key={voter.id} className="border-b last:border-b-0">
                    <td className="px-2 py-2">{voter.name}</td>
                    <td className="px-2 py-2">{voter.voterId}</td>
                    <td className="px-2 py-2">{voter.contactNumber || '-'}</td>
                    <td className="px-2 py-2">{voter.address || '-'}</td>
                    <td className="px-2 py-2">
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                        {electionTypeLabel[voter.candidate.electionType]}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-slate-700">{getHierarchySummary(voter) || '-'}</td>
                    <td className="px-2 py-2">
                      <div className="font-medium">{voter.candidate.fullName}</div>
                      <div className="text-xs text-slate-500">{voter.candidate.contestingFor}</div>
                    </td>
                    <td className="px-2 py-2">{voter.zone.name}</td>
                    <td className="px-2 py-2">
                      {voter.addedBy.fullName || voter.addedBy.username}
                      {voter.addedBy.email ? ` (${voter.addedBy.email})` : ''}
                    </td>
                    <td className="px-2 py-2">{voter.voted ? 'Voted' : 'Not voted'}</td>
                    <td className="px-2 py-2">{new Date(voter.createdAt).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
