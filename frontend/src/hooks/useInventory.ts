import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { Batch, Medicine } from '../types/models';

export function useAllBatches(params: { medicineId?: string; expiringInDays?: number; expired?: boolean } = {}) {
  return useQuery({
    queryKey: ['batches', params],
    queryFn: async () => (await apiClient.get<{ data: Batch[] }>('/batches', { params })).data.data,
  });
}

export function useLowStock() {
  return useQuery({
    queryKey: ['alerts-low-stock'],
    queryFn: async () => (await apiClient.get<{ data: Medicine[] }>('/inventory/alerts/low-stock')).data.data,
  });
}

export function useOutOfStock() {
  return useQuery({
    queryKey: ['alerts-out-of-stock'],
    queryFn: async () => (await apiClient.get<{ data: Medicine[] }>('/inventory/alerts/out-of-stock')).data.data,
  });
}

export function useExpiring(days: number) {
  return useQuery({
    queryKey: ['alerts-expiring', days],
    queryFn: async () => (await apiClient.get<{ data: Batch[] }>('/inventory/alerts/expiring', { params: { days } })).data.data,
  });
}

export function useExpired() {
  return useQuery({
    queryKey: ['alerts-expired'],
    queryFn: async () => (await apiClient.get<{ data: Batch[] }>('/inventory/alerts/expired')).data.data,
  });
}

export function useInventorySummary() {
  return useQuery({
    queryKey: ['inventory-summary'],
    queryFn: async () => (await apiClient.get('/inventory/summary')).data.data,
  });
}
