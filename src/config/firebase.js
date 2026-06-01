import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: 'AIzaSyDixFR1hkz9rqEr8rcUen8r7aosAHXXgT0',
  authDomain: 'happytimes-preschool-pwa.firebaseapp.com',
  projectId: 'happytimes-preschool-pwa',
  storageBucket: 'happytimes-preschool-pwa.firebasestorage.app',
  messagingSenderId: '390518602758',
  appId: '1:390518602758:web:bc23ea8bf2ffce9a35d787',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

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

export default app;
