import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { Supplier } from '../types/models';

export function useSuppliers(search = '') {
  return useQuery({
    queryKey: ['suppliers', search],
    queryFn: async () => (await apiClient.get<{ data: Supplier[] }>('/suppliers', { params: { search } })).data.data,
  });
}

export function useSupplier(id?: string) {
  return useQuery({
    enabled: !!id,
    queryKey: ['supplier', id],
    queryFn: async () => (await apiClient.get(`/suppliers/${id}`)).data.data,
  });
}

export function useCreateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Supplier>) => (await apiClient.post<{ data: Supplier }>('/suppliers', payload)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  });
}

export function useUpdateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<Supplier> }) =>
      (await apiClient.put(`/suppliers/${id}`, payload)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  });
}
