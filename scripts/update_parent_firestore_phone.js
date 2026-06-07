import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
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
const auth = getAuth(app);

async function runUpdate() {
  const adminEmail = 'usharanijuniordps@gmail.com';
  const adminPassword = 'happytimes_admin_6754';
  
  console.log(`Authenticating as Super Admin ${adminEmail}...`);
  await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
  console.log('Authentication successful.');
  
  const QA_PARENT_UID = 'KxyQom31c8hDyhaDhoWTMjX3Kf02';
  const QA_PHONE = '+919999999999';
  
  const userRef = doc(db, 'users', QA_PARENT_UID);
  console.log(`Updating users/${QA_PARENT_UID} phone to ${QA_PHONE}...`);
  await updateDoc(userRef, {
    phone: QA_PHONE
  });
  console.log('Update successful!');
}

runUpdate().catch(err => {
  console.error('Update failed:', err);
  process.exit(1);
});
