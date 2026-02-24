import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch, ApiError } from '../services/api';
import {
  AccessRequest,
  AccessRequestsResponse,
  AccessRequestStatsResponse,
} from '../types/api';

type StatusFilter = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';

function extractErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.payload && typeof error.payload === 'object') {
    const value = (error.payload as { message?: unknown }).message;
    if (typeof value === 'string') {
      return value;
    }
    if (Array.isArray(value)) {
      return value.join(', ');
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Request failed';
}

function StatusBadge({ status }: { status: AccessRequest['status'] }) {
  const styles = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    APPROVED: 'bg-green-100 text-green-800',
    REJECTED: 'bg-red-100 text-red-800',
  };

  return (
    <span className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${styles[status]}`}>
      {status}
    </span>
  );
}

function RequestCard({
  request,
  onAction,
  isLoading,
}: {
  request: AccessRequest;
  onAction: (id: string, action: 'APPROVE' | 'REJECT', notes?: string) => void;
  isLoading: boolean;
}) {
  const [showNotes, setShowNotes] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');

  const handleAction = (action: 'APPROVE' | 'REJECT') => {
    onAction(request.id, action, adminNotes || undefined);
    setShowNotes(false);
    setAdminNotes('');
  };

  return (
    <article className="rounded-lg border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{request.fullName}</h3>
          <p className="text-sm text-slate-500">{request.email}</p>
        </div>
        <StatusBadge status={request.status} />
      </div>

      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <span className="text-slate-500">Phone:</span>{' '}
          <span className="text-slate-900">{request.phone}</span>
        </div>
        <div>
          <span className="text-slate-500">District:</span>{' '}
          <span className="text-slate-900">{request.district}</span>
        </div>
        <div>
          <span className="text-slate-500">Constituency:</span>{' '}
          <span className="font-medium text-slate-900">{request.constituency}</span>
        </div>
        {request.requestedTaluks && request.requestedTaluks.length > 0 && (
          <div>
            <span className="text-slate-500">Requested Taluks:</span>{' '}
            <span className="text-slate-900">{request.requestedTaluks.join(', ')}</span>
          </div>
        )}
        <div>
          <span className="text-slate-500">Election Type:</span>{' '}
          <span className="text-slate-900">{request.electionType}</span>
        </div>
        <div>
          <span className="text-slate-500">Contesting For:</span>{' '}
          <span className="text-slate-900">{request.contestingFor}</span>
        </div>
        {request.partyName && (
          <div>
            <span className="text-slate-500">Party:</span>{' '}
            <span className="text-slate-900">{request.partyName}</span>
          </div>
        )}
      </div>

      {request.reason && (
        <div className="mt-3">
          <span className="text-sm text-slate-500">Reason:</span>
          <p className="mt-1 text-sm text-slate-700">{request.reason}</p>
        </div>
      )}

      <div className="mt-3 text-xs text-slate-400">
        Submitted: {new Date(request.createdAt).toLocaleString()}
      </div>

      {request.status !== 'PENDING' && (
        <div className="mt-3 rounded-md bg-slate-50 p-3 text-sm">
          <p>
            <span className="text-slate-500">Reviewed:</span>{' '}
            {request.reviewedAt && new Date(request.reviewedAt).toLocaleString()}
            {request.reviewedBy && ` by ${request.reviewedBy.username}`}
          </p>
          {request.adminNotes && (
            <p className="mt-1">
              <span className="text-slate-500">Notes:</span> {request.adminNotes}
            </p>
          )}
        </div>
      )}

      {request.status === 'PENDING' && (
        <div className="mt-4 border-t pt-4">
          {showNotes ? (
            <div className="space-y-3">
              <textarea
                className="w-full rounded-md border px-3 py-2 text-sm"
                rows={2}
                placeholder="Admin notes (optional)"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
              />
              <div className="flex gap-2">
                <button
                  className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  onClick={() => handleAction('APPROVE')}
                  disabled={isLoading}
                >
                  Approve
                </button>
                <button
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  onClick={() => handleAction('REJECT')}
                  disabled={isLoading}
                >
                  Reject
                </button>
                <button
                  className="rounded-md border px-4 py-2 text-sm font-medium text-slate-600"
                  onClick={() => setShowNotes(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white"
                onClick={() => handleAction('APPROVE')}
                disabled={isLoading}
              >
                Quick Approve
              </button>
              <button
                className="rounded-md border px-4 py-2 text-sm font-medium text-slate-600"
                onClick={() => setShowNotes(true)}
              >
                Review with Notes
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export function AccessRequestsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('PENDING');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const statsQuery = useQuery({
    queryKey: ['access-requests', 'stats'],
    queryFn: () => apiFetch<AccessRequestStatsResponse>('/access-requests/stats'),
  });

  const requestsQuery = useQuery({
    queryKey: ['access-requests', statusFilter],
    queryFn: () => {
      const params = statusFilter === 'ALL' ? '' : `?status=${statusFilter}`;
      return apiFetch<AccessRequestsResponse>(`/access-requests${params}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      action,
      adminNotes,
    }: {
      id: string;
      action: 'APPROVE' | 'REJECT';
      adminNotes?: string;
    }) =>
      apiFetch(`/access-requests/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action, adminNotes }),
      }),
    onSuccess: () => {
      setErrorMessage(null);
      queryClient.invalidateQueries({ queryKey: ['access-requests'] });
    },
    onError: (error) => {
      setErrorMessage(extractErrorMessage(error));
    },
  });

  const handleAction = (id: string, action: 'APPROVE' | 'REJECT', adminNotes?: string) => {
    updateMutation.mutate({ id, action, adminNotes });
  };

  const stats = statsQuery.data;
  const requests = requestsQuery.data?.items ?? [];

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Access Requests</h2>
        <p className="mt-1 text-sm text-slate-600">
          Review and manage new user access requests.
        </p>
      </div>

      {errorMessage && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{errorMessage}</p>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-4">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`rounded-xl border p-4 text-left transition ${
              statusFilter === 'ALL' ? 'border-slate-900 bg-slate-50' : 'bg-white'
            }`}
          >
            <p className="text-sm text-slate-500">Total</p>
            <p className="text-2xl font-semibold">{stats.total}</p>
          </button>
          <button
            onClick={() => setStatusFilter('PENDING')}
            className={`rounded-xl border p-4 text-left transition ${
              statusFilter === 'PENDING' ? 'border-yellow-500 bg-yellow-50' : 'bg-white'
            }`}
          >
            <p className="text-sm text-slate-500">Pending</p>
            <p className="text-2xl font-semibold text-yellow-700">{stats.pending}</p>
          </button>
          <button
            onClick={() => setStatusFilter('APPROVED')}
            className={`rounded-xl border p-4 text-left transition ${
              statusFilter === 'APPROVED' ? 'border-green-500 bg-green-50' : 'bg-white'
            }`}
          >
            <p className="text-sm text-slate-500">Approved</p>
            <p className="text-2xl font-semibold text-green-700">{stats.approved}</p>
          </button>
          <button
            onClick={() => setStatusFilter('REJECTED')}
            className={`rounded-xl border p-4 text-left transition ${
              statusFilter === 'REJECTED' ? 'border-red-500 bg-red-50' : 'bg-white'
            }`}
          >
            <p className="text-sm text-slate-500">Rejected</p>
            <p className="text-2xl font-semibold text-red-700">{stats.rejected}</p>
          </button>
        </div>
      )}

      {/* Requests List */}
      {requestsQuery.isLoading ? (
        <p className="text-sm text-slate-600">Loading requests...</p>
      ) : requests.length === 0 ? (
        <p className="text-sm text-slate-500">No {statusFilter.toLowerCase()} requests found.</p>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              onAction={handleAction}
              isLoading={updateMutation.isPending}
            />
          ))}
        </div>
      )}
    </section>
  );
}
