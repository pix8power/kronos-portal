import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

export default function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);
  const [showBack, setShowBack] = useState(false);

  useEffect(() => {
    const goOffline = () => { setOffline(true); setShowBack(false); };
    const goOnline  = () => { setOffline(false); setShowBack(true); setTimeout(() => setShowBack(false), 3000); };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online',  goOnline);
    return () => { window.removeEventListener('offline', goOffline); window.removeEventListener('online', goOnline); };
  }, []);

  if (!offline && !showBack) return null;

  return (
    <div className={`fixed top-0 left-0 right-0 z-[150] flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white animate-slide-down ${offline ? 'bg-red-600' : 'bg-green-600'}`}>
      <WifiOff className="h-4 w-4" />
      {offline ? 'No internet connection' : 'Back online'}
    </div>
  );
}
