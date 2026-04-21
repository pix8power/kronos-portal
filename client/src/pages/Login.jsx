import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, Eye, EyeOff, AlertTriangle, Fingerprint } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const MAX_ATTEMPTS = 3;
const BIOMETRIC_TOKEN_KEY = 'biometric_token';

const getBiometricPlugin = async () => {
  if (!window.Capacitor?.isNativePlatform()) return null;
  try {
    const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
    return BiometricAuth;
  } catch { return null; }
};

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [failCount, setFailCount] = useState(0);
  const [locked, setLocked] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);

  const showRecovery = failCount >= MAX_ATTEMPTS || locked;

  useEffect(() => {
    (async () => {
      const plugin = await getBiometricPlugin();
      if (!plugin) return;
      try {
        const info = await plugin.checkBiometry();
        const token = localStorage.getItem(BIOMETRIC_TOKEN_KEY);
        setBiometricAvailable(info.isAvailable && !!token);
      } catch { /* not available */ }
    })();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      // On successful login on native, offer to save token for biometrics
      if (window.Capacitor?.isNativePlatform()) {
        const token = localStorage.getItem('token');
        if (token) localStorage.setItem(BIOMETRIC_TOKEN_KEY, token);
      }
      navigate('/');
    } catch (err) {
      const data = err.response?.data;
      const status = err.response?.status;
      if (status === 423 || data?.locked) {
        setLocked(true);
        setError(data?.message || 'Account temporarily locked.');
      } else {
        const newCount = failCount + 1;
        setFailCount(newCount);
        const attemptsLeft = data?.attemptsLeft ?? Math.max(0, MAX_ATTEMPTS - newCount);
        if (attemptsLeft === 0 || newCount >= MAX_ATTEMPTS) {
          setError('Too many failed attempts. Please reset your password.');
        } else {
          setError(`${data?.message || 'Invalid credentials'} — ${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} remaining.`);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBiometric = async () => {
    const plugin = await getBiometricPlugin();
    if (!plugin) return;
    setBiometricLoading(true);
    setError('');
    try {
      await plugin.authenticate({ reason: 'Sign in to KronosPortal', cancelTitle: 'Cancel' });
      const token = localStorage.getItem(BIOMETRIC_TOKEN_KEY);
      if (!token) { setError('No saved session — please sign in with your password first.'); return; }
      // Re-use the saved token; the API interceptor will handle 401 if expired
      localStorage.setItem('token', token);
      navigate('/');
    } catch (err) {
      if (err.code !== 'authenticationFailed') return; // user cancelled
      setError('Biometric authentication failed. Please use your password.');
    } finally {
      setBiometricLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-4">
            <Calendar className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome back</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Sign in to KronosPortal</p>
        </div>

        {error && (
          <div className={`border rounded-lg px-4 py-3 text-sm mb-4 flex items-start gap-2 ${
            showRecovery
              ? 'bg-amber-50 border-amber-300 text-amber-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}>
            {showRecovery && <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />}
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              disabled={locked}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400 placeholder:text-gray-400 dark:placeholder:text-gray-500"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                disabled={locked}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10 disabled:bg-gray-50 disabled:text-gray-400 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {!showRecovery && (
            <button
              type="submit"
              disabled={loading || locked}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2.5 rounded-lg transition-colors"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          )}
        </form>

        {/* Biometric login */}
        {biometricAvailable && !showRecovery && (
          <button
            onClick={handleBiometric}
            disabled={biometricLoading}
            className="mt-3 w-full flex items-center justify-center gap-2 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium py-2.5 rounded-lg transition-colors"
          >
            <Fingerprint className="h-5 w-5 text-blue-500" />
            {biometricLoading ? 'Authenticating...' : 'Sign in with Biometrics'}
          </button>
        )}

        {/* Recover password */}
        {showRecovery && (
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-center space-y-3">
            <p className="text-sm font-medium text-amber-900">Having trouble signing in?</p>
            <Link
              to={`/forgot-password${form.email ? `?email=${encodeURIComponent(form.email)}` : ''}`}
              className="block w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
            >
              Reset my password
            </Link>
            {!locked && (
              <button
                onClick={() => { setFailCount(0); setError(''); }}
                className="text-xs text-amber-700 hover:text-amber-900 underline"
              >
                Try again anyway
              </button>
            )}
          </div>
        )}

        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="text-blue-600 hover:underline font-medium">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
