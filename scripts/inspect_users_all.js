import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { readFileSync } from 'fs';

const envText = readFileSync('.env', 'utf-8');
const envConfig = {};
envText.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    envConfig[parts[0].trim()] = parts.slice(1).join('=').trim();
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

async function inspect() {
  console.log('Signing in...');
  await signInWithEmailAndPassword(auth, 'usharanijuniordps@gmail.com', 'happytimes_admin_6754');
  console.log('Signed in as Super Admin.');
  
  console.log('Fetching users collection...');
  const snap = await getDocs(collection(db, 'users'));
  console.log(`Found ${snap.size} user documents:`);
  snap.forEach(doc => {
    const data = doc.data();
    console.log(`- ID: ${doc.id} | Email: ${data.email} | Role: ${data.role} | Name: ${data.name} | Branch: ${data.branchId}`);
  });
}

inspect().catch(console.error);
