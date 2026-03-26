import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'

export default function ProtectedRoute({ children, requireAdmin = false }) {
  const { isAuthenticated, loading, user } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div style={{ padding: '24px', color: 'white' }}>Loading...</div>
  }

  if (!isAuthenticated) {
    return <Navigate to="/" state={{ from: location }} replace />
  }

  if (requireAdmin && user?.role !== 'admin') {
    return <Navigate to="/feed" replace />
  }

  return children
  
}