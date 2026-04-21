import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { Check, X, AlertCircle, Info } from 'lucide-react';

const ToastContext = createContext(null);

const ICONS = {
  success: <Check className="h-4 w-4" />,
  error:   <X className="h-4 w-4" />,
  warning: <AlertCircle className="h-4 w-4" />,
  info:    <Info className="h-4 w-4" />,
};

const COLORS = {
  success: 'bg-green-600',
  error:   'bg-red-600',
  warning: 'bg-amber-500',
  info:    'bg-blue-600',
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timerRefs = useRef({});

  const dismiss = useCallback((id) => {
    clearTimeout(timerRefs.current[id]);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message, type = 'info', duration = 3000) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-3), { id, message, type }]);
    timerRefs.current[id] = setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  const success = useCallback((msg, dur) => toast(msg, 'success', dur), [toast]);
  const error   = useCallback((msg, dur) => toast(msg, 'error', dur || 4000), [toast]);
  const warning = useCallback((msg, dur) => toast(msg, 'warning', dur), [toast]);
  const info    = useCallback((msg, dur) => toast(msg, 'info', dur), [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info, dismiss }}>
      {children}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-2 items-center pointer-events-none" style={{ width: 'calc(100% - 2rem)', maxWidth: '360px' }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`${COLORS[t.type]} text-white flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg w-full pointer-events-auto animate-toast-in`}
            onClick={() => dismiss(t.id)}
          >
            <span className="flex-shrink-0">{ICONS[t.type]}</span>
            <span className="text-sm font-medium flex-1">{t.message}</span>
            <X className="h-3.5 w-3.5 opacity-60 flex-shrink-0" />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};
