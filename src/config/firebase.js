import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableMultiTabIndexedDbPersistence } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging, isSupported } from 'firebase/messaging';
import { getAnalytics, isSupported as isAnalyticsSupported } from 'firebase/analytics';


const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Enable offline persistence with multi-tab support
if (typeof window !== 'undefined') {
  enableMultiTabIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Firestore multi-tab persistence unavailable: persistence already enabled in another tab');
    } else if (err.code === 'unimplemented') {
      console.warn('Firestore offline persistence unsupported by browser');
    } else {
      console.warn('Firestore offline persistence error:', err);
    }
  });
}

// Messaging may not be supported in all browsers (e.g. Safari < 16.4)
let messagingInstance = null;
export const getMessagingInstance = async () => {
  if (messagingInstance) return messagingInstance;
  const supported = await isSupported();
  if (supported) {
    messagingInstance = getMessaging(app);
  }
  return messagingInstance;
};

// Analytics initialization with browser compatibility checks
let analyticsInstance = null;
export const getAnalyticsInstance = async () => {
  if (analyticsInstance) return analyticsInstance;
  if (typeof window !== 'undefined') {
    try {
      const supported = await isAnalyticsSupported();
      if (supported) {
        analyticsInstance = getAnalytics(app);
      }
    } catch (err) {
      console.warn('Firebase Analytics not supported in this environment:', err);
    }
  }
  return analyticsInstance;
};

export default app;
