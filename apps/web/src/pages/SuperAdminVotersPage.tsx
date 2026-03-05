import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { apiFetch } from '../services/api';
import { DashboardStatsResponse, ElectionType, SubUsersResponse } from '../types/api';

export function SuperAdminVotersPage() {
  const [selectedElectionType, setSelectedElectionType] = useState<'ALL' | ElectionType>('ALL');
  const [selectedAdminId, setSelectedAdminId] = useState<string>('ALL');
  const [selectedAreaSecretaryId, setSelectedAreaSecretaryId] = useState<string>('ALL');
  const [selectedWardMemberId, setSelectedWardMemberId] = useState<string>('ALL');
  const [selectedVolunteerId, setSelectedVolunteerId] = useState<string>('ALL');

  const electionTypeLabel: Record<ElectionType, string> = {
    LOCAL_BODY: 'Local Body',
    ASSEMBLY: 'Assembly',
    PARLIAMENT: 'Parliament',
  };

  const statsQuery = useQuery({
    queryKey: ['dashboard', 'stats', 'superadmin-voters'],
    queryFn: () => apiFetch<DashboardStatsResponse>('/dashboard/stats'),
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  const subUsersQuery = useQuery({
    queryKey: ['users', 'sub-users', 'superadmin-voters-scope'],
    queryFn: () => apiFetch<SubUsersResponse>('/users/sub-users'),
  });

  const users = subUsersQuery.data?.items ?? [];

  const descendantIdsByUser = useMemo(() => {
    const map = new Map<string, string[]>();
    const childrenByParent = new Map<string, string[]>();

    users.forEach((item) => {
      if (!item.parentUserId) {
        return;
      }
      const list = childrenByParent.get(item.parentUserId) ?? [];
      list.push(item.id);
      childrenByParent.set(item.parentUserId, list);
    });

    const getDescendants = (rootId: string): string[] => {
      const cached = map.get(rootId);
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

      map.set(rootId, result);
      return result;
    };

    users.forEach((item) => {
      getDescendants(item.id);
    });

    return map;
  }, [users]);

  if (statsQuery.isLoading) {
    return <p className="text-sm text-slate-600">Loading voters...</p>;
  }

  if (statsQuery.isError || !statsQuery.data) {
    return <p className="text-sm text-red-600">Failed to load voters.</p>;
  }

  const voters = statsQuery.data.superAdminVoters ?? [];

  const admins = users.filter((item) => item.role === 'ADMIN');
  const areaSecretaries = users.filter(
    (item) => item.role === 'SUB_ADMIN' && item.parentUserId === selectedAdminId,
  );
  const wardMembers = users.filter(
    (item) => item.role === 'SUB_USER' && item.parentUserId === selectedAreaSecretaryId,
  );
  const volunteers = users.filter(
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

  const hierarchyScopedVoters = selectedFocusUserId
    ? voters.filter((voter) =>
        (descendantIdsByUser.get(selectedFocusUserId) ?? [selectedFocusUserId]).includes(voter.addedBy.id),
      )
    : voters;

  const filteredVoters = selectedElectionType === 'ALL'
    ? hierarchyScopedVoters
    : hierarchyScopedVoters.filter((voter) => voter.candidate.electionType === selectedElectionType);

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
          Super Admin
        </div>
        <h2 className="text-2xl font-semibold">All Voters</h2>
        <p className="mt-1 text-sm text-slate-600">Global voters list with 4-level hierarchy drill-down.</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <h3 className="text-base font-semibold">Hierarchy Scope</h3>
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
              <option key={item.id} value={item.id}>{item.fullName || item.username}</option>
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
              <option key={item.id} value={item.id}>{item.fullName || item.username}</option>
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
              <option key={item.id} value={item.id}>{item.fullName || item.username}</option>
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
              <option key={item.id} value={item.id}>{item.fullName || item.username}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="mr-2 text-base font-semibold">All voters</h3>
          <button
            type="button"
            className={`rounded-lg border px-3 py-1 text-xs font-medium ${
              selectedElectionType === 'ALL' ? 'bg-slate-900 text-white' : 'text-slate-700'
            }`}
            onClick={() => setSelectedElectionType('ALL')}
          >
            All
          </button>
          {(['ASSEMBLY'] as const).map((type) => (
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
            {filteredVoters.length === 0 ? (
              <tr>
                <td className="px-2 py-3 text-slate-500" colSpan={11}>
                  No voters found for selected scope.
                </td>
              </tr>
            ) : (
              filteredVoters.map((voter) => (
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
    </section>
  );
}
