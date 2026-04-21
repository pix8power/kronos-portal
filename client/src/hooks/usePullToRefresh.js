import { useEffect, useRef, useState } from 'react';
import { useHaptics } from './useHaptics';

const THRESHOLD = 72; // px to pull before triggering

export function usePullToRefresh(onRefresh) {
  const [pulling, setPulling] = useState(false);
  const [pullY, setPullY]     = useState(0);
  const startY = useRef(null);
  const { tap } = useHaptics();

  useEffect(() => {
    const el = document.documentElement;

    const onTouchStart = (e) => {
      if (el.scrollTop === 0) startY.current = e.touches[0].clientY;
    };

    const onTouchMove = (e) => {
      if (startY.current === null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy > 0 && el.scrollTop === 0) {
        e.preventDefault();
        setPullY(Math.min(dy, THRESHOLD * 1.5));
        setPulling(dy >= THRESHOLD);
      }
    };

    const onTouchEnd = async () => {
      if (pulling) {
        tap();
        await onRefresh();
      }
      startY.current = null;
      setPullY(0);
      setPulling(false);
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [onRefresh, pulling, tap]);

  return { pullY, pulling };
}
