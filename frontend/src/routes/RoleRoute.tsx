import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useCurrentUser } from '../hooks/useAuth';
import type { Role } from '../store/authStore';

export default function RoleRoute({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const user = useCurrentUser();
  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
