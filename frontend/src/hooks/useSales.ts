import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { Sale } from '../types/models';

export interface CartLine {
  medicineId: string;
  batchId: string;
  quantity: number;
  discountPercent: number;
}

export function usePreviewSale(items: CartLine[], discountAmount: number) {
  return useQuery({
    queryKey: ['sale-preview', items, discountAmount],
    enabled: items.length > 0,
    queryFn: async () =>
      (await apiClient.post('/sales/preview', { items, discountAmount })).data.data as {
        lines: any[];
        subTotal: number;
        discountAmount: number;
        gstAmount: number;
        totalAmount: number;
      },
    retry: false,
  });
}

export function useCreateSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => (await apiClient.post<{ data: Sale }>('/sales', payload)).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['medicines'] });
      qc.invalidateQueries({ queryKey: ['batches'] });
      qc.invalidateQueries({ queryKey: ['sales'] });
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
  });
}

export function useSales(filters: Record<string, string | undefined> = {}) {
  return useQuery({
    queryKey: ['sales', filters],
    queryFn: async () => (await apiClient.get<{ data: Sale[] }>('/sales', { params: filters })).data.data,
  });
}

export function useSale(id?: string) {
  return useQuery({
    enabled: !!id,
    queryKey: ['sale', id],
    queryFn: async () => (await apiClient.get<{ data: Sale }>(`/sales/${id}`)).data.data,
  });
}

export function useSalePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; amount: number; method: string; reference?: string }) =>
      (await apiClient.post(`/sales/${id}/payment`, payload)).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales'] });
      qc.invalidateQueries({ queryKey: ['sale'] });
    },
  });
}
