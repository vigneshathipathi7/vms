import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { apiFetch, ApiError } from '../services/api';
import { SubUsersResponse } from '../types/api';

function getErrorMessage(error: unknown) {
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

function toOptional(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

interface EditingSubUser {
  id: string;
  username: string;
  phone: string;
  email: string;
}

export function SubUsersPage() {
  const queryClient = useQueryClient();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Edit modal state
  const [editing, setEditing] = useState<EditingSubUser | null>(null);
  const [editPassword, setEditPassword] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  // Delete confirmation state
  const [deleting, setDeleting] = useState<{ id: string; username: string } | null>(null);

  const subUsersQuery = useQuery({
    queryKey: ['users', 'sub-users'],
    queryFn: () => apiFetch<SubUsersResponse>('/users/sub-users'),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiFetch('/users/sub-users', {
        method: 'POST',
        body: JSON.stringify({
          username,
          password,
          phone: toOptional(phone),
          email: toOptional(email),
        }),
      }),
    onSuccess: async () => {
      setUsername('');
      setPassword('');
      setPhone('');
      setEmail('');
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['users', 'sub-users'] });
    },
    onError: (err) => {
      setError(getErrorMessage(err));
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; payload: { password?: string; phone?: string; email?: string } }) =>
      apiFetch(`/users/sub-users/${data.id}`, {
        method: 'PATCH',
        body: JSON.stringify(data.payload),
      }),
    onSuccess: async () => {
      setEditing(null);
      setEditPassword('');
      setEditPhone('');
      setEditEmail('');
      setEditError(null);
      await queryClient.invalidateQueries({ queryKey: ['users', 'sub-users'] });
    },
    onError: (err) => {
      setEditError(getErrorMessage(err));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/users/sub-users/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      setDeleting(null);
      await queryClient.invalidateQueries({ queryKey: ['users', 'sub-users'] });
    },
    onError: (err) => {
      setError(getErrorMessage(err));
      setDeleting(null);
    },
  });

  function openEdit(item: SubUsersResponse['items'][number]) {
    setEditing({ id: item.id, username: item.username, phone: item.phone ?? '', email: item.email ?? '' });
    setEditPhone(item.phone ?? '');
    setEditEmail(item.email ?? '');
    setEditPassword('');
    setEditError(null);
  }

  function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const payload: { password?: string; phone?: string; email?: string } = {};
    if (editPassword.trim()) payload.password = editPassword.trim();
    if (editPhone.trim()) payload.phone = editPhone.trim();
    if (editEmail.trim()) payload.email = editEmail.trim();
    updateMutation.mutate({ id: editing.id, payload });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createMutation.mutate();
  }

  return (
    <section className="space-y-6">
      <div>
        <div className="mb-3 inline-flex rounded-xl bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
          Team Access
        </div>
        <h2 className="text-2xl font-semibold">Sub-user Management</h2>
        <p className="mt-1 text-sm text-slate-600">Create sub-users and review activity counts.</p>
      </div>

      <form className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" onSubmit={onSubmit}>
        <div className="mb-4 grid gap-3 md:grid-cols-2">
          <input
            className="rounded-xl border px-3 py-2.5 text-sm"
            placeholder="Username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
          <input
            className="rounded-xl border px-3 py-2.5 text-sm"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <input
            className="rounded-xl border px-3 py-2.5 text-sm"
            placeholder="Phone (optional)"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
          <input
            className="rounded-xl border px-3 py-2.5 text-sm"
            type="email"
            placeholder="Email (optional)"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <button
          className="rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-medium text-white disabled:opacity-60"
          type="submit"
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? 'Creating sub-user...' : 'Add sub-user'}
        </button>
      </form>

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {subUsersQuery.isLoading ? (
        <p className="text-sm text-slate-600">Loading sub-users...</p>
      ) : subUsersQuery.isError || !subUsersQuery.data ? (
        <p className="text-sm text-red-600">Failed to load sub-users.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b text-slate-500">
                <th className="px-2 py-2">Username</th>
                <th className="px-2 py-2">Phone</th>
                <th className="px-2 py-2">Email</th>
                <th className="px-2 py-2">Voters Added</th>
                <th className="px-2 py-2">Created</th>
                <th className="px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subUsersQuery.data.items.map((item) => (
                <tr key={item.id} className="border-b last:border-b-0">
                  <td className="px-2 py-2">{item.username}</td>
                  <td className="px-2 py-2">{item.phone ?? '-'}</td>
                  <td className="px-2 py-2">{item.email ?? '-'}</td>
                  <td className="px-2 py-2">{item.votersAddedCount}</td>
                  <td className="px-2 py-2">{new Date(item.createdAt).toLocaleString()}</td>
                  <td className="px-2 py-2 space-x-2">
                    <button
                      className="text-blue-600 hover:underline text-xs"
                      onClick={() => openEdit(item)}
                    >
                      Edit
                    </button>
                    <button
                      className="text-red-600 hover:underline text-xs"
                      onClick={() => setDeleting({ id: item.id, username: item.username })}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
            <h3 className="mb-4 text-lg font-semibold">Edit Sub-user: {editing.username}</h3>
            <form onSubmit={submitEdit} className="space-y-3">
              <input
                className="w-full rounded-xl border px-3 py-2.5 text-sm"
                type="password"
                placeholder="New Password (leave blank to keep)"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
              />
              <input
                className="w-full rounded-xl border px-3 py-2.5 text-sm"
                placeholder="Phone"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
              />
              <input
                className="w-full rounded-xl border px-3 py-2.5 text-sm"
                type="email"
                placeholder="Email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
              />
              {editError && <p className="text-sm text-red-600">{editError}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  className="rounded-xl border px-4 py-2.5 text-sm"
                  onClick={() => setEditing(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg">
            <h3 className="mb-2 text-lg font-semibold">Delete Sub-user</h3>
            <p className="mb-4 text-sm text-slate-600">
              Are you sure you want to delete <strong>{deleting.username}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
                onClick={() => deleteMutation.mutate(deleting.id)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
              <button
                className="rounded-xl border px-4 py-2.5 text-sm"
                onClick={() => setDeleting(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
