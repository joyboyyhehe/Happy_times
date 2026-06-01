import { getMessagingInstance, db } from '../config/firebase.js';
import { getToken, onMessage } from 'firebase/messaging';
import { doc, setDoc } from 'firebase/firestore';
import { auth } from '../config/firebase.js';

const VAPID_KEY = ''; // TODO: Add VAPID key from Firebase Console → Cloud Messaging

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
      return;
    }

    // Register service worker for FCM
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (token && auth.currentUser) {
      // Save token directly to Firestore
      await setDoc(doc(db, 'fcm_tokens', auth.currentUser.uid), {
        token,
        updatedAt: new Date(),
      }, { merge: true });
      console.log('FCM token registered');
    }

    // Handle foreground messages
    onMessage(messaging, (payload) => {
      const { title, body } = payload.notification || {};
      if (title) {
        new Notification(title, {
          body,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
        });
      }
    });
  } catch (err) {
    console.error('FCM init error:', err);
  }
}
