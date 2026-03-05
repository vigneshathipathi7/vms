import { useQuery } from '@tanstack/react-query';
import { apiFetch, buildQuery } from '../services/api';
import { AuditVoterAdditionsResponse } from '../types/api';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useState } from 'react';
import { SubUsersResponse } from '../types/api';

export function AuditPage() {
  const currentUser = useCurrentUser();
  const isSuperAdmin = currentUser.user?.role === 'SUPER_ADMIN';
  const isAdmin = currentUser.user?.role === 'ADMIN';
  const isSubAdmin = currentUser.user?.role === 'SUB_ADMIN';
  const [selectedAdminId, setSelectedAdminId] = useState<string>('ALL');
  const [selectedFocusUserId, setSelectedFocusUserId] = useState<string>('ALL');
  const [selectedAreaSecretaryId, setSelectedAreaSecretaryId] = useState<string>('ALL');
  const [selectedWardMemberId, setSelectedWardMemberId] = useState<string>('ALL');
  const [selectedVolunteerId, setSelectedVolunteerId] = useState<string>('ALL');

  const subUsersQuery = useQuery({
    queryKey: ['users', 'sub-users', 'audit-scope'],
    queryFn: () => apiFetch<SubUsersResponse>('/users/sub-users'),
    enabled: isSubAdmin || isAdmin || isSuperAdmin,
  });

  const superAdminAdminOptions = (subUsersQuery.data?.items ?? []).filter(
    (item) => item.role === 'ADMIN',
  );

  const areaSecretaryOptions = isSuperAdmin
    ? (subUsersQuery.data?.items ?? []).filter(
        (item) => item.role === 'SUB_ADMIN' && item.parentUserId === selectedAdminId,
      )
    : (subUsersQuery.data?.items ?? []).filter(
        (item) => item.role === 'SUB_ADMIN' && (!currentUser.user?.id || item.parentUserId === currentUser.user.id),
      );

  const wardMemberOptions = isSuperAdmin || isAdmin
    ? (subUsersQuery.data?.items ?? []).filter(
        (item) => item.role === 'SUB_USER' && item.parentUserId === selectedAreaSecretaryId,
      )
    : (subUsersQuery.data?.items ?? []).filter(
        (item) => item.role === 'SUB_USER' && item.parentUserId === currentUser.user?.id,
      );

  const volunteerOptions = (subUsersQuery.data?.items ?? []).filter(
    (item) => item.role === 'VOLUNTEER' && item.parentUserId === selectedWardMemberId,
  );

  const effectiveFocusUserId = isSuperAdmin
    ? selectedVolunteerId !== 'ALL'
      ? selectedVolunteerId
      : selectedWardMemberId !== 'ALL'
        ? selectedWardMemberId
        : selectedAreaSecretaryId !== 'ALL'
          ? selectedAreaSecretaryId
          : selectedAdminId !== 'ALL'
            ? selectedAdminId
            : undefined
    : isAdmin
      ? selectedWardMemberId !== 'ALL'
        ? selectedWardMemberId
        : selectedAreaSecretaryId !== 'ALL'
          ? selectedAreaSecretaryId
          : undefined
      : isSubAdmin && selectedFocusUserId !== 'ALL'
        ? selectedFocusUserId
        : undefined;

  const queryScope = {
    focusUserId: effectiveFocusUserId,
  };

  const scopeQuery = buildQuery(queryScope);

  const summaryQuery = useQuery({
    queryKey: ['audit', 'voter-additions', selectedAdminId, selectedFocusUserId, selectedAreaSecretaryId, selectedWardMemberId, selectedVolunteerId],
    queryFn: () =>
      apiFetch<AuditVoterAdditionsResponse>(`/audit/voter-additions${scopeQuery}`),
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
  const hierarchyUsers = subUsersQuery.data?.items ?? [];
  const parentByUserId = new Map(hierarchyUsers.map((item) => [item.id, item.parentUserId]));

  const areaSecretaryCountByAdmin = new Map<string, number>();
  const wardMemberCountByAreaSecretary = new Map<string, number>();
  const volunteerCountByWardMember = new Map<string, number>();

  hierarchyUsers.forEach((item) => {
    if (item.role === 'SUB_ADMIN' && item.parentUserId) {
      areaSecretaryCountByAdmin.set(
        item.parentUserId,
        (areaSecretaryCountByAdmin.get(item.parentUserId) ?? 0) + 1,
      );
    }
    if (item.role === 'SUB_USER' && item.parentUserId) {
      wardMemberCountByAreaSecretary.set(
        item.parentUserId,
        (wardMemberCountByAreaSecretary.get(item.parentUserId) ?? 0) + 1,
      );
    }
    if (item.role === 'VOLUNTEER' && item.parentUserId) {
      volunteerCountByWardMember.set(
        item.parentUserId,
        (volunteerCountByWardMember.get(item.parentUserId) ?? 0) + 1,
      );
    }
  });

  const tableItems = isSuperAdmin
    ? selectedVolunteerId !== 'ALL'
      ? data.items.filter((item) => item.userId === selectedVolunteerId)
      : selectedWardMemberId !== 'ALL'
        ? data.items.filter(
            (item) => item.role === 'VOLUNTEER' && parentByUserId.get(item.userId) === selectedWardMemberId,
          )
        : selectedAreaSecretaryId !== 'ALL'
          ? data.items.filter(
              (item) => item.role === 'SUB_USER' && parentByUserId.get(item.userId) === selectedAreaSecretaryId,
            )
          : selectedAdminId !== 'ALL'
            ? data.items.filter(
                (item) => item.role === 'SUB_ADMIN' && parentByUserId.get(item.userId) === selectedAdminId,
              )
            : data.items.filter((item) => item.role === 'ADMIN')
    : data.items;

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
          {selectedVolunteerId !== 'ALL' ? (
            <div className="flex items-center justify-between rounded-xl bg-indigo-50 px-3 py-2 text-sm text-indigo-700">
              <span>
                Showing volunteers under: {volunteerOptions.find((item) => item.id === selectedVolunteerId)?.fullName
                  || volunteerOptions.find((item) => item.id === selectedVolunteerId)?.username
                  || 'Selected User'}
              </span>
              <button
                className="rounded-lg border border-indigo-200 bg-white px-2 py-1 text-xs font-medium text-indigo-700"
                type="button"
                onClick={() => setSelectedVolunteerId('ALL')}
              >
                Back to volunteers
              </button>
            </div>
          ) : selectedWardMemberId !== 'ALL' ? (
            <div>
              <div className="mb-3 flex items-center justify-between rounded-xl bg-indigo-50 px-3 py-2 text-sm text-indigo-700">
                <span>
                  Showing volunteers under ward member: {wardMemberOptions.find((item) => item.id === selectedWardMemberId)?.fullName
                    || wardMemberOptions.find((item) => item.id === selectedWardMemberId)?.username
                    || 'Selected User'}
                </span>
                <button
                  className="rounded-lg border border-indigo-200 bg-white px-2 py-1 text-xs font-medium text-indigo-700"
                  type="button"
                  onClick={() => {
                    setSelectedWardMemberId('ALL');
                    setSelectedVolunteerId('ALL');
                  }}
                >
                  Back to ward members
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {volunteerOptions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="rounded-lg border px-3 py-1.5 text-sm text-indigo-700 hover:bg-indigo-50"
                    onClick={() => setSelectedVolunteerId(item.id)}
                  >
                    {item.fullName || item.username}
                  </button>
                ))}
              </div>
            </div>
          ) : selectedAreaSecretaryId !== 'ALL' ? (
            <div>
              <div className="mb-3 flex items-center justify-between rounded-xl bg-indigo-50 px-3 py-2 text-sm text-indigo-700">
                <span>
                  Showing ward members under area secretary: {areaSecretaryOptions.find((item) => item.id === selectedAreaSecretaryId)?.fullName
                    || areaSecretaryOptions.find((item) => item.id === selectedAreaSecretaryId)?.username
                    || 'Selected User'}
                </span>
                <button
                  className="rounded-lg border border-indigo-200 bg-white px-2 py-1 text-xs font-medium text-indigo-700"
                  type="button"
                  onClick={() => {
                    setSelectedAreaSecretaryId('ALL');
                    setSelectedWardMemberId('ALL');
                    setSelectedVolunteerId('ALL');
                  }}
                >
                  Back to area secretaries
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {wardMemberOptions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="rounded-lg border px-3 py-1.5 text-sm text-indigo-700 hover:bg-indigo-50"
                    onClick={() => {
                      setSelectedWardMemberId(item.id);
                      setSelectedVolunteerId('ALL');
                    }}
                  >
                    {item.fullName || item.username}
                  </button>
                ))}
              </div>
            </div>
          ) : selectedAdminId !== 'ALL' ? (
            <div>
              <div className="mb-3 flex items-center justify-between rounded-xl bg-indigo-50 px-3 py-2 text-sm text-indigo-700">
                <span>
                  Showing area secretaries under admin: {superAdminAdminOptions.find((item) => item.id === selectedAdminId)?.fullName
                    || superAdminAdminOptions.find((item) => item.id === selectedAdminId)?.username
                    || 'Selected User'}
                </span>
                <button
                  className="rounded-lg border border-indigo-200 bg-white px-2 py-1 text-xs font-medium text-indigo-700"
                  type="button"
                  onClick={() => {
                    setSelectedAdminId('ALL');
                    setSelectedAreaSecretaryId('ALL');
                    setSelectedWardMemberId('ALL');
                    setSelectedVolunteerId('ALL');
                  }}
                >
                  Back to admins
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {areaSecretaryOptions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="rounded-lg border px-3 py-1.5 text-sm text-indigo-700 hover:bg-indigo-50"
                    onClick={() => {
                      setSelectedAreaSecretaryId(item.id);
                      setSelectedWardMemberId('ALL');
                      setSelectedVolunteerId('ALL');
                    }}
                  >
                    {item.fullName || item.username}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <h3 className="mb-2 text-base font-semibold">Admin Scope</h3>
              <div className="flex flex-wrap gap-2">
                {superAdminAdminOptions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="rounded-lg border px-3 py-1.5 text-sm text-indigo-700 hover:bg-indigo-50"
                    onClick={() => {
                      setSelectedAdminId(item.id);
                      setSelectedAreaSecretaryId('ALL');
                      setSelectedWardMemberId('ALL');
                      setSelectedVolunteerId('ALL');
                    }}
                  >
                    {item.fullName || item.username}
                  </button>
                ))}
                {subUsersQuery.isLoading && <p className="text-sm text-slate-500">Loading admins...</p>}
                {!subUsersQuery.isLoading && superAdminAdminOptions.length === 0 && (
                  <p className="text-sm text-slate-500">No admins found.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {isAdmin && (
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          {selectedWardMemberId !== 'ALL' ? (
            <div className="flex items-center justify-between rounded-xl bg-indigo-50 px-3 py-2 text-sm text-indigo-700">
              <span>
                Showing volunteers under ward member:{' '}
                {wardMemberOptions.find((item) => item.id === selectedWardMemberId)?.fullName
                  || wardMemberOptions.find((item) => item.id === selectedWardMemberId)?.username
                  || 'Selected User'}
              </span>
              <button
                className="rounded-lg border border-indigo-200 bg-white px-2 py-1 text-xs font-medium text-indigo-700"
                type="button"
                onClick={() => setSelectedWardMemberId('ALL')}
              >
                Back to ward members
              </button>
            </div>
          ) : selectedAreaSecretaryId !== 'ALL' ? (
            <div>
              <div className="mb-3 flex items-center justify-between rounded-xl bg-indigo-50 px-3 py-2 text-sm text-indigo-700">
                <span>
                  Showing ward members under area secretary:{' '}
                  {areaSecretaryOptions.find((item) => item.id === selectedAreaSecretaryId)?.fullName
                    || areaSecretaryOptions.find((item) => item.id === selectedAreaSecretaryId)?.username
                    || 'Selected User'}
                </span>
                <button
                  className="rounded-lg border border-indigo-200 bg-white px-2 py-1 text-xs font-medium text-indigo-700"
                  type="button"
                  onClick={() => {
                    setSelectedAreaSecretaryId('ALL');
                    setSelectedWardMemberId('ALL');
                  }}
                >
                  Back to area secretaries
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {wardMemberOptions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="rounded-lg border px-3 py-1.5 text-sm text-indigo-700 hover:bg-indigo-50"
                    onClick={() => setSelectedWardMemberId(item.id)}
                  >
                    {item.fullName || item.username}
                  </button>
                ))}
                {wardMemberOptions.length === 0 && (
                  <p className="text-sm text-slate-500">No ward members found under this area secretary.</p>
                )}
              </div>
            </div>
          ) : (
            <div>
              <h3 className="mb-2 text-base font-semibold">Area Secretary Scope</h3>
              <div className="flex flex-wrap gap-2">
                {areaSecretaryOptions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="rounded-lg border px-3 py-1.5 text-sm text-indigo-700 hover:bg-indigo-50"
                    onClick={() => {
                      setSelectedAreaSecretaryId(item.id);
                      setSelectedWardMemberId('ALL');
                    }}
                  >
                    {item.fullName || item.username}
                  </button>
                ))}
                {subUsersQuery.isLoading && <p className="text-sm text-slate-500">Loading area secretaries...</p>}
                {!subUsersQuery.isLoading && areaSecretaryOptions.length === 0 && (
                  <p className="text-sm text-slate-500">No area secretaries found.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {isSubAdmin && (
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-base font-semibold">Ward Member Scope</h3>
            <button
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                selectedFocusUserId === 'ALL' ? 'bg-slate-900 text-white' : 'text-slate-700'
              }`}
              type="button"
              onClick={() => setSelectedFocusUserId('ALL')}
            >
              All Ward Members
            </button>
          </div>

          {subUsersQuery.isLoading ? (
            <p className="text-sm text-slate-500">Loading ward members...</p>
          ) : wardMemberOptions.length > 0 ? (
            <select
              className="w-full rounded-lg border px-3 py-2 text-sm"
              value={selectedFocusUserId}
              onChange={(event) => setSelectedFocusUserId(event.target.value)}
            >
              <option value="ALL">All Ward Members</option>
              {wardMemberOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.fullName || item.username}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-slate-500">No ward members found.</p>
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
            {tableItems.map((item) => (
              <tr key={item.userId} className="border-b last:border-b-0">
                <td className="px-2 py-2">
                  {isSuperAdmin && selectedAdminId === 'ALL' && item.role === 'ADMIN' ? (
                    <button
                      type="button"
                      className="text-left text-indigo-700 hover:underline"
                      onClick={() => {
                        setSelectedAdminId(item.userId);
                        setSelectedAreaSecretaryId('ALL');
                        setSelectedWardMemberId('ALL');
                        setSelectedVolunteerId('ALL');
                      }}
                    >
                      {item.username}
                      <span className="ml-1 text-xs text-slate-500">
                        ({areaSecretaryCountByAdmin.get(item.userId) ?? 0} area secretaries)
                      </span>
                    </button>
                  ) : isSuperAdmin && selectedAdminId !== 'ALL' && selectedAreaSecretaryId === 'ALL' && item.role === 'SUB_ADMIN' ? (
                    <button
                      type="button"
                      className="text-left text-indigo-700 hover:underline"
                      onClick={() => {
                        setSelectedAreaSecretaryId(item.userId);
                        setSelectedWardMemberId('ALL');
                        setSelectedVolunteerId('ALL');
                      }}
                    >
                      {item.username}
                      <span className="ml-1 text-xs text-slate-500">
                        ({wardMemberCountByAreaSecretary.get(item.userId) ?? 0} ward members)
                      </span>
                    </button>
                  ) : isSuperAdmin && selectedAreaSecretaryId !== 'ALL' && selectedWardMemberId === 'ALL' && item.role === 'SUB_USER' ? (
                    <button
                      type="button"
                      className="text-left text-indigo-700 hover:underline"
                      onClick={() => {
                        setSelectedWardMemberId(item.userId);
                        setSelectedVolunteerId('ALL');
                      }}
                    >
                      {item.username}
                      <span className="ml-1 text-xs text-slate-500">
                        ({volunteerCountByWardMember.get(item.userId) ?? 0} volunteers)
                      </span>
                    </button>
                  ) : (
                    item.username
                  )}
                </td>
                <td className="px-2 py-2">{item.role}</td>
                <td className="px-2 py-2">{item.votersAddedCount}</td>
                <td className="px-2 py-2">
                  {item.lastAddedAt ? new Date(item.lastAddedAt).toLocaleString() : '-'}
                </td>
              </tr>
            ))}
            {tableItems.length === 0 && (
              <tr>
                <td className="px-2 py-3 text-slate-500" colSpan={4}>
                  {isSuperAdmin
                    ? selectedVolunteerId !== 'ALL'
                      ? 'No audit rows found for selected volunteer.'
                      : selectedWardMemberId !== 'ALL'
                        ? 'No volunteers found under selected ward member.'
                        : selectedAreaSecretaryId !== 'ALL'
                          ? 'No ward members found under selected area secretary.'
                          : selectedAdminId !== 'ALL'
                            ? 'No area secretaries found under selected admin.'
                            : 'No admins found.'
                    : 'No audit rows found.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
