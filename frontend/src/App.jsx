import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import HomePage from "./pages/HomePage/HomePage";
import FeedPage from "./pages/FeedPage/FeedPage";
import ChatPage from "./pages/ChatPage/ChatPage";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider, useAuth } from "./components/contexts/AuthContext";

function RootRedirect() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div style={{ padding: 24 }}>Loading...</div>;
  }

  if (isAuthenticated) {
    return <Navigate to="/feed" replace />;
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
            path="/messages"
            element={
              <ProtectedRoute>
                <ChatPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;