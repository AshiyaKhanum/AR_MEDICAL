import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useAuthStore } from '../store/authStore';
import type { AuthUser } from '../store/authStore';

interface LoginResponse {
  success: boolean;
  data: { accessToken: string; refreshToken: string; user: AuthUser };
}

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  return useMutation({
    mutationFn: async (payload: { email: string; password: string }) => {
      const { data } = await apiClient.post<LoginResponse>('/auth/login', payload);
      return data.data;
    },
    onSuccess: (data) => setAuth(data),
  });
}

export function useLogout() {
  const clear = useAuthStore((s) => s.clear);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  return useMutation({
    mutationFn: async () => {
      try {
        await apiClient.post('/auth/logout', { refreshToken });
      } catch {
        // ignore network errors on logout
      }
    },
    onSuccess: () => clear(),
    onError: () => clear(),
  });
}

export function useCurrentUser() {
  return useAuthStore((s) => s.user);
}

export function usePermissions() {
  const user = useCurrentUser();
  const role = user?.role;
  return {
    role,
    isAdmin: role === 'ADMIN',
    isPharmacist: role === 'PHARMACIST',
    isStaff: role === 'STAFF',
    canManageInventory: role === 'ADMIN' || role === 'PHARMACIST',
    canManageUsers: role === 'ADMIN',
    canViewAudit: role === 'ADMIN',
    canApproveReturns: role === 'ADMIN' || role === 'PHARMACIST',
  };
}
