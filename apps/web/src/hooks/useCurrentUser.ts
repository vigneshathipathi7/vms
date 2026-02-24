import { useQuery } from '@tanstack/react-query';
import { apiFetch, ApiError } from '../services/api';
import { MeResponse } from '../types/api';

export function useCurrentUser() {
  const query = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => apiFetch<MeResponse>('/auth/me'),
    retry: (failureCount, error) => {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        return false;
      }
      return failureCount < 1;
    },
  });

  return {
    ...query,
    user: query.data?.user ?? null,
    candidate: query.data?.candidate ?? null,
    electionType: query.data?.candidate?.electionType ?? null,
    isUnauthorized: query.error instanceof ApiError && query.error.status === 401,
  };
}
