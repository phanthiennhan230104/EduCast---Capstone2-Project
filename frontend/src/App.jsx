import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import HomePage from './pages/HomePage/HomePage'
import FeedPage from './pages/FeedPage/FeedPage'
import ChatPage from "./pages/ChatPage/ChatPage";
import AdminPage from "./components/admin/AdminPage";
import FavoritesPage from "./pages/FavoritesPage/FavoritesPage";
import CreateAudioPage from './pages/CreateAudioPage/CreateAudioPage'
import ProtectedRoute from "./components/ProtectedRoute";
import AdminUsersPage from "./components/admin/AdminUsersPage";
import MainLayout from "./components/layout/MainLayout/MainLayout";
import { AuthProvider, useAuth } from "./components/contexts/AuthContext";
import CommunityPage from "./pages/CommunityPage/CommunityPage";

function RootRedirect() {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return <div style={{ padding: 24 }}>Loading...</div>;
  }

  if (isAuthenticated) {
    return user?.role === 'admin' ? <Navigate to="/admin" replace /> : <Navigate to="/feed" replace />;
  }

  return <HomePage />;
  
  
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootRedirect />} />

          <Route
            path="/feed"
            element={
              <ProtectedRoute>
                <FeedPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin"
            element={
              <ProtectedRoute requireAdmin>
                <AdminPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/users"
            element={
              <ProtectedRoute requireAdmin>
                <AdminUsersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/create-audio"
            element={
              <ProtectedRoute>
                  <CreateAudioPage />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />

          <Route 
          path="/favorites" 
          element={
            <ProtectedRoute>
              <FavoritesPage />
            </ProtectedRoute>
          } 
          />

          <Route 
          path="/community" 
          element={
            <ProtectedRoute>
              <CommunityPage />
            </ProtectedRoute>
          } 
          />


          <Route
            path="/messages"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <ChatPage />
                </MainLayout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;