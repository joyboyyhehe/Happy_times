import { getMessagingInstance, db } from '../config/firebase.js';
import { getToken, onMessage } from 'firebase/messaging';
import { doc, setDoc, arrayUnion } from 'firebase/firestore';
import { auth } from '../config/firebase.js';
import { logTelemetryEvent, logTelemetryError } from './telemetry.js';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

export async function initNotifications() {
  try {
    const messaging = await getMessagingInstance();
    if (!messaging) {
      console.warn('FCM not supported in this browser');
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('Notification permission denied');
      logTelemetryEvent('notification_permission_denied');
      return;
    }

    // Get the active Workbox service worker registration
    const registration = await navigator.serviceWorker.ready;

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (token && auth.currentUser) {
      // Save token directly to Firestore for backwards compatibility
      await setDoc(doc(db, 'fcm_tokens', auth.currentUser.uid), {
        token,
        updatedAt: new Date(),
      }, { merge: true });

      // Save token to users/{uid}.fcmTokens array for Cloud Functions compatibility
      await setDoc(doc(db, 'users', auth.currentUser.uid), {
        fcmTokens: arrayUnion(token),
        updatedAt: new Date(),
      }, { merge: true });

      console.log('FCM token registered on users profile');
      logTelemetryEvent('notification_token_created', { userId: auth.currentUser.uid });
    }

    // Handle foreground messages — use ServiceWorkerRegistration.showNotification()
    // instead of new Notification() because iOS Safari PWA blocks the Notification constructor.
    onMessage(messaging, async (payload) => {
      const { title, body } = payload.notification || {};
      if (!title) return;
      try {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification(title, {
          body,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          vibrate: [200, 100, 200],
          tag: payload.data?.tag || `ht-${Date.now()}`,
          renotify: false,
          data: payload.data || {},
        });
      } catch (notifErr) {
        // Fallback for browsers that block SW notifications in foreground
        try { new Notification(title, { body, icon: '/icon-192.png' }); } catch (_) { /* silent */ }
      }
    });
  } catch (err) {
    console.error('FCM init error:', err);
    logTelemetryError(err, { category: 'notification_registration', isCritical: true });
  }
}
