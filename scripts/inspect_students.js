import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
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

async function inspect() {
  console.log('Authenticating as Super Admin...');
  await signInWithEmailAndPassword(auth, 'happytimespreschool27@gmail.com', 'happytimes_admin_6754');
  console.log('Authentication successful!');

  console.log('Fetching students...');
  const snap = await getDocs(collection(db, 'students'));
  const students = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  console.log(`Loaded ${students.length} students.`);

  // Group by branchId and classId
  const groups = {};
  students.forEach(s => {
    const key = `${s.branchId || 'no-branch'} | ${s.classId || 'no-class'}`;
    groups[key] = (groups[key] || 0) + 1;
  });

  console.log('\n--- Students Grouped by Branch and Class ---');
  for (const [key, count] of Object.entries(groups)) {
    console.log(`  - ${key}: ${count} student(s)`);
  }
}

inspect().catch(console.error);
