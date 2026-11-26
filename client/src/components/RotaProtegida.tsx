import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../lib/auth';
import type { Papel } from '../tipos';

export function RotaProtegida({ papeis, children }: { papeis: Papel[]; children: ReactNode }) {
  const { utilizador } = useAuth();
  const local = useLocation();
  if (!utilizador) return <Navigate to="/login" replace state={{ de: local.pathname }} />;
  if (!papeis.includes(utilizador.papel)) {
    return <Navigate to={utilizador.papel === 'admin' ? '/admin/pratos' : '/cozinha'} replace />;
  }
  return <>{children}</>;
}
