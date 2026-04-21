import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
// api baseURL is already '/api', so paths below are relative to that

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function usePushNotifications() {
  const { user } = useAuth();
  const subscribedRef = useRef(false);

  useEffect(() => {
    if (!user || subscribedRef.current) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    async function subscribe() {
      try {
        // Register (or reuse) the service worker
        const reg = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;

        // Ask for permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        // Get the VAPID public key
        const { data } = await api.get('/push/vapid-public-key');
        const applicationServerKey = urlBase64ToUint8Array(data.publicKey);

        // Subscribe
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });

        // Send subscription to server
        const subJson = sub.toJSON();
        await api.post('/push/subscribe', {
          endpoint: subJson.endpoint,
          keys: subJson.keys,
        });

        subscribedRef.current = true;
      } catch (err) {
        console.warn('[push] subscription failed:', err.message);
      }
    }

    subscribe();
  }, [user]);
}
