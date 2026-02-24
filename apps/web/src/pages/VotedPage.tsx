import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { apiFetch, apiFetchBlob, buildQuery } from '../services/api';
import { AuthUser, VotersResponse } from '../types/api';

export function VotedPage({ currentUser }: { currentUser: AuthUser | null }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const votedQuery = useQuery({
    queryKey: ['voters', 'voted', search, page],
    queryFn: () =>
      apiFetch<VotersResponse>(
        `/voters/voted${buildQuery({
          search,
          page,
          pageSize: 25,
        })}`,
      ),
    placeholderData: (previous) => previous,
  });

  const exportMutation = useMutation({
    mutationFn: () => apiFetchBlob(`/voters/export.csv${buildQuery({ voted: 'true', search })}`),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'voted-voters.csv';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    },
  });

  const unvoteMutation = useMutation({
    mutationFn: () =>
      apiFetch('/voters/bulk/mark-voted', {
        method: 'POST',
        body: JSON.stringify({ voterIds: selectedIds, voted: false }),
      }),
    onSuccess: async () => {
      setSelectedIds([]);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['voters', 'voted'] }),
        queryClient.invalidateQueries({ queryKey: ['zones', 'voters'] }),
        queryClient.invalidateQueries({ queryKey: ['zones', 'list'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] }),
      ]);
    },
  });

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  if (!votedQuery.data && votedQuery.isLoading) {
    return <p className="text-sm text-slate-600">Loading voted voters...</p>;
  }

  if (votedQuery.isError || !votedQuery.data) {
    return <p className="text-sm text-red-600">Failed to load voted list.</p>;
  }

  const data = votedQuery.data;

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

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-semibold">Voted Voters</h2>
        {currentUser?.role === 'ADMIN' && (
          <button
            className="rounded-md border px-3 py-1 text-sm"
            type="button"
            onClick={() => exportMutation.mutate()}
          >
            Export CSV
          </button>
        )}
        {votedQuery.isFetching && <span className="text-xs text-slate-500">Refreshing...</span>}
      </div>

      <input
        className="w-full rounded-md border bg-white px-3 py-2 text-sm"
        placeholder="Search name / voter ID"
        value={search}
        onChange={(event) => {
          setPage(1);
          setSearch(event.target.value);
        }}
      />

      <div className="overflow-x-auto rounded-xl border bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button className="rounded-md border px-3 py-1 text-sm" type="button" onClick={toggleAll}>
            {selectedIds.length === data.items.length ? 'Unselect all' : 'Select all'}
          </button>
          <button
            className="rounded-md bg-yellow-600 px-3 py-1 text-sm text-white disabled:opacity-60"
            type="button"
            disabled={selectedIds.length === 0 || unvoteMutation.isPending}
            onClick={() => unvoteMutation.mutate()}
          >
            Mark not voted ({selectedIds.length})
          </button>
        </div>

        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b text-slate-500">
              <th className="px-2 py-2" />
              <th className="px-2 py-2">Name</th>
              <th className="px-2 py-2">Voter ID</th>
              <th className="px-2 py-2">Zone</th>
              <th className="px-2 py-2">Taluk</th>
              <th className="px-2 py-2">Village</th>
              <th className="px-2 py-2">Ward</th>
              <th className="px-2 py-2">Address</th>
              <th className="px-2 py-2">Added by</th>
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
                <td className="px-2 py-2">{item.name}</td>
                <td className="px-2 py-2">{item.voterId}</td>
                <td className="px-2 py-2">{item.zone.name}</td>
                <td className="px-2 py-2">{item.taluk?.name ?? '-'}</td>
                <td className="px-2 py-2">{item.village?.name ?? '-'}</td>
                <td className="px-2 py-2">{item.ward?.wardNumber ? `Ward ${item.ward.wardNumber}` : '-'}</td>
                <td className="px-2 py-2">{item.address}</td>
                <td className="px-2 py-2">{item.addedBy.username}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Page {data.pagination.page} / {data.pagination.totalPages} (total {data.pagination.total})
          </p>
          <div className="flex gap-2">
            <button
              className="rounded-md border px-3 py-1 text-sm disabled:opacity-60"
              type="button"
              disabled={data.pagination.page <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              Prev
            </button>
            <button
              className="rounded-md border px-3 py-1 text-sm disabled:opacity-60"
              type="button"
              disabled={data.pagination.page >= data.pagination.totalPages}
              onClick={() => setPage((prev) => prev + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
