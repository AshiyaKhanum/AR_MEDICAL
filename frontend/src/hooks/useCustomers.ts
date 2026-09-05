import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { Customer } from '../types/models';

export function useCustomers(search = '') {
  return useQuery({
    queryKey: ['customers', search],
    queryFn: async () => (await apiClient.get<{ data: Customer[] }>('/customers', { params: { search } })).data.data,
  });
}

export function useCustomer(id?: string) {
  return useQuery({
    enabled: !!id,
    queryKey: ['customer', id],
    queryFn: async () => (await apiClient.get(`/customers/${id}`)).data.data,
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Customer>) => (await apiClient.post<{ data: Customer }>('/customers', payload)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<Customer> }) =>
      (await apiClient.put(`/customers/${id}`, payload)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  });
}
