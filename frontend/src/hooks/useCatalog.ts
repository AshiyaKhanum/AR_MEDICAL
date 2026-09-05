import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { Category, Manufacturer } from '../types/models';

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await apiClient.get<{ data: Category[] }>('/catalog/categories')).data.data,
  });
}

export function useManufacturers() {
  return useQuery({
    queryKey: ['manufacturers'],
    queryFn: async () => (await apiClient.get<{ data: Manufacturer[] }>('/catalog/manufacturers')).data.data,
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => (await apiClient.post('/catalog/categories', { name })).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}

export function useCreateManufacturer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => (await apiClient.post('/catalog/manufacturers', { name })).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['manufacturers'] }),
  });
}
