import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch, ApiError } from '../services/api';
import {
  AccessRequest,
  AccessRequestUpdateResponse,
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
  onAction: (id: string, action: 'APPROVE' | 'REJECT', notes?: string, initialPassword?: string) => void;
  isLoading: boolean;
}) {
  const [showNotes, setShowNotes] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [initialPassword, setInitialPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [approveWithSetupLink, setApproveWithSetupLink] = useState(true);

  const handleAction = (action: 'APPROVE' | 'REJECT') => {
    if (action === 'APPROVE') {
      const password = initialPassword.trim();
      if (!approveWithSetupLink && (password.length < 8 || password.length > 128)) {
        setLocalError('Initial password must be between 8 and 128 characters.');
        return;
      }
      onAction(
        request.id,
        action,
        adminNotes || undefined,
        approveWithSetupLink ? undefined : password,
      );
    } else {
      onAction(request.id, action, adminNotes || undefined);
    }

    setLocalError(null);
    setShowNotes(false);
    setAdminNotes('');
    setInitialPassword('');
  };

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
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
        <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm">
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
              <input
                className="w-full rounded-xl border px-3 py-2.5 text-sm"
                type="password"
                placeholder="Temporary password (8-128 chars)"
                value={initialPassword}
                onChange={(e) => {
                  setInitialPassword(e.target.value);
                  if (localError) setLocalError(null);
                }}
                disabled={approveWithSetupLink}
              />
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={approveWithSetupLink}
                  onChange={(e) => {
                    setApproveWithSetupLink(e.target.checked);
                    setLocalError(null);
                  }}
                />
                Generate setup link instead of setting a temporary password
              </label>
              <textarea
                className="w-full rounded-xl border px-3 py-2.5 text-sm"
                rows={2}
                placeholder="Admin notes (optional)"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
              />
              {localError && <p className="text-sm text-red-600">{localError}</p>}
              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  onClick={() => handleAction('APPROVE')}
                  disabled={isLoading}
                >
                  Approve
                </button>
                <button
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  onClick={() => handleAction('REJECT')}
                  disabled={isLoading}
                >
                  Reject
                </button>
                <button
                  className="rounded-xl border px-4 py-2 text-sm font-medium text-slate-600"
                  onClick={() => setShowNotes(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white"
                onClick={() => setShowNotes(true)}
                disabled={isLoading}
              >
                Review & Approve
              </button>
              <button
                className="rounded-xl border px-4 py-2 text-sm font-medium text-slate-600"
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
  const [generatedSetupLink, setGeneratedSetupLink] = useState<string | null>(null);

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
      initialPassword,
    }: {
      id: string;
      action: 'APPROVE' | 'REJECT';
      adminNotes?: string;
      initialPassword?: string;
    }) =>
      apiFetch<AccessRequestUpdateResponse>(`/access-requests/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action, adminNotes, initialPassword }),
      }),
    onSuccess: (data) => {
      setErrorMessage(null);
      if (data.setupLink) {
        setGeneratedSetupLink(data.setupLink);
      }
      queryClient.invalidateQueries({ queryKey: ['access-requests'] });
      queryClient.invalidateQueries({ queryKey: ['access-requests', 'stats', 'sidebar'] });
    },
    onError: (error) => {
      setErrorMessage(extractErrorMessage(error));
    },
  });

  const handleAction = (
    id: string,
    action: 'APPROVE' | 'REJECT',
    adminNotes?: string,
    initialPassword?: string,
  ) => {
    updateMutation.mutate({ id, action, adminNotes, initialPassword });
  };

  const stats = statsQuery.data;
  const requests = requestsQuery.data?.items ?? [];

  return (
    <section className="space-y-6">
      <div>
        <div className="mb-3 inline-flex rounded-xl bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
          Review Queue
        </div>
        <h2 className="text-2xl font-semibold">Access Requests</h2>
        <p className="mt-1 text-sm text-slate-600">
          Review and manage new user access requests.
        </p>
      </div>

      {errorMessage && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{errorMessage}</p>
      )}

      {generatedSetupLink && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3">
          <p className="text-sm font-medium text-indigo-900">Setup link generated</p>
          <p className="mt-1 break-all text-xs text-indigo-700">{generatedSetupLink}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="rounded-lg bg-indigo-700 px-3 py-1.5 text-xs font-semibold text-white"
              type="button"
              onClick={() => navigator.clipboard.writeText(generatedSetupLink)}
            >
              Copy link
            </button>
            <button
              className="rounded-lg border border-indigo-300 px-3 py-1.5 text-xs font-semibold text-indigo-700"
              type="button"
              onClick={() => setGeneratedSetupLink(null)}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-4">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`rounded-2xl border border-slate-200 p-4 text-left transition ${
              statusFilter === 'ALL' ? 'border-slate-900 bg-slate-50' : 'bg-white'
            }`}
          >
            <p className="text-sm text-slate-500">Total</p>
            <p className="text-2xl font-semibold">{stats.total}</p>
          </button>
          <button
            onClick={() => setStatusFilter('PENDING')}
            className={`rounded-2xl border border-slate-200 p-4 text-left transition ${
              statusFilter === 'PENDING' ? 'border-yellow-500 bg-yellow-50' : 'bg-white'
            }`}
          >
            <p className="text-sm text-slate-500">Pending</p>
            <p className="text-2xl font-semibold text-yellow-700">{stats.pending}</p>
          </button>
          <button
            onClick={() => setStatusFilter('APPROVED')}
            className={`rounded-2xl border border-slate-200 p-4 text-left transition ${
              statusFilter === 'APPROVED' ? 'border-green-500 bg-green-50' : 'bg-white'
            }`}
          >
            <p className="text-sm text-slate-500">Approved</p>
            <p className="text-2xl font-semibold text-green-700">{stats.approved}</p>
          </button>
          <button
            onClick={() => setStatusFilter('REJECTED')}
            className={`rounded-2xl border border-slate-200 p-4 text-left transition ${
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
