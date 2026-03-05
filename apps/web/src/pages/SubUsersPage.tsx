import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useMemo, useState } from 'react';
import { apiFetch, ApiError } from '../services/api';
import { SubUsersResponse, UserProfileResponse, UserRole } from '../types/api';
import { roleLabel } from '../utils/roles';
import { useCurrentUser } from '../hooks/useCurrentUser';

function normalizeAreaName(value: string) {
  return value
    .toLowerCase()
    .replace(/\(sc\)|\(st\)/g, '')
    .replace(/[^a-z0-9]/g, '');
}

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

function sanitizePhone(value: string) {
  return value.replace(/\D/g, '').slice(0, 10);
}

function sanitizeWardNumber(value: string) {
  return value.replace(/\D/g, '');
}

function isValidPhone(value: string) {
  return /^\d{10}$/.test(value);
}

interface EditingSubUser {
  id: string;
  username: string;
  role: UserRole;
  phone: string;
  email: string;
  managedWardId: string;
  managedVillageId: string;
}

type WardOption = {
  id: string;
  wardNumber: string;
  village: {
    id: string;
    name: string;
    taluk: {
      id: string;
      name: string;
      district: {
        id: string;
        name: string;
      };
    };
  };
};

function childRoleFor(role: UserRole | undefined): UserRole | null {
  if (!role) return null;
  if (role === 'ADMIN') return 'SUB_ADMIN';
  if (role === 'SUB_ADMIN') return 'SUB_USER';
  if (role === 'SUB_USER') return 'VOLUNTEER';
  return null;
}

function hierarchyHeading(role: UserRole | undefined) {
  switch (role) {
    case 'SUPER_ADMIN':
      return {
        badge: 'Global Hierarchy',
        title: 'All Managed Users',
        subtitle: 'Monitor MLA candidates and their complete downstream teams.',
      };
    case 'ADMIN':
      return {
        badge: 'Candidate Hierarchy',
        title: 'Area Secretaries, Ward Members & Volunteers',
        subtitle: 'Create direct area secretaries and monitor all lower levels in your subtree.',
      };
    case 'SUB_ADMIN':
      return {
        badge: 'Area Hierarchy',
        title: 'Ward Members & Volunteers',
        subtitle: 'Create direct ward members and monitor volunteers in your assigned wards.',
      };
    case 'SUB_USER':
      return {
        badge: 'Ward Hierarchy',
        title: 'Volunteers',
        subtitle: 'Create and manage volunteers assigned to your ward.',
      };
    default:
      return {
        badge: 'Team Access',
        title: 'Hierarchy Management',
        subtitle: 'Create and manage your direct child users in the hierarchy.',
      };
  }
}

