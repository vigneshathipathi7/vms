import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useMemo, useState } from 'react';
import { apiFetch, buildQuery } from '../services/api';
import { Taluk, Village, Ward, VotersResponse, ZonesResponse } from '../types/api';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { getHierarchyConfig } from '../utils/hierarchy';

const INITIAL_FORM = {
  name: '',
  contactNumber: '',
  voterId: '',
  // Dynamic hierarchy fields
  constituency: '',
  assemblyConstituency: '',
  talukId: '',
  villageId: '',
  wardId: '',
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

export function DataEntryPage() {
  const queryClient = useQueryClient();
  const { electionType, electionLevel, district, candidate } = useCurrentUser();
  const [form, setForm] = useState(INITIAL_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // Get hierarchy configuration based on election type
  const hierarchyConfig = useMemo(
    () => getHierarchyConfig(electionType || 'LOCAL_BODY'),
    [electionType]
  );

  // Fetch taluks list (for LOCAL_BODY), filtered by candidate's district
  // For LOCAL_BODY elections, fetch LGD blocks (which have villages)
  const taluksQuery = useQuery({
    queryKey: ['locations', 'taluks', 'list', district, electionType],
    queryFn: () => {
      const params = new URLSearchParams();
      if (district) params.set('districtName', district);
      const queryString = params.toString();
      return apiFetch<Taluk[]>(`/locations/taluks/list${queryString ? `?${queryString}` : ''}`);
    },
    enabled: hierarchyConfig.showTaluk,
  });

  // Fetch villages based on selected taluk (for LOCAL_BODY)
  const villagesQuery = useQuery({
    queryKey: ['locations', 'villages', form.talukId],
    queryFn: () => apiFetch<Village[]>(`/locations/taluks/${form.talukId}/villages`),
    enabled: hierarchyConfig.showVillage && !!form.talukId,
  });

  // Fetch wards based on selected village (for LOCAL_BODY)
  // For ASSEMBLY/PARLIAMENT, wards would be fetched differently
  const wardsQuery = useQuery({
    queryKey: ['locations', 'wards', form.villageId],
    queryFn: () => apiFetch<Ward[]>(`/locations/villages/${form.villageId}/wards`),
    enabled: hierarchyConfig.showVillage && !!form.villageId,
  });

  // Fetch districts to resolve districtId for assembly constituency endpoint
  const districtsQuery = useQuery({
    queryKey: ['locations', 'districts'],
    queryFn: () => apiFetch<DistrictOption[]>('/locations/districts'),
    enabled: hierarchyConfig.showConstituency || hierarchyConfig.showAssemblyConstituency,
  });

  const districtId = useMemo(() => {
    if (!district || !districtsQuery.data) {
      return undefined;
    }
    return districtsQuery.data.find((item) => item.name === district)?.id;
  }, [district, districtsQuery.data]);

  const assembliesQuery = useQuery({
    queryKey: ['locations', 'assemblies', districtId],
    queryFn: () =>
      apiFetch<AssemblyConstituencyOption[]>(
        `/locations/assemblies${districtId ? buildQuery({ districtId }) : ''}`,
      ),
    enabled: hierarchyConfig.showConstituency || hierarchyConfig.showAssemblyConstituency,
  });

  const parliamentaryQuery = useQuery({
    queryKey: ['locations', 'parliamentary'],
    queryFn: () => apiFetch<ParliamentaryConstituencyOption[]>('/locations/parliamentary'),
    enabled: hierarchyConfig.showConstituency && electionType === 'PARLIAMENT',
  });

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
      // Build payload based on election type
      const payload: Record<string, string> = {
        name: form.name,
        contactNumber: form.contactNumber,
        voterId: form.voterId,
        wardId: form.wardId,
        address: form.address,
        zoneId: form.zoneId,
      };

      // Add hierarchy-specific fields
      if (hierarchyConfig.showState) {
        payload.state = candidate?.state || 'Tamil Nadu';
      }
      if (hierarchyConfig.showConstituency && form.constituency) {
        payload.constituency = form.constituency;
      }
      if (hierarchyConfig.showAssemblyConstituency && form.assemblyConstituency) {
        payload.assemblyConstituency = form.assemblyConstituency;
      }
      if (hierarchyConfig.showTaluk && form.talukId) {
        payload.talukId = form.talukId;
      }
      if (hierarchyConfig.showVillage && form.villageId) {
        payload.villageId = form.villageId;
      }

      return apiFetch('/voters', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: async () => {
      setForm((prev) => ({ ...INITIAL_FORM, zoneId: prev.zoneId }));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['voters'] }),
        queryClient.invalidateQueries({ queryKey: ['zones', 'list'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] }),
      ]);
    },
  });

  const handleTalukChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const talukId = event.target.value;
    setForm((prev) => ({ ...prev, talukId, villageId: '', wardId: '' }));
  };

  const handleVillageChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const villageId = event.target.value;
    setForm((prev) => ({ ...prev, villageId, wardId: '' }));
  };

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

  const taluks = taluksQuery.data ?? [];
  const villages = villagesQuery.data ?? [];
  const wards = wardsQuery.data ?? [];
  const zones = zonesQuery.data?.items ?? [];
  const assemblies = assembliesQuery.data ?? [];
  const parliamentary = parliamentaryQuery.data ?? [];

  const constituencyOptions = useMemo(() => {
    if (electionType === 'PARLIAMENT') {
      return parliamentary.map((item) => item.name);
    }
    return assemblies.map((item) => item.name);
  }, [electionType, parliamentary, assemblies]);

  const assemblyConstituencyOptions = useMemo(() => {
    if (electionType === 'PARLIAMENT' && form.constituency) {
      const selectedParliamentaryId = parliamentary.find(
        (item) => item.name === form.constituency,
      )?.id;

      if (!selectedParliamentaryId) {
        return [];
      }

      return assemblies
        .filter((item) => item.parliamentaryConstituencyId === selectedParliamentaryId)
        .map((item) => item.name);
    }

    return assemblies.map((item) => item.name);
  }, [electionType, form.constituency, assemblies, parliamentary]);

  const selectedAssembly = useMemo(() => {
    if (electionType !== 'ASSEMBLY' || !form.constituency) {
      return null;
    }
    return assemblies.find((item) => item.name === form.constituency) ?? null;
  }, [electionType, form.constituency, assemblies]);

  const selectedParliamentaryId = useMemo(() => {
    if (electionType !== 'PARLIAMENT' || !form.constituency) {
      return undefined;
    }
    return parliamentary.find((item) => item.name === form.constituency)?.id;
  }, [electionType, form.constituency, parliamentary]);

  const wardFilterDistrictNames = useMemo(() => {
    if (electionType === 'ASSEMBLY') {
      const districtName = selectedAssembly?.district?.name;
      return districtName ? [districtName] : [];
    }

    if (electionType === 'PARLIAMENT') {
      if (form.assemblyConstituency) {
        const selectedAssemblyConstituency = assemblies.find(
          (item) => item.name === form.assemblyConstituency,
        );
        const districtName = selectedAssemblyConstituency?.district?.name;
        return districtName ? [districtName] : [];
      }

      if (!selectedParliamentaryId) {
        return [];
      }

      const districtSet = new Set(
        assemblies
          .filter((item) => item.parliamentaryConstituencyId === selectedParliamentaryId)
          .map((item) => item.district?.name)
          .filter((value): value is string => Boolean(value)),
      );
      return Array.from(districtSet);
    }

    return district ? [district] : [];
  }, [
    electionType,
    selectedAssembly,
    selectedParliamentaryId,
    form.assemblyConstituency,
    assemblies,
    district,
  ]);

  const wardsListQuery = useQuery({
    queryKey: ['locations', 'wards', 'list', wardFilterDistrictNames, electionType],
    queryFn: () =>
      apiFetch<WardOption[]>(
        `/locations/wards/list${buildQuery({
          districtNames: wardFilterDistrictNames.length
            ? wardFilterDistrictNames.join(',')
            : undefined,
        })}`,
      ),
    enabled:
      hierarchyConfig.showWard &&
      !hierarchyConfig.showVillage &&
      wardFilterDistrictNames.length > 0,
  });

  const allWardsListQuery = useQuery({
    queryKey: ['locations', 'wards', 'list', 'all', electionType],
    queryFn: () => apiFetch<WardOption[]>('/locations/wards/list'),
    enabled: hierarchyConfig.showWard && !hierarchyConfig.showVillage,
  });

  const filteredWards = wardsListQuery.data ?? [];
  const allWards = allWardsListQuery.data ?? [];
  const wardsList = filteredWards.length > 0 ? filteredWards : allWards;
  const isWardFallback = filteredWards.length === 0 && allWards.length > 0;

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

        {/* Dynamic Hierarchy Fields based on Election Type */}
        
        {/* Constituency dropdown - for ASSEMBLY and PARLIAMENT */}
        {hierarchyConfig.showConstituency && (
          <select
            className="rounded-xl border px-3 py-2.5 text-sm"
            value={form.constituency}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                constituency: event.target.value,
                assemblyConstituency: hierarchyConfig.showAssemblyConstituency ? '' : prev.assemblyConstituency,
                wardId: '',
              }))
            }
            disabled={constituencyOptions.length === 0}
            required
          >
            <option value="">Select {hierarchyConfig.constituencyLabel}</option>
            {constituencyOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        )}

        {/* Assembly Constituency - for PARLIAMENT */}
        {hierarchyConfig.showAssemblyConstituency && (
          <select
            className="rounded-xl border px-3 py-2.5 text-sm"
            value={form.assemblyConstituency}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, assemblyConstituency: event.target.value, wardId: '' }))
            }
            disabled={assemblyConstituencyOptions.length === 0}
            required
          >
            <option value="">Select Assembly Constituency</option>
            {assemblyConstituencyOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        )}

        {/* Taluk, Village, Ward cascading dropdowns - for LOCAL_BODY */}
        {hierarchyConfig.showTaluk && (
          <select
            className="rounded-xl border px-3 py-2.5 text-sm"
            value={form.talukId}
            onChange={handleTalukChange}
            required
          >
            <option value="">Select Taluk</option>
            {taluks.map((taluk) => (
              <option key={taluk.id} value={taluk.id}>
                {taluk.name}
              </option>
            ))}
          </select>
        )}

        {hierarchyConfig.showVillage && (
          <select
            className="rounded-xl border px-3 py-2.5 text-sm"
            value={form.villageId}
            onChange={handleVillageChange}
            required
            disabled={!form.talukId}
          >
            <option value="">{form.talukId ? 'Select Village' : 'Select Taluk first'}</option>
            {villages.map((village) => (
              <option key={village.id} value={village.id}>
                {village.name}
              </option>
            ))}
          </select>
        )}

        {/* Ward dropdown - always shown */}
        {hierarchyConfig.showVillage ? (
          <select
            className="rounded-xl border px-3 py-2.5 text-sm"
            value={form.wardId}
            onChange={(event) => setForm((prev) => ({ ...prev, wardId: event.target.value }))}
            required
            disabled={!form.villageId}
          >
            <option value="">{form.villageId ? `Select ${hierarchyConfig.wardLabel}` : 'Select Village first'}</option>
            {wards.map((ward) => (
              <option key={ward.id} value={ward.id}>
                {hierarchyConfig.wardLabel} {ward.wardNumber}
              </option>
            ))}
          </select>
        ) : (
          <div className="space-y-2">
            <select
              className="rounded-xl border px-3 py-2.5 text-sm"
              value={form.wardId}
              onChange={(event) => setForm((prev) => ({ ...prev, wardId: event.target.value }))}
              disabled={
                wardsList.length === 0 ||
                wardsListQuery.isLoading ||
                allWardsListQuery.isLoading
              }
              required
            >
              <option value="">Select {hierarchyConfig.wardLabel}</option>
              {wardsList.map((ward) => (
                <option key={ward.id} value={ward.id}>
                  {hierarchyConfig.wardLabel} {ward.wardNumber} - {ward.village.name}
                </option>
              ))}
            </select>
            {isWardFallback && (
              <p className="text-xs text-amber-700">
                No ward data matched the selected constituency exactly. Showing all available wards.
              </p>
            )}
          </div>
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
                {hierarchyConfig.showState && <th className="px-2 py-2">{hierarchyConfig.stateLabel}</th>}
                {hierarchyConfig.showConstituency && <th className="px-2 py-2">{hierarchyConfig.constituencyLabel}</th>}
                {hierarchyConfig.showAssemblyConstituency && <th className="px-2 py-2">Assembly</th>}
                {hierarchyConfig.showTaluk && <th className="px-2 py-2">Taluk</th>}
                {hierarchyConfig.showVillage && <th className="px-2 py-2">Village</th>}
                <th className="px-2 py-2">{hierarchyConfig.wardLabel}</th>
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
                  {hierarchyConfig.showState && <td className="px-2 py-2">{item.state || '-'}</td>}
                  {hierarchyConfig.showConstituency && <td className="px-2 py-2">{item.constituency || '-'}</td>}
                  {hierarchyConfig.showAssemblyConstituency && <td className="px-2 py-2">{item.assemblyConstituency || '-'}</td>}
                  {hierarchyConfig.showTaluk && <td className="px-2 py-2">{item.taluk?.name || '-'}</td>}
                  {hierarchyConfig.showVillage && <td className="px-2 py-2">{item.village?.name || '-'}</td>}
                  <td className="px-2 py-2">{item.ward ? `${hierarchyConfig.wardLabel} ${item.ward.wardNumber}` : item.wardId}</td>
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
