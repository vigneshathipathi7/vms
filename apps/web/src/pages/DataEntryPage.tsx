import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useMemo, useState } from 'react';
import { ApiError, apiFetch, buildQuery } from '../services/api';
import { Taluk, Village, Ward, VotersResponse, ZonesResponse } from '../types/api';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { DISTRICT_OPTIONS, normalizeDistrictName } from '../constants/locations';

const INITIAL_FORM = {
  name: '',
  contactNumber: '',
  voterId: '',
  areaId: '',
  wardNumber: '',
  address: '',
  zoneId: '',
};

interface DistrictOption {
  id: string;
  name: string;
}

interface AssemblyConstituencyOption {
  id: string;
  name: string;
  parliamentaryConstituencyId: string;
  district: {
    id: string;
    name: string;
  };
  parliamentaryConstituency: {
    id: string;
    name: string;
  };
}

interface ParliamentaryConstituencyOption {
  id: string;
  name: string;
}

interface WardOption {
  id: string;
  wardNumber: string;
  villageId: string;
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
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/\(sc\)|\(st\)/g, '')
    .replace(/[^a-z0-9]/g, '');
}

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

  return 'Failed to add voter';
}

export function DataEntryPage() {
  const queryClient = useQueryClient();
  const { electionLevel, district, constituency, candidate, user } = useCurrentUser();
  const [form, setForm] = useState(INITIAL_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selectedDistrictId, setSelectedDistrictId] = useState('');
  const [selectedAssemblyId, setSelectedAssemblyId] = useState('');
  const role = user?.role ?? 'SUB_USER';
  const isSuperAdminRole = role === 'SUPER_ADMIN';
  const isSubAdminRole = role === 'SUB_ADMIN';
  const isAreaDropdownRole = role === 'SUPER_ADMIN' || role === 'ADMIN';
  const isWardStaticRole = role === 'SUB_USER' || role === 'VOLUNTEER';

  const districtsQuery = useQuery({
    queryKey: ['locations', 'districts', 'entry'],
    queryFn: () => apiFetch<DistrictOption[]>('/locations/districts'),
    enabled: isSuperAdminRole,
  });

  const validDistrictNames = useMemo(
    () => new Set(DISTRICT_OPTIONS.map((name) => normalizeText(name))),
    [],
  );

  const districtOptions = useMemo(
    () => (districtsQuery.data ?? []).filter((item) => validDistrictNames.has(normalizeText(normalizeDistrictName(item.name)))),
    [districtsQuery.data, validDistrictNames],
  );
  const selectedDistrict = districtOptions.find((item) => item.id === selectedDistrictId) ?? null;

  const assembliesQuery = useQuery({
    queryKey: ['locations', 'assemblies', 'entry', selectedDistrictId],
    queryFn: () =>
      apiFetch<AssemblyConstituencyOption[]>(
        `/locations/assemblies${buildQuery({ districtId: selectedDistrictId })}`,
      ),
    enabled: isSuperAdminRole && !!selectedDistrictId,
  });

  const assemblyOptions = assembliesQuery.data ?? [];
  const selectedAssembly = assemblyOptions.find((item) => item.id === selectedAssemblyId) ?? null;

  const profileQuery = useQuery({
    queryKey: ['users', 'profile', 'entry-scope'],
    queryFn: () => apiFetch<{ item: { managedWardId: string | null; managedVillageId: string | null } }>('/users/profile'),
    enabled: !isAreaDropdownRole,
  });

  const wardsListQuery = useQuery({
    queryKey: ['locations', 'wards', 'list', 'entry', district, selectedDistrict?.name],
    queryFn: () =>
      apiFetch<WardOption[]>(
        `/locations/wards/list${buildQuery({
          districtName: isSuperAdminRole ? selectedDistrict?.name ?? undefined : district ?? undefined,
        })}`,
      ),
  });

  const wardsList = wardsListQuery.data ?? [];

  const areaOptions = useMemo(() => {
    const seen = new Map<string, { id: string; name: string }>();
    wardsList.forEach((ward) => {
      if (!seen.has(ward.village.id)) {
        seen.set(ward.village.id, { id: ward.village.id, name: ward.village.name });
      }
    });
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [wardsList]);

  const effectiveDistrictName = isSuperAdminRole
    ? selectedDistrict?.name ?? null
    : district ?? null;
  const effectiveAssemblyName = isSuperAdminRole
    ? selectedAssembly?.name ?? null
    : constituency ?? null;

  const areaScopeQuery = useQuery({
    queryKey: ['locations', 'areas', 'entry', effectiveDistrictName, effectiveAssemblyName],
    queryFn: () =>
      apiFetch<{ matched: boolean; areaNames: string[] }>(
        `/locations/areas/by-assembly${buildQuery({ districtName: effectiveDistrictName ?? undefined, assemblyName: effectiveAssemblyName ?? undefined })}`,
      ),
    enabled: isAreaDropdownRole && !!effectiveDistrictName && !!effectiveAssemblyName,
  });

  const filteredAreaOptions = useMemo(() => {
    if (isSuperAdminRole && !selectedAssemblyId) {
      return [];
    }

    if (isSuperAdminRole && !areaScopeQuery.data?.matched) {
      return [];
    }

    if (!areaScopeQuery.data?.matched) {
      return areaOptions;
    }

    const allowedAreaNames = new Set(areaScopeQuery.data.areaNames.map((name) => normalizeText(name)));
    return areaOptions.filter((area) => allowedAreaNames.has(normalizeText(area.name)));
  }, [areaOptions, areaScopeQuery.data, isSuperAdminRole, selectedAssemblyId]);

  const disableAreaSelect = isSuperAdminRole
    ? !selectedDistrictId || !selectedAssemblyId || filteredAreaOptions.length === 0
    : false;

  const managedWard = useMemo(
    () => wardsList.find((ward) => ward.id === (profileQuery.data?.item.managedWardId ?? '')),
    [wardsList, profileQuery.data?.item.managedWardId],
  );

  const assignedAreaId = profileQuery.data?.item.managedVillageId
    ?? managedWard?.village.id
    ?? null;

  const assignedAreaName = assignedAreaId
    ? filteredAreaOptions.find((area) => area.id === assignedAreaId)?.name
      ?? areaOptions.find((area) => area.id === assignedAreaId)?.name
      ?? null
    : managedWard?.village.name ?? null;

  const staticAreaLabel = assignedAreaName ?? 'Assigned Area';
  const staticWardLabel = managedWard ? managedWard.wardNumber : 'Assigned Ward';

  const wardById = useMemo(() => {
    const map = new Map<string, WardOption>();
    wardsList.forEach((ward) => map.set(ward.id, ward));
    return map;
  }, [wardsList]);

  // Fetch zones
  const zonesQuery = useQuery({
    queryKey: ['zones', 'list'],
    queryFn: () => apiFetch<ZonesResponse>('/zones'),
  });

  // Fetch recent voters
  const votersQuery = useQuery({
    queryKey: ['voters', 'entry', page],
    queryFn: () =>
      apiFetch<VotersResponse>(
        `/voters${buildQuery({
          page,
          pageSize: 20,
        })}`,
      ),
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const constituencyValue = isSuperAdminRole
        ? selectedAssembly?.name ?? ''
        : constituency ?? 'Default Assembly Constituency';

      if (isSuperAdminRole && !selectedDistrictId) {
        throw new Error('District is required');
      }

      if (isSuperAdminRole && !selectedAssemblyId) {
        throw new Error('Assembly constituency is required');
      }

      if (!constituencyValue) {
        throw new Error('Assembly constituency is required');
      }

      if (!isWardStaticRole && !form.wardNumber.trim()) {
        throw new Error('Ward number is required');
      }

      if (isAreaDropdownRole && !form.areaId) {
        throw new Error('Area is required');
      }

      if (isSubAdminRole && !assignedAreaId) {
        throw new Error('Assigned area not found for your account');
      }

      let matchedWards: WardOption[] = [];

      if (isWardStaticRole) {
        if (!managedWard) {
          throw new Error('Assigned ward not found for your account');
        }
        matchedWards = [managedWard];
      } else {
        const effectiveAreaId = isAreaDropdownRole ? form.areaId : assignedAreaId;

        const scopedWards = effectiveAreaId
          ? wardsList.filter((ward) => ward.village.id === effectiveAreaId)
          : wardsList;

        matchedWards = scopedWards.filter((ward) => ward.wardNumber === form.wardNumber.trim());

        if (matchedWards.length === 0) {
          throw new Error('No ward found for the entered ward number');
        }

        if (matchedWards.length > 1) {
          throw new Error('Multiple wards matched. Narrow by selecting the correct area');
        }
      }

      const payload: Record<string, string> = {
        name: form.name,
        contactNumber: form.contactNumber,
        voterId: form.voterId,
        constituency: constituencyValue,
        wardId: matchedWards[0].id,
        address: form.address,
        zoneId: form.zoneId,
      };

      return apiFetch('/voters', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: async () => {
      setForm((prev) => ({
        ...INITIAL_FORM,
        zoneId: prev.zoneId,
        areaId: prev.areaId,
        wardNumber: isWardStaticRole ? prev.wardNumber : '',
      }));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['voters'] }),
        queryClient.invalidateQueries({ queryKey: ['zones', 'list'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] }),
      ]);
    },
    onError: (error) => {
      setFormError(extractErrorMessage(error));
    },
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!/^\d{10}$/.test(form.contactNumber)) {
      setFormError('Contact number must be exactly 10 digits');
      return;
    }

    if (!/^[a-zA-Z0-9]+$/.test(form.voterId)) {
      setFormError('Voter ID must be alphanumeric');
      return;
    }

    setFormError(null);
    createMutation.mutate();
  }

  const zones = zonesQuery.data?.items ?? [];
  const defaultDistrict = isSuperAdminRole
    ? selectedDistrict?.name ?? '-'
    : district ?? 'Default District';
  const defaultAssembly = isSuperAdminRole
    ? selectedAssembly?.name ?? '-'
    : constituency ?? 'Default Assembly Constituency';

  return (
    <section className="space-y-6">
      <div>
        <div className="mb-3 inline-flex rounded-xl bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
          Field Operations
        </div>
        <h2 className="text-2xl font-semibold">Centralized Data Entry</h2>
        <p className="mt-1 text-sm text-slate-600">
          Add voters to any zone from one screen.
          {electionLevel && (
            <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs font-medium">
              {electionLevel}
            </span>
          )}
        </p>
        {!isSuperAdminRole && (
          <p className="mt-2 text-sm font-semibold text-slate-700">
            District: <span className="font-bold text-slate-900">{defaultDistrict}</span>
            <span className="mx-2 text-slate-400">|</span>
            Assembly: <span className="font-bold text-slate-900">{defaultAssembly}</span>
          </p>
        )}
      </div>

      <form className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-3" onSubmit={onSubmit}>
        {/* Row 1: Name, Contact, Voter ID */}
        <input
          className="rounded-xl border px-3 py-2.5 text-sm"
          placeholder="Name"
          value={form.name}
          onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          required
        />
        <input
          className="rounded-xl border px-3 py-2.5 text-sm"
          placeholder="Contact"
          value={form.contactNumber}
          onChange={(event) =>
            setForm((prev) => ({
              ...prev,
              contactNumber: event.target.value.replace(/\D/g, '').slice(0, 10),
            }))
          }
          inputMode="numeric"
          maxLength={10}
          pattern="[0-9]{10}"
          required
        />
        <input
          className="rounded-xl border px-3 py-2.5 text-sm"
          placeholder="Voter ID"
          value={form.voterId}
          onChange={(event) =>
            setForm((prev) => ({
              ...prev,
              voterId: event.target.value.replace(/[^a-zA-Z0-9]/g, ''),
            }))
          }
          pattern="[a-zA-Z0-9]+"
          required
        />

        {isSuperAdminRole && (
          <>
            <select
              className="rounded-xl border px-3 py-2.5 text-sm"
              value={selectedDistrictId}
              onChange={(event) => {
                const nextDistrictId = event.target.value;
                setSelectedDistrictId(nextDistrictId);
                setSelectedAssemblyId('');
                setForm((prev) => ({ ...prev, areaId: '', wardNumber: '' }));
              }}
              required
            >
              <option value="">Select District</option>
              {districtOptions.map((item) => (
                <option key={item.id} value={item.id}>{normalizeDistrictName(item.name)}</option>
              ))}
            </select>

            <select
              className="rounded-xl border px-3 py-2.5 text-sm"
              value={selectedAssemblyId}
              onChange={(event) => {
                const nextAssemblyId = event.target.value;
                setSelectedAssemblyId(nextAssemblyId);
                setForm((prev) => ({ ...prev, areaId: '', wardNumber: '' }));
              }}
              required
              disabled={!selectedDistrictId}
            >
              <option value="">Select Assembly Constituency</option>
              {assemblyOptions.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </>
        )}

        {isAreaDropdownRole ? (
          <select
            className="rounded-xl border px-3 py-2.5 text-sm"
            value={form.areaId}
            onChange={(event) => setForm((prev) => ({ ...prev, areaId: event.target.value }))}
            required
            disabled={disableAreaSelect}
          >
            <option value="">Select Area</option>
            {filteredAreaOptions.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>
        ) : (
          <div className="rounded-xl border bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
            Area: <strong>{staticAreaLabel}</strong>
          </div>
        )}

        {isWardStaticRole ? (
          <div className="rounded-xl border bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
            Ward: <strong>{staticWardLabel}</strong>
          </div>
        ) : (
          <input
            className="rounded-xl border px-3 py-2.5 text-sm"
            placeholder="Ward Number"
            value={form.wardNumber}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                wardNumber: event.target.value.replace(/\D/g, ''),
              }))
            }
            inputMode="numeric"
            pattern="[0-9]+"
            required
          />
        )}

        {/* Row 3: Address, Zone, Submit */}
        <input
          className="rounded-xl border px-3 py-2.5 text-sm"
          placeholder="Address"
          value={form.address}
          onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
          required
        />
        <select
          className="rounded-xl border px-3 py-2.5 text-sm"
          value={form.zoneId}
          onChange={(event) => setForm((prev) => ({ ...prev, zoneId: event.target.value }))}
          required
        >
          <option value="">Select Zone</option>
          {zones.map((zone) => (
            <option key={zone.id} value={zone.id}>
              {zone.name}
            </option>
          ))}
        </select>

        <button
          className="rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-medium text-white disabled:opacity-60"
          type="submit"
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? 'Adding voter...' : 'Add voter'}
        </button>
      </form>

      {formError && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{formError}</p>}

      {votersQuery.isLoading ? (
        <p className="text-sm text-slate-600">Loading latest entries...</p>
      ) : votersQuery.isError || !votersQuery.data ? (
        <p className="text-sm text-red-600">Failed to load recent entries.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-base font-semibold">Recent entries</h3>
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b text-slate-500">
                <th className="px-2 py-2">Name</th>
                <th className="px-2 py-2">Voter ID</th>
                <th className="px-2 py-2">District</th>
                <th className="px-2 py-2">Assembly</th>
                <th className="px-2 py-2">Area</th>
                <th className="px-2 py-2">Ward</th>
                <th className="px-2 py-2">Address</th>
                <th className="px-2 py-2">Zone</th>
                <th className="px-2 py-2">Added By</th>
                <th className="px-2 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {votersQuery.data.items.map((item) => (
                <tr key={item.id} className="border-b last:border-b-0">
                  <td className="px-2 py-2">{item.name}</td>
                  <td className="px-2 py-2">{item.voterId}</td>
                  <td className="px-2 py-2">{defaultDistrict}</td>
                  <td className="px-2 py-2">{item.constituency || defaultAssembly}</td>
                  <td className="px-2 py-2">{wardById.get(item.wardId)?.village.name || '-'}</td>
                  <td className="px-2 py-2">{item.ward?.wardNumber || wardById.get(item.wardId)?.wardNumber || '-'}</td>
                  <td className="px-2 py-2">{item.address}</td>
                  <td className="px-2 py-2">{item.zone.name}</td>
                  <td className="px-2 py-2">{item.addedBy.username}</td>
                  <td className="px-2 py-2">{item.voted ? 'Voted' : 'Not voted'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Page {votersQuery.data.pagination.page} / {votersQuery.data.pagination.totalPages}
            </p>
            <div className="flex gap-2">
              <button
                className="rounded-xl border px-3 py-1.5 text-sm disabled:opacity-60"
                type="button"
                disabled={votersQuery.data.pagination.page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                Prev
              </button>
              <button
                className="rounded-xl border px-3 py-1.5 text-sm disabled:opacity-60"
                type="button"
                disabled={votersQuery.data.pagination.page >= votersQuery.data.pagination.totalPages}
                onClick={() => setPage((prev) => prev + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
