import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import type { Role } from '@/types'

export function RequireAuth({ allow }: { allow: Role }) {
  const { user } = useAuth()

  if (!user) return <Navigate to="/login" replace />
  if (user.role !== allow) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/app'} replace />
  }

  return <Outlet />
}
