import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext.jsx';
import LoginScreen from './pages/auth/LoginScreen.jsx';
import LandingPage from './pages/LandingPage.jsx';

// Lazy load dashboard chunks for optimal mobile page-load speed
const ParentDashboard = lazy(() => import('./pages/parent/ParentDashboard.jsx'));
const BranchAdminDashboard = lazy(() => import('./pages/branchadmin/BranchAdminDashboard.jsx'));
const SuperAdminDashboard = lazy(() => import('./pages/superadmin/SuperAdminDashboard.jsx'));

/** Returns true when the app is running as an installed PWA (standalone / fullscreen) */
function isInstalledPWA() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.navigator.standalone === true // iOS Safari
  );
}

/** Root redirect: installed PWA → /login, browser first visit → /landingpage */
function RootRedirect() {
  if (isInstalledPWA()) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to="/landingpage" replace />;
}

function ProtectedRoute({ children, allowedRoles }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="page-shell">
        <div className="loading-container">
          <div className="spinner" />
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function SplashRouter() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="page-shell" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{
          width: 64, height: 64,
          background: 'linear-gradient(135deg, #E8451A, #F5A623)',
          borderRadius: 'var(--radius-lg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(232,69,26,0.3)',
          marginBottom: 20,
        }}>
          <span style={{ color: 'white', fontWeight: 800, fontSize: 18 }}>HT</span>
        </div>
        <div className="spinner" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  switch (profile?.role) {
    case 'superadmin': return <Navigate to="/super-admin" replace />;
    case 'branchadmin': return <Navigate to="/branch-admin" replace />;
    case 'parent': return <Navigate to="/parent" replace />;
    default: return <Navigate to="/login" replace />;
  }
}

function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    function handleOnline() {
      setIsOffline(false);
      setShowRestored(true);
      const timer = setTimeout(() => setShowRestored(false), 3000);
      return () => clearTimeout(timer);
    }
    function handleOffline() {
      setIsOffline(true);
      setShowRestored(false);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOffline) {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        backgroundColor: '#E8451A', color: 'white',
        textAlign: 'center', padding: '8px 16px', fontSize: '13px',
        fontWeight: '600', zIndex: 9999, display: 'flex',
        alignItems: 'center', justifyContent: 'center', gap: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
        transition: 'all 0.3s ease'
      }}>
        <span>📴</span>
        <span>You are offline. Working in offline mode with cached data.</span>
      </div>
    );
  }

  if (showRestored) {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        backgroundColor: '#4CAF50', color: 'white',
        textAlign: 'center', padding: '8px 16px', fontSize: '13px',
        fontWeight: '600', zIndex: 9999, display: 'flex',
        alignItems: 'center', justifyContent: 'center', gap: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
        transition: 'all 0.3s ease'
      }}>
        <span>📶</span>
        <span>Back online! Syncing and updating data...</span>
      </div>
    );
  }

  return null;
}

export default function App() {
  return (
    <Suspense fallback={
      <div className="page-shell" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="loading-container">
          <div className="spinner" />
        </div>
      </div>
    }>
      <OfflineBanner />
      <Routes>
        {/* Root: smart redirect based on PWA install state */}
        <Route path="/" element={<RootRedirect />} />

        {/* Landing page — shown when opened in browser for the first time */}
        <Route path="/landingpage" element={<LandingPage />} />

        {/* Auth */}
        <Route path="/login" element={<LoginScreen />} />

        {/* Portal splash router */}
        <Route path="/portal" element={<SplashRouter />} />

        {/* Protected dashboards */}
        <Route
          path="/parent/*"
          element={
            <ProtectedRoute allowedRoles={['parent']}>
              <ParentDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/branch-admin/*"
          element={
            <ProtectedRoute allowedRoles={['branchadmin']}>
              <BranchAdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/super-admin/*"
          element={
            <ProtectedRoute allowedRoles={['superadmin']}>
              <SuperAdminDashboard />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Suspense>
  );
}
