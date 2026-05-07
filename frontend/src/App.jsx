import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import HomePage from './pages/HomePage/HomePage'
import FeedPage from './pages/FeedPage/FeedPage'
import ChatPage from "./pages/ChatPage/ChatPage";
import AdminPage from "./components/admin/AdminPage";
import FavoritesPage from "./pages/FavoritesPage/FavoritesPage";
import CreateAudioPage from './pages/CreateAudioPage/CreateAudioPage'
import EditAudioPage from './pages/EditAudioPage/EditAudioPage'
import PublishPostPage from './pages/PublishPostPage/PublishPostPage'
import SearchResultsPage from './pages/SearchResultsPage/SearchResultsPage'
import ProtectedRoute from "./components/ProtectedRoute";
import AdminUsersPage from "./components/admin/AdminUsersPage";
import MainLayout from "./components/layout/MainLayout/MainLayout";
import { AuthProvider, useAuth } from "./components/contexts/AuthContext";
import { AudioPlayerProvider } from "./components/contexts/AudioPlayerContext";
import { PodcastProvider } from "./components/contexts/PodcastContext";
import { TagFilterProvider } from "./components/contexts/TagFilterContext";
import CommunityPage from "./pages/CommunityPage/CommunityPage";
import SettingsPage from "./pages/SettingsPage/SettingsPage";
import PersonalPageComponent from "./components/PersonalPage/PersonalPage";
import AdminStatsPage from "./components/admin/AdminStatsPage";
import AdminContentModerationPage from "./components/admin/AdminModeration";
import AdminSystemPage from "./components/admin/AdminSystemPage";
import AssistantWidget from "./components/assistant/AssistantWidget";

function RootRedirect() {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return <div style={{ padding: 24 }}>Loading...</div>;
  }

  if (isAuthenticated) {
    return user?.role === 'admin'
      ? <Navigate to="/admin" replace />
      : <Navigate to="/feed" replace />;
  }

  return <HomePage />;
}

function App() {
  return (
    <AuthProvider>
      <AudioPlayerProvider>
        <PodcastProvider>
          <TagFilterProvider>
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
                  path="/search"
                  element={
                    <ProtectedRoute>
                      <SearchResultsPage />
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
                  path="/admin/stats"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AdminStatsPage />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/moderation"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AdminContentModerationPage />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/system"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AdminSystemPage />
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

                <Route
                  path="/edit/:postId"
                  element={
                    <ProtectedRoute>
                      <EditAudioPage />
                    </ProtectedRoute>
                  }
                />

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

                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute>
                      <SettingsPage />
                    </ProtectedRoute>
                  }
                />

              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <MainLayout rightPanel={false}>
                      <PersonalPageComponent />
                    </MainLayout>
                  </ProtectedRoute>
                }
              />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            <Route 
              path="/publish-post"
              element={
                <ProtectedRoute>
                  <PublishPostPage />
                </ProtectedRoute>
              }
            />


                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              <AssistantWidget />
            </BrowserRouter>
          </TagFilterProvider>
        </PodcastProvider>
      </AudioPlayerProvider>
    </AuthProvider>
  );
}

export default App;