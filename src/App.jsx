import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext.jsx';
import LoginScreen from './pages/auth/LoginScreen.jsx';
import LandingPage from './pages/LandingPage.jsx';
import { logTelemetryEvent } from './services/telemetry.js';
import { isStandalone, isInstalledApp } from './utils/appMode.js';
import { auth } from './config/firebase.js';
import AppLogo from './components/AppLogo.jsx';

// Lazy load dashboard chunks for optimal mobile page-load speed
const ParentDashboard = lazy(() => import('./pages/parent/ParentDashboard.jsx'));
const BranchAdminDashboard = lazy(() => import('./pages/branchadmin/BranchAdminDashboard.jsx'));
const SuperAdminDashboard = lazy(() => import('./pages/superadmin/SuperAdminDashboard.jsx'));
const FeeRecorder = lazy(() => import('./pages/superadmin/FeeRecorder.jsx'));

// Check if installation gate is bypassed
function isBypassed() {
  const disableInstallGate = import.meta.env.VITE_DISABLE_INSTALL_GATE === 'true';
  const emergencyBypass = sessionStorage.getItem('emergency_bypass') === 'true';
  const browserLoginAllowed = sessionStorage.getItem('browser_login_allowed') === 'true';
  return isInstalledApp() || disableInstallGate || emergencyBypass || browserLoginAllowed;
}

function ProtectedRoute({ children, allowedRoles }) {
  const { user, profile, loading, refreshProfile } = useAuth();
  const [retrying, setRetrying] = useState(false);
  const bypassed = isBypassed();

  if (loading) {
    return (
      <div className="page-shell">
        <div className="loading-container">
          <div className="spinner" />
        </div>
      </div>
    );
  }

  // Enforce PWA installation gate
  if (!bypassed) {
    return <Navigate to="/" replace />;
  }

  if (!user) return <Navigate to="/login" replace />;

  // Profile loaded but null = Firestore couldn't fetch it
  if (!profile && !loading) {
    return (
      <div className="page-shell" style={{ justifyContent: 'center', alignItems: 'center', padding: 24 }}>
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
            style={{ marginBottom: 12 }}
            disabled={retrying}
            onClick={async () => {
              setRetrying(true);
              await refreshProfile();
              setRetrying(false);
            }}
          >
            {retrying ? <div className="spinner spinner-sm" style={{ borderTopColor: 'white' }} /> : 'Retry'}
          </button>
          <br />
          <button
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
            onClick={() => { auth.signOut(); window.location.href = '/login'; }}
          >
            Sign out and try again
          </button>
        </div>
      </div>
    );
  }

  if (allowedRoles && profile) {
    if (!allowedRoles.includes(profile.role)) {
      return <Navigate to="/login" replace />;
    }
  }
  return children;
}

function SplashRouter() {
  const { user, profile, loading } = useAuth();
  const bypassed = isBypassed();

  if (loading) {
    return (
      <div className="page-shell" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <AppLogo variant="splash" />
        <div className="spinner" />
      </div>
    );
  }

  // Enforce PWA installation gate
  if (!bypassed) {
    return <Navigate to="/" replace />;
  }

  if (!user) return <LoginScreen />;

  switch (profile?.role) {
    case 'superadmin': return <Navigate to="/super-admin" replace />;
    case 'branchadmin': return <Navigate to="/branch-admin" replace />;
    case 'parent': return <Navigate to="/parent" replace />;
    default: return <LoginScreen />;
  }
}

function MainRouter() {
  const { user, loading } = useAuth();
  const bypassed = isBypassed();

  if (loading) {
    return (
      <div className="page-shell" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="spinner" />
      </div>
    );
  }

  // If already authenticated and bypassed, go straight to portal
  if (user && bypassed) {
    return <Navigate to="/portal" replace />;
  }

  if (bypassed) {
    return <Navigate to="/portal" replace />;
  }

  return <LandingPage />;
}

function LoginRoute() {
  const { user, loading } = useAuth();
  const bypassed = isBypassed();

  if (loading) {
    return (
      <div className="page-shell" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="spinner" />
      </div>
    );
  }

  // If already authenticated and bypassed, go straight to portal
  if (user && bypassed) {
    return <Navigate to="/portal" replace />;
  }

  // Enforce PWA installation gate
  if (!bypassed) {
    return <Navigate to="/" replace />;
  }

  return <LoginScreen />;
}

// Emergency Login Route: Bypasses the installation gate completely
function EmergencyLoginRoute() {
  useEffect(() => {
    sessionStorage.setItem('emergency_bypass', 'true');
    sessionStorage.setItem('browser_login_allowed', 'true');
    logTelemetryEvent('emergency_bypass_triggered');
    
    // Generate browser fingerprint safely
    const parts = [
      navigator.userAgent || '',
      navigator.language || '',
      (window.screen?.width || 0) + 'x' + (window.screen?.height || 0),
      new Date().getTimezoneOffset()
    ];
    const str = parts.join('|');
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
    }
    const fingerprint = 'fp_' + (hash >>> 0).toString(16);
    
    const browser = navigator.userAgent.includes('Chrome') ? 'Chrome' :
                    navigator.userAgent.includes('Safari') ? 'Safari' :
                    navigator.userAgent.includes('Firefox') ? 'Firefox' : 'Other';

    // Log directly to firestore install_telemetry collection
    import('./config/firebase.js').then(({ db }) => {
      import('firebase/firestore').then(({ collection, addDoc, serverTimestamp }) => {
        addDoc(collection(db, 'install_telemetry'), {
          event: 'emergency_login_used',
          browser: browser.substring(0, 50),
          userAgent: navigator.userAgent.substring(0, 300),
          standalone: false,
          fingerprint,
          timestamp: serverTimestamp()
        }).catch(err => console.warn('Failed to write emergency bypass log:', err));
      });
    });
  }, []);

  return <Navigate to="/login" replace />;
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
        <div className="page-shell" style={{ justifyContent: 'center', alignItems: 'center' }}>
          <div className="loading-container">
            <div className="spinner" />
          </div>
        </div>
      }>
        <OfflineBanner />
      <Routes>
        {/* Main Entry point: renders LandingPage in browser or redirects to portal in standalone */}
        <Route path="/" element={<MainRouter />} />

        {/* Auth — redirects to landing page in browser mode if unauthenticated */}
        <Route path="/login" element={<LoginRoute />} />

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
