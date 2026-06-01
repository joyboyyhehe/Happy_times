import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';

// Parse .env manually
const envText = readFileSync('.env', 'utf-8');
const envConfig = {};
envText.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const value = parts.slice(1).join('=').trim();
    if (key) envConfig[key] = value;
  }
});

const firebaseConfig = {
  apiKey: envConfig.VITE_FIREBASE_API_KEY,
  authDomain: envConfig.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: envConfig.VITE_FIREBASE_PROJECT_ID,
  storageBucket: envConfig.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: envConfig.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: envConfig.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrate() {
  const oldDocId = 'parent_9606664929';
  const newDocId = 'e7EqeyNkzjcWJLrwRlg59re5lb32';
  
  const oldRef = doc(db, 'users', oldDocId);
  const snap = await getDoc(oldRef);
  
  if (snap.exists()) {
    const data = snap.data();
    data.uid = newDocId;
    
    // Write new document
    await setDoc(doc(db, 'users', newDocId), data);
    console.log(`Copied user profile to users/${newDocId}`);
    
    // Delete old document
    await deleteDoc(oldRef);
    console.log(`Deleted old user profile users/${oldDocId}`);
  } else {
    console.log('Old document not found.');
  }
}

migrate().catch(console.error);
