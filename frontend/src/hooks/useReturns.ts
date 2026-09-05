import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { ReturnRecord } from '../types/models';

export function useReturns(filters: Record<string, string | undefined> = {}) {
  return useQuery({
    queryKey: ['returns', filters],
    queryFn: async () => (await apiClient.get<{ data: ReturnRecord[] }>('/returns', { params: filters })).data.data,
  });
}

export function useCreateReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => (await apiClient.post<{ data: ReturnRecord }>('/returns', payload)).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['returns'] });
      qc.invalidateQueries({ queryKey: ['medicines'] });
      qc.invalidateQueries({ queryKey: ['batches'] });
      qc.invalidateQueries({ queryKey: ['sales'] });
      qc.invalidateQueries({ queryKey: ['purchases'] });
    },
  });
}

export function useApproveReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await apiClient.post(`/returns/${id}/approve`)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['returns'] }),
  });
}

export function useRejectReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await apiClient.post(`/returns/${id}/reject`)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['returns'] }),
  });
}
