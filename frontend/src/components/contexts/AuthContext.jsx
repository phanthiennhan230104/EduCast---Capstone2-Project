import { createContext, useContext, useEffect, useState } from 'react'
import { apiRequest } from '../../utils/api'
import {
  clearAuth,
  getCurrentUser,
  getRefreshToken,
  getToken,
  EDUCAST_USER,
  AUTH_FORCE_LOGOUT_EVENT,
} from '../../utils/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getCurrentUser())
  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(getToken()))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  /**
   * Nhận event logout bắt buộc từ api.js.
   * Ví dụ: backend báo tài khoản bị khóa.
   */
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

  /**
   * Polling trạng thái tài khoản.
   * Khi admin khóa user ở màn admin, user đang mở web sẽ tự gọi /auth/me/.
   * Backend thấy user bị khóa => trả lỗi => apiRequest tự clearAuth và redirect.
   */
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
    }, 3000)

    return () => clearInterval(intervalId)
  }, [isAuthenticated])

  const checkAuth = async ({ silent = false } = {}) => {
    const token = getToken()

    if (!token) {
      setUser(null)
      setIsAuthenticated(false)
      setLoading(false)
      return
    }

    try {
      const data = await apiRequest('/auth/me/')

      setUser(data.user)
      setIsAuthenticated(true)
      localStorage.setItem(EDUCAST_USER, JSON.stringify(data.user))
    } catch (error) {
      clearAuth()
      setUser(null)
      setIsAuthenticated(false)

      if (!silent) {
        console.warn('Check auth failed:', error.message)
      }
    } finally {
      setLoading(false)
    }
  }

  const login = (userData) => {
    setUser(userData)
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