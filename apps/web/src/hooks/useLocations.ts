import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../services/api';

export function useDistricts() {
    return useQuery({
        queryKey: ['locations', 'districts'],
        queryFn: async () => {
            const res = await apiFetch('/locations/districts');
            return res as { id: string; name: string }[];
        },
    });
}

export function useLocalBodies(districtId: string | null, search?: string) {
    return useQuery({
        queryKey: ['locations', 'local-bodies', districtId, search],
        queryFn: async () => {
            if (!districtId) return [];
            const queryParams = search ? `?search=${encodeURIComponent(search)}` : '';
            const res = await apiFetch(`/locations/districts/${districtId}/local-bodies${queryParams}`);
            return res as { items: { id: string; name: string; type: string }[] };
        },
        enabled: !!districtId,
    });
}

export function useWards(localBodyId: string | null) {
    return useQuery({
        queryKey: ['locations', 'wards', localBodyId],
        queryFn: async () => {
            if (!localBodyId) return [];
            const res = await apiFetch(`/locations/local-bodies/${localBodyId}/wards`);
            return res as { id: string; wardNumber: string; localBodyId: string }[];
        },
        enabled: !!localBodyId,
    });
}
