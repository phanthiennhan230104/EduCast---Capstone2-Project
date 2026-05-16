import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
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
import { ChatProvider } from "./components/contexts/ChatContext";
import CommunityPage from "./pages/CommunityPage/CommunityPage";
import SettingsPage from "./pages/SettingsPage/SettingsPage";
import PersonalPageComponent from "./components/PersonalPage/PersonalPage";
import AdminStatsPage from "./components/admin/AdminStatsPage";
import AdminContentModerationPage from "./components/admin/AdminModeration";
import AdminContentModeration from "./components/admin/AdminContentModeration";
import AdminSystemPage from "./components/admin/AdminSystemPage";
import AssistantWidget from "./components/assistant/AssistantWidget";
import HashtagPage from "./pages/HashtagPage/HashtagPage";
import ArchivePage from "./pages/ArchivePage/ArchivePage";
import { NotificationProvider } from "./components/contexts/NotificationContext";

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

/**
 * Giữ route nền (feed, profile, …) khi mở /edit/... kèm state.background
 * để backdrop-filter có nội dung thật phía sau — giống modal bình luận.
 */
function AppRoutes() {
  const location = useLocation()
  const background = location.state?.background

  return (
    <>
      <Routes location={background || location}>
        <Route path="/" element={<RootRedirect />} />

        <Route
          path="/feed"
          element={
            <ProtectedRoute>
              <MainLayout>
                <FeedPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/search"
          element={
            <ProtectedRoute>
              <MainLayout>
                <SearchResultsPage />
              </MainLayout>
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
          path="/admin/content-moderation"
          element={
            <ProtectedRoute requireAdmin>
              <AdminContentModeration />
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
              <MainLayout rightPanel={false}>
                <FavoritesPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/community"
          element={
            <ProtectedRoute>
              <MainLayout rightPanel={false}>
                <CommunityPage />
              </MainLayout>
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
          path="/profile/:userId"
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

        <Route
          path="/hashtag/:slug"
          element={
            <ProtectedRoute>
              <HashtagPage />
            </ProtectedRoute>
          }
        />


        <Route
          path="/archive"
          element={
            <ProtectedRoute>
              <ArchivePage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {background ? (
        <Routes>
          <Route
            path="/edit/:postId"
            element={
              <ProtectedRoute>
                <EditAudioPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      ) : null}

      <AssistantWidget />
    </>
  )
}

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <ChatProvider>
          <AudioPlayerProvider>
            <PodcastProvider>
              <TagFilterProvider>
                <BrowserRouter>
                  <AppRoutes />
                </BrowserRouter>
              </TagFilterProvider>
            </PodcastProvider>
          </AudioPlayerProvider>
        </ChatProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;