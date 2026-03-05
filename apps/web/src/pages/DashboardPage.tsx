import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { apiFetch } from '../services/api';
import { DashboardStatsResponse, SubUsersResponse } from '../types/api';

export function DashboardPage() {
  const currentUser = useCurrentUser();
  const isSuperAdmin = currentUser.user?.role === 'SUPER_ADMIN';
  const [selectedAdminId, setSelectedAdminId] = useState<string>('ALL');
  const [selectedAreaSecretaryId, setSelectedAreaSecretaryId] = useState<string>('ALL');
  const [selectedWardMemberId, setSelectedWardMemberId] = useState<string>('ALL');
  const [selectedVolunteerId, setSelectedVolunteerId] = useState<string>('ALL');

  const statsQuery = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => apiFetch<DashboardStatsResponse>('/dashboard/stats'),
    refetchInterval: isSuperAdmin ? 5000 : false,
    refetchOnWindowFocus: true,
  });

  const subUsersQuery = useQuery({
    queryKey: ['users', 'sub-users', 'dashboard-superadmin-scope'],
    queryFn: () => apiFetch<SubUsersResponse>('/users/sub-users'),
    enabled: isSuperAdmin,
  });

  if (statsQuery.isLoading) {
    return <p className="text-sm text-slate-600">Loading dashboard...</p>;
  }

  if (statsQuery.isError || !statsQuery.data) {
    return <p className="text-sm text-red-600">Failed to load dashboard stats.</p>;
  }

  const stats = statsQuery.data;
  const allUsers = subUsersQuery.data?.items ?? [];
  const admins = allUsers.filter((item) => item.role === 'ADMIN');
  const areaSecretaries = allUsers.filter(
    (item) => item.role === 'SUB_ADMIN' && item.parentUserId === selectedAdminId,
  );
  const wardMembers = allUsers.filter(
    (item) => item.role === 'SUB_USER' && item.parentUserId === selectedAreaSecretaryId,
  );
  const volunteers = allUsers.filter(
    (item) => item.role === 'VOLUNTEER' && item.parentUserId === selectedWardMemberId,
  );

  const selectedFocusUserId = selectedVolunteerId !== 'ALL'
    ? selectedVolunteerId
    : selectedWardMemberId !== 'ALL'
      ? selectedWardMemberId
      : selectedAreaSecretaryId !== 'ALL'
        ? selectedAreaSecretaryId
        : selectedAdminId !== 'ALL'
          ? selectedAdminId
          : null;

  const descendantIdsByUser = new Map<string, string[]>();
  if (allUsers.length > 0) {
    const childrenByParent = new Map<string, string[]>();
    allUsers.forEach((item) => {
      if (!item.parentUserId) {
        return;
      }
      const list = childrenByParent.get(item.parentUserId) ?? [];
      list.push(item.id);
      childrenByParent.set(item.parentUserId, list);
    });

    const getDescendants = (rootId: string): string[] => {
      const cached = descendantIdsByUser.get(rootId);
      if (cached) {
        return cached;
      }

      const result: string[] = [rootId];
      const queue: string[] = [rootId];

      while (queue.length > 0) {
        const current = queue.shift();
        if (!current) {
          continue;
        }
        const children = childrenByParent.get(current) ?? [];
        children.forEach((childId) => {
          result.push(childId);
          queue.push(childId);
        });
      }

      descendantIdsByUser.set(rootId, result);
      return result;
    };

    allUsers.forEach((item) => {
      getDescendants(item.id);
    });
  }

  const superAdminVoters = stats.superAdminVoters ?? [];
  const scopedSuperAdminVoters = selectedFocusUserId
    ? superAdminVoters.filter((voter) =>
        (descendantIdsByUser.get(selectedFocusUserId) ?? [selectedFocusUserId]).includes(voter.addedBy.id),
      )
    : superAdminVoters;

  const totalCount = isSuperAdmin ? scopedSuperAdminVoters.length : stats.totals.total;
  const pendingCount = isSuperAdmin
    ? scopedSuperAdminVoters.filter((voter) => !voter.voted).length
    : stats.totals.pending;
  const votedCount = isSuperAdmin ? totalCount - pendingCount : stats.totals.voted;

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
          <p className="mt-1 text-2xl font-semibold">{totalCount}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Voted</p>
          <p className="mt-1 text-2xl font-semibold text-green-700">{votedCount}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Pending</p>
          <p className="mt-1 text-2xl font-semibold text-orange-700">{pendingCount}</p>
        </article>
      </div>

      {isSuperAdmin && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">4-Level Hierarchy Scope</h3>
            {(selectedAdminId !== 'ALL' || selectedAreaSecretaryId !== 'ALL' || selectedWardMemberId !== 'ALL' || selectedVolunteerId !== 'ALL') && (
              <button
                type="button"
                className="rounded-lg border px-2 py-1 text-xs font-medium text-slate-700"
                onClick={() => {
                  setSelectedAdminId('ALL');
                  setSelectedAreaSecretaryId('ALL');
                  setSelectedWardMemberId('ALL');
                  setSelectedVolunteerId('ALL');
                }}
              >
                Reset
              </button>
            )}
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <select
              className="rounded-xl border px-3 py-2.5 text-sm"
              value={selectedAdminId}
              onChange={(event) => {
                setSelectedAdminId(event.target.value);
                setSelectedAreaSecretaryId('ALL');
                setSelectedWardMemberId('ALL');
                setSelectedVolunteerId('ALL');
              }}
            >
              <option value="ALL">All Candidates</option>
              {admins.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.fullName || item.username}
                </option>
              ))}
            </select>

            <select
              className="rounded-xl border px-3 py-2.5 text-sm"
              value={selectedAreaSecretaryId}
              onChange={(event) => {
                setSelectedAreaSecretaryId(event.target.value);
                setSelectedWardMemberId('ALL');
                setSelectedVolunteerId('ALL');
              }}
              disabled={selectedAdminId === 'ALL'}
            >
              <option value="ALL">All Area Secretaries</option>
              {areaSecretaries.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.fullName || item.username}
                </option>
              ))}
            </select>

            <select
              className="rounded-xl border px-3 py-2.5 text-sm"
              value={selectedWardMemberId}
              onChange={(event) => {
                setSelectedWardMemberId(event.target.value);
                setSelectedVolunteerId('ALL');
              }}
              disabled={selectedAreaSecretaryId === 'ALL'}
            >
              <option value="ALL">All Ward Members</option>
              {wardMembers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.fullName || item.username}
                </option>
              ))}
            </select>

            <select
              className="rounded-xl border px-3 py-2.5 text-sm"
              value={selectedVolunteerId}
              onChange={(event) => setSelectedVolunteerId(event.target.value)}
              disabled={selectedWardMemberId === 'ALL'}
            >
              <option value="ALL">All Volunteers</option>
              {volunteers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.fullName || item.username}
                </option>
              ))}
            </select>
          </div>
          <div className="text-sm text-slate-600">
            Scoped voters: <span className="font-semibold text-slate-900">{scopedSuperAdminVoters.length}</span>
          </div>
        </div>
      )}

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

      {isSuperAdmin && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold">All Voters</h3>
              <p className="text-sm text-slate-600">View full voter list in a dedicated page with filters.</p>
            </div>
            <Link
              to="/superadmin/voters"
              className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white"
            >
              Open All Voters
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
