import { createContext, useContext, useEffect, useState } from 'react'
import { apiRequest } from '../../utils/api'
import {
  clearAuth,
  getCurrentUser,
  getRefreshToken,
  getToken,
  EDUCAST_USER,
} from '../../utils/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getCurrentUser())
  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(getToken()))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
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
    } finally {
      setLoading(false)
    }
  }

  const login = (userData) => {
    setUser(userData)
    setIsAuthenticated(true)
  }

  // logout lấy flow từ DaNangFoodFinder:
  // có gọi backend trước, fail vẫn clear local để thoát được
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