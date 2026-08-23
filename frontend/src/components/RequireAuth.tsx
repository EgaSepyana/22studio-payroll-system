import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import type { Role } from '@/types'

// Where a signed-in user belongs when they're denied a route — used both
// here (mismatched role) and by App.tsx's root "/" redirect.
export function homeRouteForRole(role: Role): string {
  if (role === 'admin') return '/admin'
  if (role === 'admin_produksi') return '/admin/order'
  if (role === 'owner') return '/owner'
  return '/app'
}

export function RequireAuth({ allow }: { allow: Role | Role[] }) {
  const { user } = useAuth()

  if (!user) return <Navigate to="/login" replace />
  const allowed = Array.isArray(allow) ? allow.includes(user.role) : user.role === allow
  if (!allowed) {
    return <Navigate to={homeRouteForRole(user.role)} replace />
  }

  return <Outlet />
}
