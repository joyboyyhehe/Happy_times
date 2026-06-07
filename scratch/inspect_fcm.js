import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
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
  await signInWithEmailAndPassword(auth, 'happytimespreschool27@gmail.com', 'happytimes_admin_6754');
  console.log('Authenticated.');

  console.log('--- FCM Tokens ---');
  const fcmSnap = await getDocs(collection(db, 'fcm_tokens'));
  console.log(`Found ${fcmSnap.docs.length} fcm_tokens.`);
  for (const d of fcmSnap.docs) {
    console.log(`Uid: ${d.id}, token preview: ${d.data().token?.substring(0, 20)}...`);
    // Check if user exists
    const uSnap = await getDoc(doc(db, 'users', d.id));
    if (uSnap.exists()) {
      console.log(`  User details: Name: ${uSnap.data().name}, Role: ${uSnap.data().role}, branchId: ${uSnap.data().branchId}`);
    } else {
      console.log(`  User document does not exist for UID ${d.id}`);
    }
  }

  console.log('\n--- Parent Users ---');
  const usersSnap = await getDocs(collection(db, 'users'));
  const parents = usersSnap.docs.filter(d => d.data().role === 'parent');
  console.log(`Found ${parents.length} parents in /users.`);
  parents.forEach(p => {
    const data = p.data();
    console.log(`Parent: ${p.id} - Name: ${data.name}, Phone: ${data.phone}, Uids: ${data.uid || 'no-uid'}, linkedStudents: ${JSON.stringify(data.linkedStudentIds || [])}`);
  });
}

inspect().catch(console.error);
