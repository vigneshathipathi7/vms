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
