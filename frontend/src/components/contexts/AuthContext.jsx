import { createContext, useContext, useEffect, useState } from 'react'
import { apiRequest } from '../../utils/api'
import { clearAuth, getCurrentUser, getToken, EDUCAST_USER } from '../../utils/auth'

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

    // Không có access token thì coi như chưa đăng nhập
    if (!token) {
      setUser(null)
      setIsAuthenticated(false)
      setLoading(false)
      return
    }

    try {
      // Gọi backend để lấy lại user hiện tại từ access token
      const data = await apiRequest('/auth/me/')

      setUser(data.user)
      setIsAuthenticated(true)

      // Ghi đè lại user mới nhất vào localStorage
      localStorage.setItem(EDUCAST_USER, JSON.stringify(data.user))
    } catch (error) {
      // Nếu token hỏng / hết hạn thì xóa toàn bộ session local
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

  const logout = async () => {
    try {
      await apiRequest('/auth/logout/', { method: 'POST' })
    } catch {
      // Backend có lỗi logout vẫn xóa local để user thoát được
    }

    clearAuth()
    setUser(null)
    setIsAuthenticated(false)
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