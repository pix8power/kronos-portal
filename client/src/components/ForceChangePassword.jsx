import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { authAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useWebAuthn } from '../hooks/useWebAuthn';

export default function ForceChangePassword() {
  const { setMustChangePassword } = useAuth();
  const { isSupported, registerPasskey } = useWebAuthn();

  const [step, setStep] = useState('password'); // 'password' | 'passkey'
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    if (!agreed) return setError('You must agree to the Terms of Service to continue.');
    setLoading(true);
    try {
      await authAPI.changePasswordFirst({ password });
      if (isSupported) {
        setStep('passkey');
      } else {
        setMustChangePassword(false);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const handleEnrollPasskey = async () => {
    setEnrolling(true);
    setEnrollError('');
    try {
      await registerPasskey();
      setMustChangePassword(false);
    } catch (err) {
      if (err?.name === 'NotAllowedError') {
        setEnrollError('Cancelled. You can set this up later in your Profile.');
      } else {
        setEnrollError('Could not enroll. You can set this up later in your Profile.');
      }
    } finally {
      setEnrolling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] bg-black/60 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8">

        {step === 'password' && (
          <>
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Lock className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <h2 className="text-lg font-bold text-gray-900 text-center mb-1">Set Your Password</h2>
            <p className="text-sm text-gray-500 text-center mb-6">
              You're using a temporary password. Please set a new one to continue.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  placeholder="New password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-2.5 text-gray-400">
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <input
                type={show ? 'text' : 'password'}
                placeholder="Confirm new password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-600">
                  I agree to the{' '}
                  <Link to="/terms" target="_blank" className="text-blue-600 hover:underline">Terms of Service</Link>
                  {' '}and{' '}
                  <Link to="/privacy" target="_blank" className="text-blue-600 hover:underline">Privacy Policy</Link>
                </span>
              </label>
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <button
                type="submit"
                disabled={loading || !agreed}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Set Password & Continue'}
              </button>
            </form>
          </>
        )}

        {step === 'passkey' && (
          <>
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-2xl">
                🔑
              </div>
            </div>
            <h2 className="text-lg font-bold text-gray-900 text-center mb-1">Enable Biometrics?</h2>
            <p className="text-sm text-gray-500 text-center mb-6">
              Use Face ID or your fingerprint to confirm time correction requests — faster and more secure than typing your password every time.
            </p>

            {enrollError && <p className="text-amber-600 text-xs text-center mb-3">{enrollError}</p>}

            <div className="space-y-3">
              <button
                onClick={handleEnrollPasskey}
                disabled={enrolling}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <span>🔒</span>
                {enrolling ? 'Setting up...' : 'Set Up Face ID / Fingerprint'}
              </button>
              <button
                onClick={() => setMustChangePassword(false)}
                className="w-full text-sm text-gray-500 hover:text-gray-700 py-2"
              >
                Skip for now
              </button>
            </div>
            <p className="text-xs text-gray-400 text-center mt-3">
              You can add this later in your Profile.
            </p>
          </>
        )}

      </div>
    </div>
  );
}
