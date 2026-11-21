import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface ReadyResponse {
  status: 'ok' | 'degraded';
  checks: Record<string, { status: 'up' | 'down'; latencyMs: number; error?: string }>;
}

export function useApiHealth() {
  return useQuery({
    queryKey: ['health', 'ready'],
    queryFn: ({ signal }) => api.get<ReadyResponse>('/v1/health/ready', { signal, timeoutMs: 5000 }),
    retry: false,
    staleTime: 10_000,
  });
}
