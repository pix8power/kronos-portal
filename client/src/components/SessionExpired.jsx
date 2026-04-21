import { LogIn } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function SessionExpired() {
  const { logout } = useAuth();

  return (
    <div className="fixed inset-0 z-[300] bg-gray-900/60 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center animate-slide-down">
        <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <LogIn className="h-7 w-7 text-amber-600" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Session Expired</h2>
        <p className="text-sm text-gray-500 mb-5">You were logged out due to inactivity. Please sign in again.</p>
        <button
          onClick={logout}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold text-sm"
        >
          Sign In Again
        </button>
      </div>
    </div>
  );
}
