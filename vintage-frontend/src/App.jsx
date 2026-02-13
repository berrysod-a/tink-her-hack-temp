import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import MusicZone from './pages/MusicZone';
import MoviesZone from './pages/MoviesZone';
import MemoryLane from './pages/MemoryLane';
import GamesZone from './pages/GamesZone';

// Global YouTube API Loader Helper
window.loadYouTubeAPI = () => {
  if (window._ytPromise) return window._ytPromise;

  window._ytPromise = new Promise((resolve) => {
    if (window.YT && window.YT.Player) {
      resolve(window.YT);
      return;
    }

    const existingTag = document.getElementById('youtube-sdk');
    if (existingTag) {
      const check = setInterval(() => {
        if (window.YT && window.YT.Player) {
          clearInterval(check);
          resolve(window.YT);
        }
      }, 100);
      return;
    }

    const tag = document.createElement('script');
    tag.id = 'youtube-sdk';
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      resolve(window.YT);
    };
  });

  return window._ytPromise;
};

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-xl font-black uppercase tracking-widest animate-pulse">Loading...</div>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/music" element={
            <ProtectedRoute>
              <MusicZone />
            </ProtectedRoute>
          } />
          <Route path="/movies" element={
            <ProtectedRoute>
              <MoviesZone />
            </ProtectedRoute>
          } />
          <Route path="/history" element={
            <ProtectedRoute>
              <MemoryLane />
            </ProtectedRoute>
          } />
          <Route path="/games" element={
            <ProtectedRoute>
              <GamesZone />
            </ProtectedRoute>
          } />
          <Route path="/" element={<Navigate to="/dashboard" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
