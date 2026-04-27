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

function SplashScreen() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative',
      background: 'linear-gradient(145deg, #0f172a 0%, #1e3a8a 45%, #312e81 100%)',
    }}>

      {/* Depth blobs */}
      <div style={{ position:'absolute', width:500, height:500, borderRadius:'50%', top:-160, right:-160,
        background:'radial-gradient(circle, rgba(99,102,241,0.35) 0%, transparent 70%)',
        animation:'blob1 9s ease-in-out infinite', filter:'blur(1px)' }} />
      <div style={{ position:'absolute', width:400, height:400, borderRadius:'50%', bottom:-120, left:-120,
        background:'radial-gradient(circle, rgba(59,130,246,0.3) 0%, transparent 70%)',
        animation:'blob2 11s ease-in-out infinite', filter:'blur(1px)' }} />
      <div style={{ position:'absolute', width:250, height:250, borderRadius:'50%', top:'38%', left:'8%',
        background:'radial-gradient(circle, rgba(139,92,246,0.2) 0%, transparent 70%)',
        animation:'blob3 13s ease-in-out infinite' }} />
      <div style={{ position:'absolute', width:180, height:180, borderRadius:'50%', top:'20%', right:'12%',
        background:'radial-gradient(circle, rgba(56,189,248,0.15) 0%, transparent 70%)',
        animation:'blob2 7s ease-in-out infinite reverse' }} />

      {/* Dot-grid overlay */}
      <div style={{ position:'absolute', inset:0,
        backgroundImage:'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)',
        backgroundSize:'28px 28px' }} />

      {/* Vignette */}
      <div style={{ position:'absolute', inset:0,
        background:'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.55) 100%)' }} />

      {/* Content */}
      <div style={{ position:'relative', zIndex:1, display:'flex', flexDirection:'column', alignItems:'center' }}>

        {/* Logo + spinning ring */}
        <div style={{ position:'relative', marginBottom:28, animation:'logoIn 0.7s cubic-bezier(0.34,1.56,0.64,1) both' }}>
          {/* Outer breathing glow */}
          <div style={{ position:'absolute', inset:-8, borderRadius:32,
            background:'rgba(99,102,241,0.4)', filter:'blur(24px)',
            animation:'glow 2.5s ease-in-out infinite' }} />

          {/* Spinning arc ring */}
          <svg width={128} height={128} viewBox="0 0 128 128"
            style={{ position:'absolute', top:-16, left:-16, animation:'spin 2.8s linear infinite' }}>
            <defs>
              <linearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(255,255,255,0)" />
                <stop offset="50%" stopColor="rgba(255,255,255,0.9)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </linearGradient>
            </defs>
            <circle cx={64} cy={64} r={58} fill="none"
              stroke="url(#arcGrad)" strokeWidth={2.5}
              strokeDasharray="120 245" strokeLinecap="round" />
          </svg>

          {/* Second slower ring */}
          <svg width={128} height={128} viewBox="0 0 128 128"
            style={{ position:'absolute', top:-16, left:-16, animation:'spinReverse 5s linear infinite' }}>
            <circle cx={64} cy={64} r={58} fill="none"
              stroke="rgba(255,255,255,0.08)" strokeWidth={1}
              strokeDasharray="40 320" strokeLinecap="round" />
          </svg>

          {/* Logo tile */}
          <div style={{
            width:96, height:96, borderRadius:24, overflow:'hidden',
            boxShadow:'0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.15), inset 0 1px 0 rgba(255,255,255,0.2)',
          }}>
            <img src="/icon-192.png" alt="KronosPortal" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
          </div>
        </div>

        {/* App name */}
        <h1 style={{ color:'#fff', fontSize:26, fontWeight:700, letterSpacing:'0.06em',
          margin:'0 0 4px', animation:'fadeUp 0.6s 0.25s ease-out both',
          textShadow:'0 2px 20px rgba(99,102,241,0.6)' }}>
          KronosPortal
        </h1>
        <p style={{ color:'rgba(186,207,255,0.75)', fontSize:11, letterSpacing:'0.22em',
          textTransform:'uppercase', marginBottom:44,
          animation:'fadeUp 0.6s 0.4s ease-out both' }}>
          Staff Scheduling
        </p>

        {/* Shimmer bar */}
        <div style={{ width:100, height:2, borderRadius:2, overflow:'hidden',
          background:'rgba(255,255,255,0.1)', animation:'fadeUp 0.6s 0.55s ease-out both' }}>
          <div style={{ height:'100%', width:'45%',
            background:'linear-gradient(90deg, transparent, rgba(255,255,255,0.85), transparent)',
            animation:'shimmer 1.6s ease-in-out infinite' }} />
        </div>
      </div>

      <style>{`
        @keyframes blob1    { 0%,100%{transform:translate(0,0) scale(1)}   50%{transform:translate(-28px,18px) scale(1.08)} }
        @keyframes blob2    { 0%,100%{transform:translate(0,0) scale(1)}   50%{transform:translate(22px,-28px) scale(0.92)} }
        @keyframes blob3    { 0%,100%{transform:translate(0,0) scale(1)}   50%{transform:translate(24px,18px) scale(1.15)} }
        @keyframes spin         { from{transform:rotate(0deg)}   to{transform:rotate(360deg)} }
        @keyframes spinReverse  { from{transform:rotate(0deg)}   to{transform:rotate(-360deg)} }
        @keyframes glow     { 0%,100%{opacity:.6;transform:scale(1)}   50%{opacity:1;transform:scale(1.12)} }
        @keyframes logoIn   { from{opacity:0;transform:scale(0.75) translateY(12px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes fadeUp   { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer  { 0%{transform:translateX(-180%)} 100%{transform:translateX(420%)} }
      `}</style>
    </div>
  );
}

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <SplashScreen />;
  return user ? children : <Navigate to="/login" replace />;
};

// Session warning banner — appears 1 min before auto-logout
function SessionWarningBanner() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    const onWarning = () => { setShow(true); setTimeout(() => setShow(false), 55000); };
    const onExpired = () => setExpired(true);
    window.addEventListener('session-warning', onWarning);
    window.addEventListener('session-expired', onExpired);
    return () => { window.removeEventListener('session-warning', onWarning); window.removeEventListener('session-expired', onExpired); };
  }, []);

  // Clear overlays the moment user is logged out so login page isn't blocked
  useEffect(() => {
    if (!user) { setExpired(false); setShow(false); }
  }, [user]);
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
