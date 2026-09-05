import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { Purchase } from '../types/models';

export function usePurchases(filters: Record<string, string | undefined> = {}) {
  return useQuery({
    queryKey: ['purchases', filters],
    queryFn: async () => (await apiClient.get<{ data: Purchase[] }>('/purchases', { params: filters })).data.data,
  });
}

export function usePurchase(id?: string) {
  return useQuery({
    enabled: !!id,
    queryKey: ['purchase', id],
    queryFn: async () => (await apiClient.get<{ data: Purchase }>(`/purchases/${id}`)).data.data,
  });
}

export function useCreatePurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => (await apiClient.post<{ data: Purchase }>('/purchases', payload)).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchases'] });
      qc.invalidateQueries({ queryKey: ['medicines'] });
      qc.invalidateQueries({ queryKey: ['batches'] });
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
  });
}

export function usePurchasePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, paidAmount }: { id: string; paidAmount: number }) =>
      (await apiClient.post(`/purchases/${id}/payment`, { paidAmount })).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchases'] });
      qc.invalidateQueries({ queryKey: ['purchase'] });
    },
  });
}
