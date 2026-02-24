import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiFetch } from '../services/api';
import { DashboardStatsResponse } from '../types/api';

export function DashboardPage() {
  const statsQuery = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => apiFetch<DashboardStatsResponse>('/dashboard/stats'),
  });

  if (statsQuery.isLoading) {
    return <p className="text-sm text-slate-600">Loading dashboard...</p>;
  }

  if (statsQuery.isError || !statsQuery.data) {
    return <p className="text-sm text-red-600">Failed to load dashboard stats.</p>;
  }

  const stats = statsQuery.data;

  return (
    <section className="space-y-6">
      <div>
        <div className="mb-3 inline-flex rounded-xl bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
          Overview
        </div>
        <h2 className="text-2xl font-semibold">Dashboard</h2>
        <p className="mt-1 text-sm text-slate-600">Zone-wise overview and voter progress.</p>
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
    </section>
  );
}
