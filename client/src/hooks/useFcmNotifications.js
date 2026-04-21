import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

export function useFcmNotifications() {
  const { user } = useAuth();
  const setupDone = useRef(false);

  useEffect(() => {
    if (!user || setupDone.current) return;
    if (!Capacitor.isNativePlatform()) return;

    setupDone.current = true;

    async function setup() {
      try {
        // Create notification channel (Android 8+)
        await PushNotifications.createChannel({
          id: 'default',
          name: 'General Notifications',
          description: 'Shift updates and messages',
          importance: 4, // IMPORTANCE_HIGH — shows heads-up popup
          visibility: 1,
          sound: 'default',
          vibration: true,
          lights: true,
        });

        // Request permission
        let perm = await PushNotifications.checkPermissions();
        if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
          perm = await PushNotifications.requestPermissions();
        }
        if (perm.receive !== 'granted') {
          console.warn('[FCM] notification permission denied:', perm.receive);
          return;
        }

        // Remove stale listeners then register fresh ones
        await PushNotifications.removeAllListeners();

        PushNotifications.addListener('registration', async ({ value: token }) => {
          console.log('[FCM] token received:', token.slice(0, 20) + '...');
          try {
            await api.post('/push/fcm-token', { token, platform: Capacitor.getPlatform() });
            console.log('[FCM] token registered with server');
          } catch (err) {
            console.warn('[FCM] token send failed:', err.message);
          }
        });

        PushNotifications.addListener('registrationError', ({ error }) => {
          console.warn('[FCM] registration error:', error);
        });

        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('[FCM] foreground notification:', notification.title);
        });

        PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
          const url = notification.data?.url;
          if (url) window.location.hash = url;
        });

        await PushNotifications.register();
      } catch (err) {
        console.warn('[FCM] setup error:', err.message);
      }
    }

    setup();

    return () => {
      PushNotifications.removeAllListeners();
    };
  }, [user]);
}
