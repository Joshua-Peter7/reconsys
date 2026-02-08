import { Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/Login';
import DashboardPage from './pages/Dashboard';
import UploadPage from './pages/Upload';
import ReconciliationPage from './pages/Reconciliation';
import AuditTimelinePage from './pages/AuditTimeline';
import ProtectedRoute from './components/ProtectedRoute';
import Navigation from './components/Navigation';
import { useAuth } from './context/AuthContext';

function AppShell() {
  return (
    <div className="app-shell">
      <Navigation />
      <main className="app-content">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/upload" element={<ProtectedRoute allowedRoles={['admin', 'analyst']}><UploadPage /></ProtectedRoute>} />
          <Route path="/reconciliation" element={<ReconciliationPage />} />
          <Route path="/audit" element={<AuditTimelinePage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute allowedRoles={['admin', 'analyst', 'viewer']}>
            <AppShell />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
