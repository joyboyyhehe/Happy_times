import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext.jsx';
import LoginScreen from './pages/auth/LoginScreen.jsx';
import ParentDashboard from './pages/parent/ParentDashboard.jsx';
import BranchAdminDashboard from './pages/branchadmin/BranchAdminDashboard.jsx';
import SuperAdminDashboard from './pages/superadmin/SuperAdminDashboard.jsx';

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

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/portal" element={<SplashRouter />} />
      <Route path="/login" element={<LoginScreen />} />
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
  );
}
