/* eslint-disable react-refresh/only-export-components -- AuthProvider + useAuth 成对导出 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch, getToken, setToken } from '@/api/http'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const bootstrap = useCallback(async () => {
    const token = getToken()
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const data = await apiFetch('/api/auth/me')
      setUser(data.user)
    } catch {
      setToken(null)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    bootstrap()
  }, [bootstrap])

  const login = useCallback(
    async (email, password, redirectTo = '/books') => {
      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      setToken(data.token)
      setUser(data.user)
      navigate(redirectTo || '/books', { replace: true })
    },
    [navigate],
  )

  const register = useCallback(
    async (email, password, fullName, redirectTo = '/books') => {
      const data = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, fullName }),
      })
      setToken(data.token)
      setUser(data.user)
      navigate(redirectTo || '/books', { replace: true })
    },
    [navigate],
  )

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
    navigate('/login', { replace: true })
  }, [navigate])

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      refreshUser: bootstrap,
    }),
    [user, loading, login, register, logout, bootstrap],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
