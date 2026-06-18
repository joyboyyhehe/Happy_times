import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext.jsx';
import LoginScreen from './pages/auth/LoginScreen.jsx';
import { logTelemetryEvent } from './services/telemetry.js';
import AppLogo from './components/AppLogo.jsx';

// Lazy load dashboard chunks for optimal mobile page-load speed
const ParentDashboard = lazy(() => import('./pages/parent/ParentDashboard.jsx'));
const BranchAdminDashboard = lazy(() => import('./pages/branchadmin/BranchAdminDashboard.jsx'));
const SuperAdminDashboard = lazy(() => import('./pages/superadmin/SuperAdminDashboard.jsx'));
const FeeRecorder = lazy(() => import('./pages/superadmin/FeeRecorder.jsx'));

function ProtectedRoute({ children, allowedRoles }) {
  const { authState, profile, maintenanceSettings, retryProfileLoad } = useAuth();
  const [retrying, setRetrying] = useState(false);

  if (authState === 'BOOTING' || authState === 'PROFILE_LOADING' || authState === 'AUTHENTICATING') {
    return (
      <div className="page-shell">
        <div className="loading-container">
          <div className="spinner" />
        </div>
      </div>
    );
  }

  if (authState === 'UNAUTHENTICATED') {
    return <Navigate to="/" replace />;
  }

  // Profile loaded but null / error
  if (authState === 'PROFILE_ERROR' || !profile) {
    return (
      <div className="page-shell" style={{ justifyContent: 'center', alignItems: 'center', padding: 24, display: 'flex', height: '100vh', boxSizing: 'border-box' }}>
        <div style={{ textAlign: 'center', maxWidth: 300 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: 'var(--text-dark)' }}>
            Profile not loaded
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.5 }}>
            Could not load your account. This may be a network issue.
          </div>
          <button
            className="btn btn-primary"
            style={{ marginBottom: 12, cursor: 'pointer' }}
            disabled={retrying}
            onClick={async () => {
              setRetrying(true);
              await retryProfileLoad();
              setRetrying(false);
            }}
          >
            {retrying ? <div className="spinner spinner-sm" style={{ borderTopColor: 'white' }} /> : 'Retry'}
          </button>
          <br />
          <button
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
            onClick={() => {
              import('./services/authService.js').then(({ logout }) => {
                logout().then(() => {
                  window.location.href = '/';
                });
              });
            }}
          >
            Sign out and try again
          </button>
        </div>
      </div>
    );
  }

  // Maintenance mode active for parents
  if (maintenanceSettings?.enabled && profile?.role === 'parent') {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles && profile) {
    if (!allowedRoles.includes(profile.role)) {
      return <Navigate to="/" replace />;
    }
  }
  return children;
}

