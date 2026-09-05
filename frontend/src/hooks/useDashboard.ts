import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { DashboardSummary } from '../types/models';

export function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: async () => (await apiClient.get<{ data: DashboardSummary }>('/dashboard/summary')).data.data,
    refetchInterval: 60_000,
  });
}
