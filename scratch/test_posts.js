import { initializeApp } from 'firebase/app';
import { getFirestore, query, collection, getDocs, where, orderBy, limit } from 'firebase/firestore';
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

import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function testQuery() {
  console.log('Authenticating...');
  await signInWithEmailAndPassword(auth, 'happytimespreschool27@gmail.com', 'happytimes_admin_6754');
  console.log('Authenticated.');

  console.log('Testing parent post queries...');
  // Let's use dummy or active branch/class IDs to test index requirements
  const branchId = 'padmanabhanagar';
  const classId = 'Mont -3';

  try {
    console.log('Running class query...');
    const q1 = query(collection(db, 'posts'), where('scope', '==', 'class'), where('classId', '==', classId), orderBy('timestamp', 'desc'), limit(30));
    const snap1 = await getDocs(q1);
    console.log(`Class posts success: ${snap1.docs.length}`);
  } catch (err) {
    console.error('Class query failed:', err.message);
  }

  try {
    console.log('Running branch query...');
    const q2 = query(collection(db, 'posts'), where('scope', '==', 'branch'), where('branchId', '==', branchId), orderBy('timestamp', 'desc'), limit(30));
    const snap2 = await getDocs(q2);
    console.log(`Branch posts success: ${snap2.docs.length}`);
  } catch (err) {
    console.error('Branch query failed:', err.message);
  }

  try {
    console.log('Running all query...');
    const q3 = query(collection(db, 'posts'), where('scope', '==', 'all'), orderBy('timestamp', 'desc'), limit(20));
    const snap3 = await getDocs(q3);
    console.log(`All posts success: ${snap3.docs.length}`);
  } catch (err) {
    console.error('All query failed:', err.message);
  }
}

testQuery().catch(console.error);
