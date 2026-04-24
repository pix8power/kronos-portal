import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { ToastProvider } from './contexts/ToastContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Navbar from './components/Navbar';
import OfflineBanner from './components/OfflineBanner';
import PullToRefresh from './components/PullToRefresh';
import SessionExpired from './components/SessionExpired';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Schedule from './pages/Schedule';
import Messages from './pages/Messages';
import Employees from './pages/Employees';
import MasterSchedule from './pages/MasterSchedule';
import AuditLog from './pages/AuditLog';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Announcements from './pages/Announcements';
import Profile from './pages/Profile';
import Help from './pages/Help';
import Landing from './pages/Landing';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import { useSessionTimeout } from './hooks/useSessionTimeout';
import { usePushNotifications } from './hooks/usePushNotifications';
import { useFcmNotifications } from './hooks/useFcmNotifications';
import InstallPrompt from './components/InstallPrompt';
import ForceChangePassword from './components/ForceChangePassword';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }
  return user ? children : <Navigate to="/login" replace />;
};

// Session warning banner — appears 1 min before auto-logout
function SessionWarningBanner() {
  const [show, setShow] = useState(false);
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    const onWarning = () => { setShow(true); setTimeout(() => setShow(false), 55000); };
    const onExpired = () => setExpired(true);
    window.addEventListener('session-warning', onWarning);
    window.addEventListener('session-expired', onExpired);
    return () => { window.removeEventListener('session-warning', onWarning); window.removeEventListener('session-expired', onExpired); };
  }, []);
  return (
    <>
      {expired && <SessionExpired />}
      {show && !expired && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] bg-amber-500 text-white text-sm font-medium px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-bounce-once">
          <span>Your session will expire in 1 minute due to inactivity.</span>
          <button onClick={() => { setShow(false); window.dispatchEvent(new MouseEvent('mousemove')); }} className="underline hover:no-underline">Stay logged in</button>
        </div>
      )}
    </>
  );
}

const AppLayout = ({ children }) => (
  <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
    <OfflineBanner />
    <Navbar />
    <PullToRefresh onRefresh={() => window.location.reload()} />
    <main className="max-w-full">{children}</main>
  </div>
);

function AppRoutes() {
  const { user, mustChangePassword } = useAuth();
  useSessionTimeout();
  usePushNotifications();
  useFcmNotifications();

  return (
    <>
      <SessionWarningBanner />
      <InstallPrompt />
      {mustChangePassword && <ForceChangePassword />}
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />
        <Route path="/forgot-password" element={user ? <Navigate to="/" replace /> : <ForgotPassword />} />
        <Route path="/reset-password/:token" element={user ? <Navigate to="/" replace /> : <ResetPassword />} />
        <Route path="/" element={user ? <ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute> : <Landing />} />
        <Route path="/dashboard" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
        <Route path="/schedule" element={<ProtectedRoute><AppLayout><Schedule /></AppLayout></ProtectedRoute>} />
        <Route path="/messages" element={<ProtectedRoute><AppLayout><Messages /></AppLayout></ProtectedRoute>} />
        <Route path="/employees" element={<ProtectedRoute><AppLayout><Employees /></AppLayout></ProtectedRoute>} />
        <Route path="/master-schedule" element={<ProtectedRoute><AppLayout><MasterSchedule /></AppLayout></ProtectedRoute>} />
        <Route path="/audit-log" element={<ProtectedRoute><AppLayout><AuditLog /></AppLayout></ProtectedRoute>} />
        <Route path="/announcements" element={<ProtectedRoute><AppLayout><Announcements /></AppLayout></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><AppLayout><Profile /></AppLayout></ProtectedRoute>} />
        <Route path="/profile/:id" element={<ProtectedRoute><AppLayout><Profile /></AppLayout></ProtectedRoute>} />
        <Route path="/help" element={<ProtectedRoute><AppLayout><Help /></AppLayout></ProtectedRoute>} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SocketProvider>
          <ToastProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </ToastProvider>
        </SocketProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
