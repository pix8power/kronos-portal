import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { RefreshCw } from 'lucide-react';

export default function PullToRefresh({ onRefresh }) {
  const { pullY, pulling } = usePullToRefresh(onRefresh);

  if (pullY === 0) return null;

  const progress = Math.min(pullY / 72, 1);

  return (
    <div
      className="fixed top-14 left-1/2 -translate-x-1/2 z-50 flex items-center justify-center"
      style={{ transform: `translateX(-50%) translateY(${pullY * 0.5}px)`, opacity: progress }}
    >
      <div className={`bg-white rounded-full shadow-md p-2.5 border border-gray-100 ${pulling ? 'text-blue-600' : 'text-gray-400'}`}>
        <RefreshCw className="h-5 w-5" style={{ transform: `rotate(${progress * 360}deg)`, transition: pulling ? 'none' : 'transform 0.2s' }} />
      </div>
    </div>
  );
}
