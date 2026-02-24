/**
 * Analytics Page
 * ==============
 * 
 * Visual insights into campaign data:
 * - Daily voter additions chart
 * - Sub-user productivity table
 * - Voting progress by zone
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../services/api';

interface DailyVoterData {
  date: string;
  count: number;
}

interface SubUserProductivity {
  userId: string;
  username: string;
  fullName: string | null;
  totalAdded: number;
  votedCount: number;
  conversionRate: number;
}

interface ZoneBreakdown {
  zoneId: string;
  zoneName: string;
  total: number;
  voted: number;
  pending: number;
  percentage: number;
}

interface VotingProgress {
  totalVoters: number;
  totalVoted: number;
  overallPercentage: number;
  zones: ZoneBreakdown[];
}

interface AnalyticsSummary {
  dailyAdditions: DailyVoterData[];
  todayAdditions: number;
  weekAdditions: number;
  monthAdditions: number;
  monthOverMonthGrowth: number;
  totalVoters: number;
  totalVoted: number;
}

interface TopPerformer {
  userId: string;
  username: string;
  fullName: string | null;
  weeklyAdded: number;
  weeklyVoted: number;
}

type DateRange = '7d' | '30d' | '90d' | 'all';

export function AnalyticsPage() {
  const [dateRange, setDateRange] = React.useState<DateRange>('30d');

  const summaryQuery = useQuery({
    queryKey: ['analytics', 'summary'],
    queryFn: () => apiFetch<AnalyticsSummary>('/analytics/summary'),
  });

  const dailyVotersQuery = useQuery({
    queryKey: ['analytics', 'daily-voters', dateRange],
    queryFn: () => apiFetch<DailyVoterData[]>(`/analytics/daily-voters?range=${dateRange}`),
  });

  const productivityQuery = useQuery({
    queryKey: ['analytics', 'subuser-productivity'],
    queryFn: () => apiFetch<SubUserProductivity[]>('/analytics/subuser-productivity'),
  });

  const progressQuery = useQuery({
    queryKey: ['analytics', 'voting-progress'],
    queryFn: () => apiFetch<VotingProgress>('/analytics/voting-progress'),
  });

  const topPerformersQuery = useQuery({
    queryKey: ['analytics', 'top-performers'],
    queryFn: () => apiFetch<TopPerformer[]>('/analytics/top-performers?limit=5'),
  });

  if (summaryQuery.isLoading) {
    return <p className="text-sm text-slate-600">Loading analytics...</p>;
  }

  if (summaryQuery.isError) {
    return <p className="text-sm text-red-600">Failed to load analytics data.</p>;
  }

  const summary = summaryQuery.data;
  const dailyVoters = dailyVotersQuery.data || [];
  const productivity = productivityQuery.data || [];
  const progress = progressQuery.data;
  const topPerformers = topPerformersQuery.data || [];

  // Calculate max for chart scaling
  const maxDaily = Math.max(...dailyVoters.map((d) => d.count), 1);

  return (
    <section className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">Campaign Analytics</h2>
        <p className="mt-1 text-sm text-slate-600">
          Visual insights into your voter data and team performance.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Total Voters</p>
          <p className="text-2xl font-semibold">{summary?.totalVoters.toLocaleString()}</p>
        </article>
        <article className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Total Voted</p>
          <p className="text-2xl font-semibold text-green-700">
            {summary?.totalVoted.toLocaleString()}
          </p>
        </article>
        <article className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Added This Month</p>
          <p className="text-2xl font-semibold">{summary?.monthAdditions?.toLocaleString() ?? 0}</p>
          <p className="text-xs text-slate-500">
            {summary && summary.monthOverMonthGrowth > 0 ? '+' : ''}
            {summary?.monthOverMonthGrowth ?? 0}% vs last month
          </p>
        </article>
        <article className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Added Today</p>
          <p className="text-2xl font-semibold text-blue-700">{summary?.todayAdditions || 0}</p>
        </article>
      </div>

      {/* Daily Additions Chart */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Daily Voter Additions</h3>
          <select
            className="rounded-md border px-3 py-1.5 text-sm"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as DateRange)}
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </select>
        </div>

        {dailyVotersQuery.isLoading ? (
          <p className="mt-4 text-sm text-slate-500">Loading chart...</p>
        ) : (
          <div className="mt-4">
            {/* Simple bar chart */}
            <div className="flex items-end gap-1" style={{ height: 160 }}>
              {dailyVoters.map((day) => (
                <div
                  key={day.date}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 transition-colors rounded-t"
                  style={{
                    height: `${(day.count / maxDaily) * 100}%`,
                    minHeight: day.count > 0 ? 4 : 0,
                  }}
                  title={`${day.date}: ${day.count} voters`}
                />
              ))}
            </div>
            <div className="mt-2 flex justify-between text-xs text-slate-500">
              <span>{dailyVoters[0]?.date}</span>
              <span>{dailyVoters[dailyVoters.length - 1]?.date}</span>
            </div>
          </div>
        )}
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Performers */}
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold">Top Performers This Week</h3>
          {topPerformersQuery.isLoading ? (
            <p className="mt-4 text-sm text-slate-500">Loading...</p>
          ) : topPerformers.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No activity this week.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {topPerformers.map((performer, idx) => (
                <div key={performer.userId} className="flex items-center gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full font-semibold text-white ${
                    idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-slate-400' : idx === 2 ? 'bg-amber-600' : 'bg-slate-300'
                  }`}>
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{performer.fullName || performer.username}</p>
                    <p className="text-xs text-slate-500">
                      {performer.weeklyAdded} added, {performer.weeklyVoted} voted
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Voting Progress by Zone */}
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold">Voting Progress by Zone</h3>
          {progressQuery.isLoading ? (
            <p className="mt-4 text-sm text-slate-500">Loading...</p>
          ) : !progress?.zones?.length ? (
            <p className="mt-4 text-sm text-slate-500">No zones configured.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {/* Overall progress bar */}
              <div>
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Overall Progress</span>
                  <span>{progress?.overallPercentage}%</span>
                </div>
                <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full bg-green-500 transition-all"
                    style={{ width: `${progress?.overallPercentage}%` }}
                  />
                </div>
              </div>
              {/* Zone breakdown */}
              <div className="space-y-2">
                {progress?.zones?.slice(0, 5).map((zone) => (
                  <div key={zone.zoneId} className="flex items-center gap-3">
                    <div className="w-24 truncate text-sm font-medium">{zone.zoneName}</div>
                    <div className="flex-1">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full bg-blue-500"
                          style={{ width: `${zone.percentage}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-xs text-slate-500 w-16 text-right">
                      {zone.voted}/{zone.total}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sub-user Productivity Table */}
      <div className="rounded-xl border bg-white shadow-sm">
        <div className="border-b p-6">
          <h3 className="text-lg font-semibold">Sub-user Productivity</h3>
          <p className="text-sm text-slate-600">Performance metrics for all booth agents.</p>
        </div>
        {productivityQuery.isLoading ? (
          <div className="p-6">
            <p className="text-sm text-slate-500">Loading productivity data...</p>
          </div>
        ) : productivity.length === 0 ? (
          <div className="p-6">
            <p className="text-sm text-slate-500">No sub-users found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-slate-50">
                <tr>
                  <th className="px-6 py-3 font-medium">User</th>
                  <th className="px-6 py-3 font-medium text-right">Voters Added</th>
                  <th className="px-6 py-3 font-medium text-right">Marked Voted</th>
                  <th className="px-6 py-3 font-medium text-right">Conversion Rate</th>
                </tr>
              </thead>
              <tbody>
                {productivity.map((user) => (
                  <tr key={user.userId} className="border-b">
                    <td className="px-6 py-3">
                      <div>
                        <p className="font-medium">{user.fullName || user.username}</p>
                        <p className="text-xs text-slate-500">@{user.username}</p>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-right font-medium">{user.totalAdded}</td>
                    <td className="px-6 py-3 text-right text-green-700">{user.votedCount}</td>
                    <td className="px-6 py-3 text-right">
                      <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                        user.conversionRate >= 50
                          ? 'bg-green-100 text-green-800'
                          : user.conversionRate >= 25
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-slate-100 text-slate-800'
                      }`}>
                        {user.conversionRate}%
                      </span>
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
