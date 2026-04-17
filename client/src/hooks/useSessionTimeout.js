import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes idle
const WARNING_MS = 60 * 1000;       // warn 1 minute before

export function useSessionTimeout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const timerRef = useRef(null);
  const warnRef = useRef(null);
  const warningShownRef = useRef(false);

  const reset = useCallback(() => {
    clearTimeout(timerRef.current);
    clearTimeout(warnRef.current);
    warningShownRef.current = false;

    if (!user) return;

    warnRef.current = setTimeout(() => {
      if (!warningShownRef.current) {
        warningShownRef.current = true;
        // Use a non-blocking toast-style warning via custom event
        window.dispatchEvent(new CustomEvent('session-warning'));
      }
    }, TIMEOUT_MS - WARNING_MS);

    timerRef.current = setTimeout(async () => {
      await logout();
      navigate('/login');
    }, TIMEOUT_MS);
  }, [user, logout, navigate]);

  useEffect(() => {
    if (!user) return;
    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    const handler = () => reset();
    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));
    reset();
    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
      clearTimeout(timerRef.current);
      clearTimeout(warnRef.current);
    };
  }, [user, reset]);
}
