import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { Batch, Medicine } from '../types/models';

export interface MedicineFilters {
  search?: string;
  categoryId?: string;
  manufacturerId?: string;
  status?: 'active' | 'inactive' | 'all';
}

export function useMedicines(filters: MedicineFilters = {}) {
  return useQuery({
    queryKey: ['medicines', filters],
    queryFn: async () => (await apiClient.get<{ data: Medicine[] }>('/medicines', { params: filters })).data.data,
  });
}

export function useMedicine(id?: string) {
  return useQuery({
    enabled: !!id,
    queryKey: ['medicine', id],
    queryFn: async () => (await apiClient.get<{ data: Medicine }>(`/medicines/${id}`)).data.data,
  });
}

export function useMedicineByCode(code: string, enabled: boolean) {
  return useQuery({
    enabled: enabled && !!code,
    queryKey: ['medicine-by-code', code],
    queryFn: async () => (await apiClient.get<{ data: Medicine }>(`/medicines/barcode/${code}`)).data.data,
    retry: false,
  });
}

export function useCreateMedicine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Medicine>) => (await apiClient.post('/medicines', payload)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['medicines'] }),
  });
}

export function useUpdateMedicine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<Medicine> }) =>
      (await apiClient.put(`/medicines/${id}`, payload)).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['medicines'] });
      qc.invalidateQueries({ queryKey: ['medicine'] });
    },
  });
}

export function useDeactivateMedicine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await apiClient.delete(`/medicines/${id}`)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['medicines'] }),
  });
}

export function useAddBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ medicineId, payload }: { medicineId: string; payload: Partial<Batch> }) =>
      (await apiClient.post(`/medicines/${medicineId}/batches`, payload)).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['medicines'] });
      qc.invalidateQueries({ queryKey: ['medicine'] });
      qc.invalidateQueries({ queryKey: ['batches'] });
    },
  });
}
