import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';
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

async function migrate() {
  console.log('Authenticating as Super Admin...');
  await signInWithEmailAndPassword(auth, 'happytimespreschool27@gmail.com', 'happytimes_admin_6754');
  console.log('Authentication successful!');

  console.log('Fetching students...');
  const snap = await getDocs(collection(db, 'students'));
  const students = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`Loaded ${students.length} students.`);

  let updatedCount = 0;
  for (const s of students) {
    if (!s.className || s.className !== s.classId) {
      console.log(`Updating student "${s.name}" (ID: ${s.id}): setting className to "${s.classId || ''}"`);
      await updateDoc(doc(db, 'students', s.id), {
        className: s.classId || ''
      });
      updatedCount++;
    }
  }

  console.log(`Migration completed successfully! Updated ${updatedCount} students.`);
}

migrate().catch(console.error);
