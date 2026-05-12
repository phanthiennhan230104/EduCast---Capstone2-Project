import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { apiRequest } from '../../utils/api'
import {
  clearAuth,
  getCurrentUser,
  getRefreshToken,
  getToken,
  saveAuth,
  AUTH_FORCE_LOGOUT_EVENT,
} from '../../utils/auth'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getCurrentUser())
  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(getToken()))
  const [loading, setLoading] = useState(false)
  const checkAuthInFlightRef = useRef(false)

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    const handleForceLogout = () => {
      clearAuth()
      setUser(null)
      setIsAuthenticated(false)
      setLoading(false)
    }

    window.addEventListener(AUTH_FORCE_LOGOUT_EVENT, handleForceLogout)

    return () => {
      window.removeEventListener(AUTH_FORCE_LOGOUT_EVENT, handleForceLogout)
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return

    const intervalId = setInterval(() => {
      const token = getToken()

      if (!token) {
        clearAuth()
        setUser(null)
        setIsAuthenticated(false)
        return
      }

      checkAuth({ silent: true })
    }, 30000)

    return () => clearInterval(intervalId)
  }, [isAuthenticated])

  const isAuthError = (error) => {
    const msg = String(error?.message || '').toLowerCase()
    return (
      msg.includes('token không hợp lệ') ||
      msg.includes('hết hạn') ||
      msg.includes('đang bị khóa') ||
      msg.includes('bị khóa') ||
      msg.includes('không hoạt động') ||
      msg.includes('unauthorized') ||
      msg.includes('forbidden')
    )
  }

  const isBackendUnreachable = (error) => {
    const msg = String(error?.message || '')
    return (
      error?.name === 'TypeError' ||
      msg.includes('Failed to fetch') ||
      msg.includes('NetworkError') ||
      msg.includes('Load failed')
    )
  }

  const checkAuth = async ({ silent = false } = {}) => {
    const token = getToken()

    if (!token) {
      setUser(null)
      setIsAuthenticated(false)
      return
    }

    if (checkAuthInFlightRef.current) return
    checkAuthInFlightRef.current = true

    try {
      const data = await apiRequest('/auth/me/')

      setUser(data.user)
      setIsAuthenticated(true)
    } catch (error) {
      if (isBackendUnreachable(error)) {
        // Backend chưa chạy — giữ token local; chạy: npm run backend (từ thư mục frontend)
        return
      }

      // Nếu token hết hạn/không hợp lệ thì đừng giữ "local session state" nữa.
      // Tránh trường hợp UI nghĩ là còn login và cứ poll ra 403 liên tục.
      if (isAuthError(error)) {
        clearAuth()
        setUser(null)
        setIsAuthenticated(false)
        setLoading(false)
        if (!silent) {
          console.warn('Auth expired/invalid. Cleared local session.', error)
        }
        return
      }

      if (!silent) {
        console.warn('Auth check failed:', error)
      }
    } finally {
      checkAuthInFlightRef.current = false
    }
  }

  const login = (authData, rememberMe = false) => {
    saveAuth(authData, rememberMe)
    setUser(authData.user)
    setIsAuthenticated(true)
  }

  const logout = async () => {
    try {
      const refresh = getRefreshToken()

      if (refresh) {
        await apiRequest('/auth/logout/', {
          method: 'POST',
          body: JSON.stringify({ refresh }),
        })
      }
    } catch (error) {
      console.warn('Logout failed:', error)
    } finally {
      clearAuth()
      setUser(null)
      setIsAuthenticated(false)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        loading,
        login,
        logout,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }

  return context
}