export function SubUsersPage() {
  const { user, candidate } = useCurrentUser();
  const childRole = childRoleFor(user?.role);
  const heading = hierarchyHeading(user?.role);
  const queryClient = useQueryClient();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [managedWardId, setManagedWardId] = useState('');
  const [managedVillageId, setManagedVillageId] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Edit modal state
  const [editing, setEditing] = useState<EditingSubUser | null>(null);
  const [editPassword, setEditPassword] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editManagedWardId, setEditManagedWardId] = useState('');
  const [editManagedVillageId, setEditManagedVillageId] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [selectedAdmin, setSelectedAdmin] = useState<{ id: string; username: string } | null>(null);
  const [selectedAreaSecretary, setSelectedAreaSecretary] = useState<{ id: string; username: string } | null>(null);
  const [selectedWardMember, setSelectedWardMember] = useState<{ id: string; username: string } | null>(null);

  // Delete confirmation state
  const [deleting, setDeleting] = useState<{ id: string; username: string } | null>(null);

  const subUsersQuery = useQuery({
    queryKey: ['users', 'sub-users'],
    queryFn: () => apiFetch<SubUsersResponse>('/users/sub-users'),
  });

  const profileQuery = useQuery({
    queryKey: ['users', 'profile'],
    queryFn: () => apiFetch<UserProfileResponse>('/users/profile'),
  });

  const wardsQuery = useQuery({
    queryKey: ['locations', 'wards', candidate?.district],
    queryFn: () => apiFetch<WardOption[]>(`/locations/wards/list${candidate?.district ? `?districtName=${encodeURIComponent(candidate.district)}` : ''}`),
  });

  const areaScopeQuery = useQuery({
    queryKey: ['locations', 'areas', candidate?.district, candidate?.constituency],
    queryFn: () =>
      apiFetch<{ matched: boolean; areaNames: string[] }>(
        `/locations/areas/by-assembly?districtName=${encodeURIComponent(candidate?.district ?? '')}&assemblyName=${encodeURIComponent(candidate?.constituency ?? '')}`,
      ),
    enabled: !!candidate?.district && !!candidate?.constituency,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiFetch('/users/sub-users', {
        method: 'POST',
        body: JSON.stringify({
          username,
          password,
          phone: toOptional(phone),
          email: email.trim(),
          managedWardId:
            childRole === 'VOLUNTEER'
              ? profileQuery.data?.item.managedWardId ?? undefined
              : childRole === 'SUB_USER' || childRole === 'SUB_ADMIN'
                ? toOptional(managedWardId)
                : undefined,
          managedVillageId: toOptional(managedVillageId),
        }),
      }),
    onSuccess: async () => {
      setUsername('');
      setPassword('');
      setPhone('');
      setEmail('');
      setManagedWardId('');
      setManagedVillageId('');
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['users', 'sub-users'] });
    },
    onError: (err) => {
      setError(getErrorMessage(err));
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: {
      id: string;
      payload: {
        password?: string;
        phone?: string;
        email?: string;
        managedWardId?: string;
        managedVillageId?: string;
      }
    }) =>
      apiFetch(`/users/sub-users/${data.id}`, {
        method: 'PATCH',
        body: JSON.stringify(data.payload),
      }),
    onSuccess: async () => {
      setEditing(null);
      setEditPassword('');
      setEditPhone('');
      setEditEmail('');
      setEditManagedWardId('');
      setEditManagedVillageId('');
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
    setEditing({
      id: item.id,
      username: item.username,
      role: item.role,
      phone: item.phone ?? '',
      email: item.email ?? '',
      managedWardId: item.managedWardId ?? '',
      managedVillageId: item.managedVillageId ?? '',
    });
    setEditPhone(item.phone ?? '');
    setEditEmail(item.email ?? '');
    setEditManagedWardId(item.role === 'SUB_USER' ? (item.managedWard?.wardNumber ?? '') : (item.managedWardId ?? ''));
    setEditManagedVillageId(item.managedVillageId ?? '');
    setEditPassword('');
    setEditError(null);
  }

  function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;

    const trimmedPhone = editPhone.trim();
    if (trimmedPhone && !isValidPhone(trimmedPhone)) {
      setEditError('Phone must be exactly 10 digits');
      return;
    }

    const payload: {
      password?: string;
      phone?: string;
      email?: string;
      managedWardId?: string;
      managedVillageId?: string;
    } = {};
    if (editPassword.trim()) payload.password = editPassword.trim();
    if (trimmedPhone) payload.phone = trimmedPhone;
    if (editEmail.trim()) payload.email = editEmail.trim();
    if (editManagedVillageId.trim()) payload.managedVillageId = editManagedVillageId.trim();
    if (editing.role === 'SUB_ADMIN') {
      if (editManagedWardId.trim()) {
        payload.managedWardId = editManagedWardId.trim();
      }
    } else if (editing.role === 'SUB_USER' || editing.role === 'VOLUNTEER') {
      if (editManagedWardId.trim()) {
        payload.managedWardId = editManagedWardId.trim();
      }
    }
    updateMutation.mutate({ id: editing.id, payload });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!childRole) {
      setError('Your role cannot create child users from this page');
      return;
    }

    const trimmedPhone = phone.trim();
    if (trimmedPhone && !isValidPhone(trimmedPhone)) {
      setError('Phone must be exactly 10 digits');
      return;
    }

    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    if (childRole === 'SUB_ADMIN' && !managedWardId.trim()) {
      setError('Select one area for area secretary');
      return;
    }

    if (childRole === 'SUB_USER' && !managedWardId.trim()) {
      setError('Select one ward for ward member');
      return;
    }

    if (childRole === 'VOLUNTEER' && !profileQuery.data?.item.managedWardId) {
      setError('Your ward is not set. Update your profile before adding volunteers.');
      return;
    }

    createMutation.mutate();
  }

  const roleSummary = {
    SUB_ADMIN: subUsersQuery.data?.items.filter((item) => item.role === 'SUB_ADMIN').length ?? 0,
    SUB_USER: subUsersQuery.data?.items.filter((item) => item.role === 'SUB_USER').length ?? 0,
    VOLUNTEER: subUsersQuery.data?.items.filter((item) => item.role === 'VOLUNTEER').length ?? 0,
  };

  const staticDistrict = candidate?.district ?? 'Default District';
  const staticAssembly = candidate?.constituency ?? 'Default Assembly Constituency';
  const assemblyAreaNames = areaScopeQuery.data?.matched
    ? areaScopeQuery.data.areaNames
    : null;
  const selectableWards = useMemo(() => {
    const wards = wardsQuery.data ?? [];
    if (!assemblyAreaNames) {
      return wards;
    }

    const allowedAreaNames = new Set(assemblyAreaNames.map((value) => normalizeAreaName(value)));
    return wards.filter((ward) => allowedAreaNames.has(normalizeAreaName(ward.village.name)));
  }, [assemblyAreaNames, wardsQuery.data]);

  const assignedWard = (wardsQuery.data ?? []).find((ward) => ward.id === (profileQuery.data?.item.managedWardId ?? ''));
  const staticArea =
    profileQuery.data?.item.managedVillage?.name
    ?? assignedWard?.village.name
    ?? (profileQuery.data?.item.managedWard ? `Ward ${profileQuery.data.item.managedWard.wardNumber}` : null)
    ?? 'Assigned Area';

  const baseItems = subUsersQuery.data?.items ?? [];
  const superAdminAdmins = baseItems.filter((item) => item.role === 'ADMIN');
  const adminAreaSecretaries = baseItems.filter(
    (item) => item.role === 'SUB_ADMIN' && (!user?.id || item.parentUserId === user.id),
  );

  const defaultTableItems = user?.role === 'SUPER_ADMIN'
    ? superAdminAdmins
    : user?.role === 'ADMIN'
      ? adminAreaSecretaries
      : user?.role === 'SUB_ADMIN'
        ? baseItems.filter((item) => item.role === 'SUB_USER')
        : baseItems;

  const tableItems = user?.role === 'SUPER_ADMIN'
    ? selectedWardMember
      ? baseItems.filter(
          (item) => item.role === 'VOLUNTEER' && item.parentUserId === selectedWardMember.id,
        )
      : selectedAreaSecretary
        ? baseItems.filter(
            (item) => item.role === 'SUB_USER' && item.parentUserId === selectedAreaSecretary.id,
          )
        : selectedAdmin
          ? baseItems.filter(
              (item) => item.role === 'SUB_ADMIN' && item.parentUserId === selectedAdmin.id,
            )
          : defaultTableItems
    : user?.role === 'ADMIN'
      ? selectedWardMember
        ? baseItems.filter(
            (item) => item.role === 'VOLUNTEER' && item.parentUserId === selectedWardMember.id,
          )
        : selectedAreaSecretary
          ? baseItems.filter(
              (item) => item.role === 'SUB_USER' && item.parentUserId === selectedAreaSecretary.id,
            )
          : defaultTableItems
      : selectedWardMember
        ? baseItems.filter(
            (item) => item.role === 'VOLUNTEER' && item.parentUserId === selectedWardMember.id,
          )
        : defaultTableItems;

  const volunteerCountByWardMember = new Map<string, number>();
  (subUsersQuery.data?.items ?? []).forEach((item) => {
    if (item.role === 'VOLUNTEER' && item.parentUserId) {
      volunteerCountByWardMember.set(
        item.parentUserId,
        (volunteerCountByWardMember.get(item.parentUserId) ?? 0) + 1,
      );
    }
  });

  const wardMemberCountByAreaSecretary = new Map<string, number>();
  (subUsersQuery.data?.items ?? []).forEach((item) => {
    if (item.role === 'SUB_USER' && item.parentUserId) {
      wardMemberCountByAreaSecretary.set(
        item.parentUserId,
        (wardMemberCountByAreaSecretary.get(item.parentUserId) ?? 0) + 1,
      );
    }
  });

  const areaSecretaryCountByAdmin = new Map<string, number>();
  (subUsersQuery.data?.items ?? []).forEach((item) => {
    if (item.role === 'SUB_ADMIN' && item.parentUserId) {
      areaSecretaryCountByAdmin.set(
        item.parentUserId,
        (areaSecretaryCountByAdmin.get(item.parentUserId) ?? 0) + 1,
      );
    }
  });

  return (
    <section className="space-y-6">
      <div>
        <div className="mb-3 inline-flex rounded-xl bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
          {heading.badge}
        </div>
        <h2 className="text-2xl font-semibold">{heading.title}</h2>
        <p className="mt-1 text-sm text-slate-600">{heading.subtitle}</p>
        {user && childRole && (
          <p className="mt-1 text-xs text-slate-500">
            Your role: {roleLabel(user.role)} · You can create: {roleLabel(childRole)}
          </p>
        )}
        {user?.role !== 'SUPER_ADMIN' && (
          <p className="mt-2 text-sm font-semibold text-slate-700">
            District: <span className="font-bold text-slate-900">{staticDistrict}</span>
            <span className="mx-2 text-slate-400">|</span>
            Assembly: <span className="font-bold text-slate-900">{staticAssembly}</span>
            {user?.role !== 'ADMIN' && (
              <>
                <span className="mx-2 text-slate-400">|</span>
                Area: <span className="font-bold text-slate-900">{staticArea}</span>
              </>
            )}
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Area Secretaries</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{roleSummary.SUB_ADMIN}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Ward Members</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{roleSummary.SUB_USER}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Volunteers</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{roleSummary.VOLUNTEER}</p>
        </div>
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
            onChange={(event) => setPhone(sanitizePhone(event.target.value))}
            inputMode="numeric"
            maxLength={10}
            pattern="[0-9]{10}"
          />
          <input
            className="rounded-xl border px-3 py-2.5 text-sm"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>

        {childRole === 'SUB_ADMIN' && (
          <div className="mb-4 grid gap-3 md:grid-cols-2">
            <select
              className="rounded-xl border px-3 py-2.5 text-sm"
              value={managedWardId}
              onChange={(e) => setManagedWardId(e.target.value)}
              required
            >
              <option value="">Select Area</option>
              {selectableWards.map((ward) => (
                <option key={ward.id} value={ward.id}>
                  {ward.village.taluk.district.name} · {ward.village.name} · Area {ward.wardNumber}
                </option>
              ))}
            </select>
            <input
              className="rounded-xl border px-3 py-2.5 text-sm"
              placeholder="Area Name (optional)"
              value={managedVillageId}
              onChange={(e) => setManagedVillageId(e.target.value)}
            />
          </div>
        )}

        {childRole === 'SUB_USER' && (
          <div className="mb-4 grid gap-3 md:grid-cols-2">
            <input
              className="rounded-xl border px-3 py-2.5 text-sm"
              placeholder="Ward Number"
              value={managedWardId}
              onChange={(e) => setManagedWardId(sanitizeWardNumber(e.target.value))}
              inputMode="numeric"
              pattern="[0-9]+"
              required
            />
            <input
              className="rounded-xl border px-3 py-2.5 text-sm"
              placeholder="Ward Name (optional)"
              value={managedVillageId}
              onChange={(e) => setManagedVillageId(e.target.value)}
            />
          </div>
        )}

        {childRole === 'VOLUNTEER' && (
          <p className="mb-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
            Volunteer will be auto-assigned under this Ward Member account.
          </p>
        )}

        <button
          className="rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-medium text-white disabled:opacity-60"
          type="submit"
          disabled={createMutation.isPending || !childRole}
        >
          {createMutation.isPending ? 'Creating user...' : childRole ? `Add ${roleLabel(childRole)}` : 'Add user'}
        </button>
      </form>

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {subUsersQuery.isLoading ? (
        <p className="text-sm text-slate-600">Loading team users...</p>
      ) : subUsersQuery.isError || !subUsersQuery.data ? (
        <p className="text-sm text-red-600">Failed to load team users.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {user?.role === 'SUPER_ADMIN' && selectedWardMember && selectedAreaSecretary && selectedAdmin && (
            <div className="mb-3 flex items-center justify-between rounded-xl bg-indigo-50 px-3 py-2 text-sm text-indigo-700">
              <span>
                Showing volunteers under ward member: {selectedWardMember.username}
                {' '}
                (Area Secretary: {selectedAreaSecretary.username}, Admin: {selectedAdmin.username})
              </span>
              <button
                className="rounded-lg border border-indigo-200 bg-white px-2 py-1 text-xs font-medium text-indigo-700"
                type="button"
                onClick={() => setSelectedWardMember(null)}
              >
                Back to ward members
              </button>
            </div>
          )}

          {user?.role === 'SUPER_ADMIN' && selectedAreaSecretary && !selectedWardMember && selectedAdmin && (
            <div className="mb-3 flex items-center justify-between rounded-xl bg-indigo-50 px-3 py-2 text-sm text-indigo-700">
              <span>
                Showing ward members under area secretary: {selectedAreaSecretary.username}
                {' '}
                (Admin: {selectedAdmin.username})
              </span>
              <button
                className="rounded-lg border border-indigo-200 bg-white px-2 py-1 text-xs font-medium text-indigo-700"
                type="button"
                onClick={() => {
                  setSelectedAreaSecretary(null);
                  setSelectedWardMember(null);
                }}
              >
                Back to area secretaries
              </button>
            </div>
          )}

          {user?.role === 'SUPER_ADMIN' && selectedAdmin && !selectedAreaSecretary && !selectedWardMember && (
            <div className="mb-3 flex items-center justify-between rounded-xl bg-indigo-50 px-3 py-2 text-sm text-indigo-700">
              <span>Showing area secretaries under admin: {selectedAdmin.username}</span>
              <button
                className="rounded-lg border border-indigo-200 bg-white px-2 py-1 text-xs font-medium text-indigo-700"
                type="button"
                onClick={() => {
                  setSelectedAdmin(null);
                  setSelectedAreaSecretary(null);
                  setSelectedWardMember(null);
                }}
              >
                Back to admins
              </button>
            </div>
          )}

          {user?.role === 'ADMIN' && selectedWardMember && selectedAreaSecretary && (
            <div className="mb-3 flex items-center justify-between rounded-xl bg-indigo-50 px-3 py-2 text-sm text-indigo-700">
              <span>
                Showing volunteers under ward member: {selectedWardMember.username}
                {' '}
                (Area Secretary: {selectedAreaSecretary.username})
              </span>
              <button
                className="rounded-lg border border-indigo-200 bg-white px-2 py-1 text-xs font-medium text-indigo-700"
                type="button"
                onClick={() => setSelectedWardMember(null)}
              >
                Back to ward members
              </button>
            </div>
          )}

          {user?.role === 'ADMIN' && selectedAreaSecretary && !selectedWardMember && (
            <div className="mb-3 flex items-center justify-between rounded-xl bg-indigo-50 px-3 py-2 text-sm text-indigo-700">
              <span>Showing ward members under area secretary: {selectedAreaSecretary.username}</span>
              <button
                className="rounded-lg border border-indigo-200 bg-white px-2 py-1 text-xs font-medium text-indigo-700"
                type="button"
                onClick={() => {
                  setSelectedAreaSecretary(null);
                  setSelectedWardMember(null);
                }}
              >
                Back to area secretaries
              </button>
            </div>
          )}

          {user?.role === 'SUB_ADMIN' && selectedWardMember && (
            <div className="mb-3 flex items-center justify-between rounded-xl bg-indigo-50 px-3 py-2 text-sm text-indigo-700">
              <span>Showing volunteers under ward member: {selectedWardMember.username}</span>
              <button
                className="rounded-lg border border-indigo-200 bg-white px-2 py-1 text-xs font-medium text-indigo-700"
                type="button"
                onClick={() => setSelectedWardMember(null)}
              >
                Back to all team users
              </button>
            </div>
          )}
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b text-slate-500">
                <th className="px-2 py-2">Username</th>
                <th className="px-2 py-2">Role</th>
                <th className="px-2 py-2">Area</th>
                <th className="px-2 py-2">Phone</th>
                <th className="px-2 py-2">Email</th>
                <th className="px-2 py-2">Voters Added</th>
                <th className="px-2 py-2">Created</th>
                <th className="px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tableItems.map((item) => (
                <tr key={item.id} className="border-b last:border-b-0">
                  <td className="px-2 py-2">
                    {(user?.role === 'SUPER_ADMIN' && item.role === 'ADMIN' && !selectedAdmin) ? (
                      <button
                        type="button"
                        className="text-left text-indigo-700 hover:underline"
                        onClick={() => {
                          setSelectedAdmin({ id: item.id, username: item.username });
                          setSelectedAreaSecretary(null);
                          setSelectedWardMember(null);
                        }}
                      >
                        {item.username}
                        <span className="ml-1 text-xs text-slate-500">
                          ({areaSecretaryCountByAdmin.get(item.id) ?? 0} area secretaries)
                        </span>
                      </button>
                    ) : ((user?.role === 'SUPER_ADMIN' && item.role === 'SUB_ADMIN' && !!selectedAdmin && !selectedAreaSecretary) || (user?.role === 'ADMIN' && item.role === 'SUB_ADMIN' && !selectedAreaSecretary)) ? (
                      <button
                        type="button"
                        className="text-left text-indigo-700 hover:underline"
                        onClick={() => {
                          setSelectedAreaSecretary({ id: item.id, username: item.username });
                          setSelectedWardMember(null);
                        }}
                      >
                        {item.username}
                        <span className="ml-1 text-xs text-slate-500">
                          ({wardMemberCountByAreaSecretary.get(item.id) ?? 0} ward members)
                        </span>
                      </button>
                    ) : ((user?.role === 'SUPER_ADMIN' && item.role === 'SUB_USER' && !!selectedAreaSecretary) || (user?.role === 'ADMIN' && item.role === 'SUB_USER' && !!selectedAreaSecretary) || (user?.role === 'SUB_ADMIN' && item.role === 'SUB_USER')) ? (
                      <button
                        type="button"
                        className="text-left text-indigo-700 hover:underline"
                        onClick={() => setSelectedWardMember({ id: item.id, username: item.username })}
                      >
                        {item.username}
                        <span className="ml-1 text-xs text-slate-500">
                          ({volunteerCountByWardMember.get(item.id) ?? 0} volunteers)
                        </span>
                      </button>
                    ) : (
                      item.username
                    )}
                  </td>
                  <td className="px-2 py-2">{roleLabel(item.role)}</td>
                  <td className="px-2 py-2">
                    {item.assignedWards.length > 0
                      ? item.assignedWards.map((entry) => entry.ward.wardNumber).join(', ')
                      : item.managedWard?.wardNumber ?? '-'}
                  </td>
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
              {tableItems.length === 0 && (
                <tr>
                  <td className="px-2 py-4 text-sm text-slate-500" colSpan={8}>
                    {user?.role === 'SUPER_ADMIN'
                      ? selectedWardMember
                        ? `No volunteers found under ${selectedWardMember.username}.`
                        : selectedAreaSecretary
                          ? `No ward members found under ${selectedAreaSecretary.username}.`
                          : selectedAdmin
                            ? `No area secretaries found under ${selectedAdmin.username}.`
                            : 'No admins found.'
                      : user?.role === 'ADMIN'
                      ? selectedWardMember
                        ? `No volunteers found under ${selectedWardMember.username}.`
                        : selectedAreaSecretary
                          ? `No ward members found under ${selectedAreaSecretary.username}.`
                          : 'No area secretaries found.'
                      : selectedWardMember
                        ? `No volunteers found under ${selectedWardMember.username}.`
                        : user?.role === 'SUB_ADMIN'
                          ? 'No ward members found.'
                          : 'No team users found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
            <h3 className="mb-4 text-lg font-semibold">Edit User: {editing.username}</h3>
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
                onChange={(e) => setEditPhone(sanitizePhone(e.target.value))}
                inputMode="numeric"
                maxLength={10}
                pattern="[0-9]{10}"
              />
              <input
                className="w-full rounded-xl border px-3 py-2.5 text-sm"
                type="email"
                placeholder="Email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
              />
              {editing.role === 'SUB_USER' && (
                <input
                  className="w-full rounded-xl border px-3 py-2.5 text-sm"
                  placeholder="Ward Number"
                  value={editManagedWardId}
                  onChange={(e) => setEditManagedWardId(sanitizeWardNumber(e.target.value))}
                  inputMode="numeric"
                  pattern="[0-9]+"
                />
              )}
              {editing.role === 'VOLUNTEER' && (
                <select
                  className="w-full rounded-xl border px-3 py-2.5 text-sm"
                  value={editManagedWardId}
                  onChange={(e) => setEditManagedWardId(e.target.value)}
                >
                  <option value="">Select Area</option>
                  {selectableWards.map((ward) => (
                    <option key={ward.id} value={ward.id}>
                      {ward.village.taluk.district.name} · {ward.village.name} · Area {ward.wardNumber}
                    </option>
                  ))}
                </select>
              )}
              {(editing.role === 'SUB_ADMIN') && (
                <select
                  className="w-full rounded-xl border px-3 py-2.5 text-sm"
                  value={editManagedWardId}
                  onChange={(e) => setEditManagedWardId(e.target.value)}
                >
                  <option value="">Select Area</option>
                  {selectableWards.map((ward) => (
                    <option key={ward.id} value={ward.id}>
                      {ward.village.taluk.district.name} · {ward.village.name} · Area {ward.wardNumber}
                    </option>
                  ))}
                </select>
              )}
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
            <h3 className="mb-2 text-lg font-semibold">Delete User</h3>
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
