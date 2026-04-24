import { useState, useEffect } from 'react';
import { X, Share, Plus } from 'lucide-react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isStandalone) return;
    if (localStorage.getItem('installDismissed')) return;

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(ios);

    if (ios) {
      setTimeout(() => setShow(true), 2000);
      return;
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setShow(true), 2000);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') dismiss();
    setDeferredPrompt(null);
  };

  const dismiss = () => {
    setShow(false);
    localStorage.setItem('installDismissed', '1');
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[200] max-w-sm mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 animate-slide-up">
      <button onClick={dismiss} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
        <X size={18} />
      </button>
      <div className="flex items-center gap-3 mb-3">
        <img src="/icons/icon-192.png" alt="Kronos" className="w-12 h-12 rounded-xl" />
        <div>
          <p className="font-semibold text-gray-900 dark:text-white text-sm">Install KronosPortal</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Add to your home screen</p>
        </div>
      </div>
      {isIOS ? (
        <div className="text-xs text-gray-600 dark:text-gray-300 space-y-1">
          <p>Tap <Share size={12} className="inline" /> <strong>Share</strong> at the bottom of Safari, then</p>
          <p>tap <Plus size={12} className="inline" /> <strong>Add to Home Screen</strong></p>
        </div>
      ) : (
        <button
          onClick={handleInstall}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 rounded-xl transition-colors"
        >
          Add to Home Screen
        </button>
      )}
    </div>
  );
}
