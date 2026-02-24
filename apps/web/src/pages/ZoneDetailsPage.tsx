import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { apiFetch, apiFetchBlob, buildQuery } from '../services/api';
import {
  AuthUser,
  Taluk,
  Village,
  Voter,
  Ward,
  ZoneVotersResponse,
  ZonesResponse,
} from '../types/api';

const DEFAULT_CREATE_STATE = {
  name: '',
  contactNumber: '',
  voterId: '',
  talukId: '',
  villageId: '',
  wardId: '',
  address: '',
};

type EditFormState = {
  id: string;
  name: string;
  contactNumber: string;
  voterId: string;
  talukId: string;
  villageId: string;
  wardId: string;
  address: string;
  voted: boolean;
};

export function ZoneDetailsPage({ currentUser }: { currentUser: AuthUser | null }) {
  const { zoneId = '' } = useParams();
  const isAdmin = currentUser?.role === 'ADMIN';
  const queryClient = useQueryClient();

  // Filters
  const [search, setSearch] = useState('');
  const [filterTalukId, setFilterTalukId] = useState('');
  const [filterVillageId, setFilterVillageId] = useState('');
  const [filterWardId, setFilterWardId] = useState('');
  const [address, setAddress] = useState('');
  const [voted, setVoted] = useState<'all' | 'true' | 'false'>('all');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [createState, setCreateState] = useState(DEFAULT_CREATE_STATE);
  const [targetZoneId, setTargetZoneId] = useState('');
  const [openContact, setOpenContact] = useState<Voter | null>(null);
  const [editState, setEditState] = useState<EditFormState | null>(null);

  const debouncedSearch = useDebouncedValue(search, 300);
  const debouncedAddress = useDebouncedValue(address, 300);

  // Location queries for filters
  const taluksQuery = useQuery({
    queryKey: ['locations', 'taluks', 'list'],
    queryFn: () => apiFetch<Taluk[]>('/locations/taluks/list'),
  });

  const filterVillagesQuery = useQuery({
    queryKey: ['locations', 'villages', filterTalukId],
    queryFn: () => apiFetch<Village[]>(`/locations/taluks/${filterTalukId}/villages`),
    enabled: !!filterTalukId,
  });

  const filterWardsQuery = useQuery({
    queryKey: ['locations', 'wards', filterVillageId],
    queryFn: () => apiFetch<Ward[]>(`/locations/villages/${filterVillageId}/wards`),
    enabled: !!filterVillageId,
  });

  // Location queries for create form
  const createVillagesQuery = useQuery({
    queryKey: ['locations', 'villages', createState.talukId],
    queryFn: () => apiFetch<Village[]>(`/locations/taluks/${createState.talukId}/villages`),
    enabled: !!createState.talukId,
  });

  const createWardsQuery = useQuery({
    queryKey: ['locations', 'wards', createState.villageId],
    queryFn: () => apiFetch<Ward[]>(`/locations/villages/${createState.villageId}/wards`),
    enabled: !!createState.villageId,
  });

  // Location queries for edit form
  const editVillagesQuery = useQuery({
    queryKey: ['locations', 'villages', editState?.talukId],
    queryFn: () => apiFetch<Village[]>(`/locations/taluks/${editState?.talukId}/villages`),
    enabled: !!editState?.talukId,
  });

  const editWardsQuery = useQuery({
    queryKey: ['locations', 'wards', editState?.villageId],
    queryFn: () => apiFetch<Ward[]>(`/locations/villages/${editState?.villageId}/wards`),
    enabled: !!editState?.villageId,
  });

  const zoneListQuery = useQuery({
    queryKey: ['zones', 'list'],
    queryFn: () => apiFetch<ZonesResponse>('/zones'),
  });

  const zoneVotersQuery = useQuery({
    queryKey: [
      'zones',
      'voters',
      zoneId,
      debouncedSearch,
      filterTalukId,
      filterVillageId,
      filterWardId,
      debouncedAddress,
      voted,
      page,
    ],
    queryFn: () =>
      apiFetch<ZoneVotersResponse>(
        `/zones/${zoneId}/voters${buildQuery({
          search: debouncedSearch,
          talukId: filterTalukId || undefined,
          villageId: filterVillageId || undefined,
          wardId: filterWardId || undefined,
          address: debouncedAddress,
          voted: voted === 'all' ? undefined : voted,
          page,
          pageSize: 25,
        })}`,
      ),
    enabled: Boolean(zoneId),
    placeholderData: (previous) => previous,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiFetch('/voters', {
        method: 'POST',
        body: JSON.stringify({
          name: createState.name,
          contactNumber: createState.contactNumber,
          voterId: createState.voterId,
          talukId: createState.talukId,
          villageId: createState.villageId,
          wardId: createState.wardId,
          address: createState.address,
          zoneId,
        }),
      }),
    onSuccess: async () => {
      setCreateState(DEFAULT_CREATE_STATE);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['zones', 'voters', zoneId] }),
        queryClient.invalidateQueries({ queryKey: ['zones', 'list'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] }),
      ]);
    },
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editState) {
        throw new Error('No voter selected for edit');
      }

      return apiFetch(`/voters/${editState.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editState.name,
          contactNumber: editState.contactNumber,
          voterId: editState.voterId,
          talukId: editState.talukId,
          villageId: editState.villageId,
          wardId: editState.wardId,
          address: editState.address,
          voted: editState.voted,
        }),
      });
    },
    onSuccess: async () => {
      setEditState(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['zones', 'voters', zoneId] }),
        queryClient.invalidateQueries({ queryKey: ['voters', 'voted'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] }),
        queryClient.invalidateQueries({ queryKey: ['zones', 'list'] }),
        queryClient.invalidateQueries({ queryKey: ['voters', 'entry'] }),
      ]);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (voterId: string) =>
      apiFetch(`/voters/${voterId}`, {
        method: 'DELETE',
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['zones', 'voters', zoneId] }),
        queryClient.invalidateQueries({ queryKey: ['zones', 'list'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] }),
        queryClient.invalidateQueries({ queryKey: ['voters', 'entry'] }),
      ]);
    },
  });

  const markVotedMutation = useMutation({
    mutationFn: (markAsVoted: boolean) =>
      apiFetch('/voters/bulk/mark-voted', {
        method: 'POST',
        body: JSON.stringify({ voterIds: selectedIds, voted: markAsVoted }),
      }),
    onSuccess: async () => {
      setSelectedIds([]);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['zones', 'voters', zoneId] }),
        queryClient.invalidateQueries({ queryKey: ['voters', 'voted'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] }),
        queryClient.invalidateQueries({ queryKey: ['zones', 'list'] }),
      ]);
    },
  });

  const moveZoneMutation = useMutation({
    mutationFn: () =>
      apiFetch('/voters/bulk/move-zone', {
        method: 'POST',
        body: JSON.stringify({ voterIds: selectedIds, targetZoneId }),
      }),
    onSuccess: async () => {
      setSelectedIds([]);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['zones', 'voters', zoneId] }),
        queryClient.invalidateQueries({ queryKey: ['zones', 'list'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] }),
      ]);
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: () =>
      apiFetch('/voters/bulk/delete', {
        method: 'POST',
        body: JSON.stringify({ voterIds: selectedIds }),
      }),
    onSuccess: async () => {
      setSelectedIds([]);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['zones', 'voters', zoneId] }),
        queryClient.invalidateQueries({ queryKey: ['zones', 'list'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] }),
      ]);
    },
  });

  const exportMutation = useMutation({
    mutationFn: () =>
      apiFetchBlob(
        `/voters/export.csv${buildQuery({
          zoneId,
          search: debouncedSearch,
          talukId: filterTalukId || undefined,
          villageId: filterVillageId || undefined,
          wardId: filterWardId || undefined,
          address: debouncedAddress,
          voted: voted === 'all' ? undefined : voted,
        })}`,
      ),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `zone-${zoneId}-voters.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    },
  });

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const taluks = taluksQuery.data ?? [];
  const filterVillages = filterVillagesQuery.data ?? [];
  const filterWards = filterWardsQuery.data ?? [];
  const createVillages = createVillagesQuery.data ?? [];
  const createWards = createWardsQuery.data ?? [];
  const editVillages = editVillagesQuery.data ?? [];
  const editWards = editWardsQuery.data ?? [];

  if (!zoneVotersQuery.data && zoneVotersQuery.isPending) {
    return <p className="text-sm text-slate-600">Loading zone details...</p>;
  }

  if (zoneVotersQuery.isError || !zoneVotersQuery.data) {
    return <p className="text-sm text-red-600">Failed to load zone details.</p>;
  }

  const data = zoneVotersQuery.data;

  function onCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createMutation.mutate();
  }

  function onEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateMutation.mutate();
  }

  function toggleSelection(voterId: string) {
    setSelectedIds((prev) =>
      prev.includes(voterId) ? prev.filter((value) => value !== voterId) : [...prev, voterId],
    );
  }

  function toggleAll() {
    if (selectedIds.length === data.items.length) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(data.items.map((item) => item.id));
  }

  function openEdit(voter: Voter) {
    setEditState({
      id: voter.id,
      name: voter.name,
      contactNumber: voter.contactNumber,
      voterId: voter.voterId,
      talukId: voter.talukId ?? '',
      villageId: voter.villageId ?? '',
      wardId: voter.wardId,
      address: voter.address,
      voted: voter.voted,
    });
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-xl bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
          Zone Operations
        </div>
        <h2 className="text-2xl font-semibold">{data.zone.name}</h2>
        <span
          className="rounded-full px-3 py-1 text-xs font-medium text-white"
          style={{ backgroundColor: data.zone.colorHex }}
        >
          {data.zone.type}
        </span>
        {zoneVotersQuery.isFetching && <span className="text-xs text-slate-500">Refreshing...</span>}
      </div>

      {/* Filter Form */}
      <form
        className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-7"
        onSubmit={(event) => event.preventDefault()}
      >
        <input
          className="rounded-xl border px-3 py-2.5 text-sm"
          value={search}
          onChange={(event) => {
            setPage(1);
            setSearch(event.target.value);
          }}
          placeholder="Search name / voter ID"
        />
        <select
          className="rounded-xl border px-3 py-2.5 text-sm"
          value={filterTalukId}
          onChange={(event) => {
            setPage(1);
            setFilterTalukId(event.target.value);
            setFilterVillageId('');
            setFilterWardId('');
          }}
        >
          <option value="">All Taluks</option>
          {taluks.map((taluk) => (
            <option key={taluk.id} value={taluk.id}>
              {taluk.name}
            </option>
          ))}
        </select>
        <select
          className="rounded-xl border px-3 py-2.5 text-sm"
          value={filterVillageId}
          onChange={(event) => {
            setPage(1);
            setFilterVillageId(event.target.value);
            setFilterWardId('');
          }}
          disabled={!filterTalukId}
        >
          <option value="">{filterTalukId ? 'All Villages' : 'Select Taluk first'}</option>
          {filterVillages.map((village) => (
            <option key={village.id} value={village.id}>
              {village.name}
            </option>
          ))}
        </select>
        <select
          className="rounded-xl border px-3 py-2.5 text-sm"
          value={filterWardId}
          onChange={(event) => {
            setPage(1);
            setFilterWardId(event.target.value);
          }}
          disabled={!filterVillageId}
        >
          <option value="">{filterVillageId ? 'All Wards' : 'Select Village first'}</option>
          {filterWards.map((ward) => (
            <option key={ward.id} value={ward.id}>
              Ward {ward.wardNumber}
            </option>
          ))}
        </select>
        <input
          className="rounded-xl border px-3 py-2.5 text-sm"
          value={address}
          onChange={(event) => {
            setPage(1);
            setAddress(event.target.value);
          }}
          placeholder="Filter address"
        />
        <select
          className="rounded-xl border px-3 py-2.5 text-sm"
          value={voted}
          onChange={(event) => {
            setPage(1);
            setVoted(event.target.value as 'all' | 'true' | 'false');
          }}
        >
          <option value="all">All statuses</option>
          <option value="true">Voted</option>
          <option value="false">Not voted</option>
        </select>
        {isAdmin && (
          <button
            className="rounded-xl border px-3 py-2.5 text-sm"
            type="button"
            onClick={() => exportMutation.mutate()}
          >
            Export CSV
          </button>
        )}
      </form>

      {/* Voters Table */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button className="rounded-xl border px-3 py-1.5 text-sm" type="button" onClick={toggleAll}>
            {selectedIds.length === data.items.length ? 'Unselect all' : 'Select all'}
          </button>
          <button
            className="rounded-xl bg-green-600 px-3 py-1.5 text-sm text-white disabled:opacity-60"
            type="button"
            disabled={selectedIds.length === 0 || markVotedMutation.isPending}
            onClick={() => markVotedMutation.mutate(true)}
          >
            Mark voted ({selectedIds.length})
          </button>
          <button
            className="rounded-xl bg-yellow-600 px-3 py-1.5 text-sm text-white disabled:opacity-60"
            type="button"
            disabled={selectedIds.length === 0 || markVotedMutation.isPending}
            onClick={() => markVotedMutation.mutate(false)}
          >
            Mark not voted
          </button>

          {isAdmin && (
            <>
              <select
                className="rounded-xl border px-3 py-1.5 text-sm"
                value={targetZoneId}
                onChange={(event) => setTargetZoneId(event.target.value)}
              >
                <option value="">Move to zone...</option>
                {(zoneListQuery.data?.items ?? [])
                  .filter((item) => item.id !== zoneId)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
              <button
                className="rounded-xl bg-orange-500 px-3 py-1.5 text-sm text-white disabled:opacity-60"
                type="button"
                disabled={selectedIds.length === 0 || !targetZoneId || moveZoneMutation.isPending}
                onClick={() => moveZoneMutation.mutate()}
              >
                Move selected
              </button>
              <button
                className="rounded-xl bg-red-600 px-3 py-1.5 text-sm text-white disabled:opacity-60"
                type="button"
                disabled={selectedIds.length === 0 || bulkDeleteMutation.isPending}
                onClick={() => bulkDeleteMutation.mutate()}
              >
                Delete selected
              </button>
            </>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b text-slate-500">
                <th className="px-2 py-2" />
                <th className="px-2 py-2">Name</th>
                <th className="px-2 py-2">Voter ID</th>
                <th className="px-2 py-2">Taluk</th>
                <th className="px-2 py-2">Village</th>
                <th className="px-2 py-2">Ward</th>
                <th className="px-2 py-2">Address</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Added by</th>
                <th className="px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id} className="border-b last:border-b-0">
                  <td className="px-2 py-2">
                    <input
                      type="checkbox"
                      checked={selectedSet.has(item.id)}
                      onChange={() => toggleSelection(item.id)}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <button className="text-blue-700" type="button" onClick={() => setOpenContact(item)}>
                      {item.name}
                    </button>
                  </td>
                  <td className="px-2 py-2">{item.voterId}</td>
                  <td className="px-2 py-2">{item.taluk?.name ?? '-'}</td>
                  <td className="px-2 py-2">{item.village?.name ?? '-'}</td>
                  <td className="px-2 py-2">{item.ward?.wardNumber ? `Ward ${item.ward.wardNumber}` : '-'}</td>
                  <td className="px-2 py-2">{item.address}</td>
                  <td className="px-2 py-2">{item.voted ? 'Voted' : 'Not voted'}</td>
                  <td className="px-2 py-2">{item.addedBy.username}</td>
                  <td className="px-2 py-2">
                    <div className="flex gap-2">
                      <button className="rounded border px-2 py-0.5 text-xs" type="button" onClick={() => openEdit(item)}>
                        Edit
                      </button>
                      {isAdmin && (
                        <button
                          className="rounded border border-red-300 px-2 py-0.5 text-xs text-red-700"
                          type="button"
                          onClick={() => deleteMutation.mutate(item.id)}
                          disabled={deleteMutation.isPending}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Page {data.pagination.page} / {data.pagination.totalPages} (total {data.pagination.total})
          </p>
          <div className="flex gap-2">
            <button
              className="rounded-xl border px-3 py-1.5 text-sm disabled:opacity-60"
              type="button"
              disabled={data.pagination.page <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              Prev
            </button>
            <button
              className="rounded-xl border px-3 py-1.5 text-sm disabled:opacity-60"
              type="button"
              disabled={data.pagination.page >= data.pagination.totalPages}
              onClick={() => setPage((prev) => prev + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Contact Modal */}
      {openContact && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-md space-y-3 rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold">{openContact.name}</h3>
            <dl className="grid gap-2 text-sm">
              <div className="flex gap-2">
                <dt className="text-slate-500">Contact:</dt>
                <dd className="font-medium">{openContact.contactNumber}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-slate-500">Voter ID:</dt>
                <dd>{openContact.voterId}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-slate-500">Taluk:</dt>
                <dd>{openContact.taluk?.name ?? '-'}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-slate-500">Village:</dt>
                <dd>{openContact.village?.name ?? '-'}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-slate-500">Ward:</dt>
                <dd>{openContact.ward?.wardNumber ? `Ward ${openContact.ward.wardNumber}` : '-'}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-slate-500">Address:</dt>
                <dd>{openContact.address}</dd>
              </div>
            </dl>
            <button
              className="rounded-xl border px-3 py-2.5 text-sm"
              type="button"
              onClick={() => setOpenContact(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editState && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-black/40 p-4">
          <form className="w-full max-w-2xl space-y-3 rounded-2xl bg-white p-5 shadow-xl" onSubmit={onEditSubmit}>
            <h3 className="text-lg font-semibold">Edit voter</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <input
                className="rounded-xl border px-3 py-2.5 text-sm"
                value={editState.name}
                onChange={(event) => setEditState((prev) => (prev ? { ...prev, name: event.target.value } : prev))}
                placeholder="Name"
                required
              />
              <input
                className="rounded-xl border px-3 py-2.5 text-sm"
                value={editState.contactNumber}
                onChange={(event) =>
                  setEditState((prev) => (prev ? { ...prev, contactNumber: event.target.value } : prev))
                }
                placeholder="Contact"
                required
              />
              <input
                className="rounded-xl border px-3 py-2.5 text-sm"
                value={editState.voterId}
                onChange={(event) => setEditState((prev) => (prev ? { ...prev, voterId: event.target.value } : prev))}
                placeholder="Voter ID"
                required
              />
              <select
                className="rounded-xl border px-3 py-2.5 text-sm"
                value={editState.talukId}
                onChange={(event) =>
                  setEditState((prev) =>
                    prev ? { ...prev, talukId: event.target.value, villageId: '', wardId: '' } : prev,
                  )
                }
                required
              >
                <option value="">Taluk</option>
                {taluks.map((taluk) => (
                  <option key={taluk.id} value={taluk.id}>
                    {taluk.name}
                  </option>
                ))}
              </select>
              <select
                className="rounded-xl border px-3 py-2.5 text-sm"
                value={editState.villageId}
                onChange={(event) =>
                  setEditState((prev) =>
                    prev ? { ...prev, villageId: event.target.value, wardId: '' } : prev,
                  )
                }
                required
                disabled={!editState.talukId}
              >
                <option value="">{editState.talukId ? 'Village' : 'Taluk first'}</option>
                {editVillages.map((village) => (
                  <option key={village.id} value={village.id}>
                    {village.name}
                  </option>
                ))}
              </select>
              <select
                className="rounded-xl border px-3 py-2.5 text-sm"
                value={editState.wardId}
                onChange={(event) =>
                  setEditState((prev) => (prev ? { ...prev, wardId: event.target.value } : prev))
                }
                required
                disabled={!editState.villageId}
              >
                <option value="">{editState.villageId ? 'Ward' : 'Village first'}</option>
                {editWards.map((ward) => (
                  <option key={ward.id} value={ward.id}>
                    Ward {ward.wardNumber}
                  </option>
                ))}
              </select>
              <input
                className="rounded-xl border px-3 py-2.5 text-sm"
                value={editState.address}
                onChange={(event) => setEditState((prev) => (prev ? { ...prev, address: event.target.value } : prev))}
                placeholder="Address"
                required
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editState.voted}
                  onChange={(event) =>
                    setEditState((prev) => (prev ? { ...prev, voted: event.target.checked } : prev))
                  }
                />
                Mark as voted
              </label>
            </div>
            <div className="flex gap-2">
              <button
                className="rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-medium text-white disabled:opacity-60"
                type="submit"
                disabled={updateMutation.isPending}
              >
                Save changes
              </button>
              <button
                className="rounded-xl border px-3 py-2.5 text-sm"
                type="button"
                onClick={() => setEditState(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
