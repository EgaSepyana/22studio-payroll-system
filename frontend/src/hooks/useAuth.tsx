import * as React from 'react'
import * as authApi from '@/services/authApi'
import type { AuthUser } from '@/types'

interface AuthContextValue {
  user: AuthUser | null
  login: (username: string, password: string) => Promise<AuthUser>
  logout: () => void
  isLoading: boolean
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined)

function readStoredUser(): AuthUser | null {
  const raw = localStorage.getItem('user')
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(readStoredUser)
  const [isLoading, setIsLoading] = React.useState(false)

  const login = React.useCallback(async (username: string, password: string) => {
    setIsLoading(true)
    try {
      const result = await authApi.login(username, password)
      localStorage.setItem('token', result.token)
      localStorage.setItem('user', JSON.stringify(result.user))
      setUser(result.user)
      return result.user
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = React.useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
    authApi.logout().catch(() => {})
  }, [])

  const value = React.useMemo(() => ({ user, login, logout, isLoading }), [user, login, logout, isLoading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