function SplashRouter() {
  const { authState, profile, maintenanceSettings, retryProfileLoad } = useAuth();
  const [retrying, setRetrying] = useState(false);

  if (authState === 'BOOTING' || authState === 'PROFILE_LOADING' || authState === 'AUTHENTICATING') {
    return (
      <div className="page-shell" style={{ justifyContent: 'center', alignItems: 'center', display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <AppLogo variant="splash" />
        <div className="spinner" style={{ marginTop: 16 }} />
        {authState === 'PROFILE_LOADING' && (
          <div style={{ marginTop: 16, fontSize: 14, color: 'var(--text-muted)' }}>
            Loading your profile...
          </div>
        )}
      </div>
    );
  }

  if (authState === 'UNAUTHENTICATED') {
    return <Navigate to="/" replace />;
  }

  if (authState === 'PROFILE_ERROR' || !profile) {
    return (
      <div className="page-shell" style={{ justifyContent: 'center', alignItems: 'center', padding: 24, display: 'flex', height: '100vh', boxSizing: 'border-box' }}>
        <div style={{ textAlign: 'center', maxWidth: 300 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: 'var(--text-dark)' }}>
            Profile not found
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.5 }}>
            We couldn't load your account profile. If you are a parent, please ensure your mobile number is registered with the school.
          </div>
          <button
            className="btn btn-primary"
            style={{ marginBottom: 12, cursor: 'pointer' }}
            disabled={retrying}
            onClick={async () => {
              setRetrying(true);
              await retryProfileLoad();
              setRetrying(false);
            }}
          >
            {retrying ? <div className="spinner spinner-sm" style={{ borderTopColor: 'white' }} /> : 'Retry'}
          </button>
          <br />
          <button
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
            onClick={() => {
              import('./services/authService.js').then(({ logout }) => {
                logout().then(() => {
                  window.location.href = '/';
                });
              });
            }}
          >
            Sign out and try again
          </button>
        </div>
      </div>
    );
  }

  // Maintenance mode active for parents
  if (maintenanceSettings?.enabled && profile?.role === 'parent') {
    return <Navigate to="/" replace />;
  }

  switch (profile?.role) {
    case 'superadmin': return <Navigate to="/super-admin" replace />;
    case 'branchadmin': return <Navigate to="/branch-admin" replace />;
    case 'parent': return <Navigate to="/parent" replace />;
    default: 
      import('./services/authService.js').then(({ logout }) => {
        logout().then(() => {
          window.location.href = '/';
        });
      });
      return (
        <div className="page-shell" style={{ justifyContent: 'center', alignItems: 'center', display: 'flex', height: '100vh' }}>
          <div className="spinner" />
        </div>
      );
  }
}

function MainRouter() {
  const { authState, profile, maintenanceSettings } = useAuth();

  if (authState === 'BOOTING' || authState === 'PROFILE_LOADING') {
    return (
      <div className="page-shell" style={{ justifyContent: 'center', alignItems: 'center', display: 'flex', height: '100vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  // If already authenticated and profile loaded
  if (authState === 'AUTHENTICATED') {
    if (maintenanceSettings?.enabled && profile?.role === 'parent') {
      return <LoginScreen />;
    }
    return <Navigate to="/portal" replace />;
  }

  return <LoginScreen />;
}

// Emergency Login Route: Bypasses the installation gate completely
function EmergencyLoginRoute() {
  useEffect(() => {
    sessionStorage.setItem('emergency_bypass', 'true');
    sessionStorage.setItem('browser_login_allowed', 'true');
    logTelemetryEvent('emergency_bypass_triggered');
  }, []);

  return <Navigate to="/" replace />;
}

function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showRestored, setShowRestored] = useState(false);
  const [queuedWrites, setQueuedWrites] = useState(window.pendingWritesCount || 0);

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
      logTelemetryEvent('offline_mode_enabled');
    }
    function handlePendingWritesChange(e) {
      setQueuedWrites(e.detail || 0);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('pendingWritesChanged', handlePendingWritesChange);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('pendingWritesChanged', handlePendingWritesChange);
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
        <span>You are offline. Working in offline mode. {queuedWrites > 0 ? `(${queuedWrites} pending sync)` : ''}</span>
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
    <>
      <div className="ios-status-bar-bg" />
      <Suspense fallback={
        <div className="page-shell" style={{ justifyContent: 'center', alignItems: 'center', display: 'flex', height: '100vh' }}>
          <div className="loading-container">
            <div className="spinner" />
          </div>
        </div>
      }>
        <OfflineBanner />
      <Routes>
        {/* Main Entry point: renders LoginScreen directly if unauthenticated */}
        <Route path="/" element={<MainRouter />} />

        {/* Emergency Login Bypass */}
        <Route path="/emergency-login" element={<EmergencyLoginRoute />} />

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
        {/* ─── Super Admin: Fee Recorder dedicated route ─── */}
        <Route
          path="/super-admin/fees"
          element={
            <ProtectedRoute allowedRoles={['superadmin']}>
              <FeeRecorder />
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </>
  );
}
