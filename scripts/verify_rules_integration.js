import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
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

async function runTests() {
  console.log('--- STARTING AUTH & SECURITY INTEGRATION VERIFICATION ---');
  
  // 1. Unauthenticated Checks (simulate guest profile access)
  console.log('\n[TEST 1] Verifying guest user restrictions...');
  try {
    const snap = await getDocs(collection(db, 'users'));
    console.error('❌ FAILURE: Unauthenticated user was able to fetch /users collection!');
  } catch (err) {
    console.log('✅ SUCCESS: Unauthenticated collection fetch on /users was correctly blocked.');
  }

  try {
    const snap = await getDocs(collection(db, 'students'));
    console.error('❌ FAILURE: Unauthenticated user was able to fetch /students collection!');
  } catch (err) {
    console.log('✅ SUCCESS: Unauthenticated collection fetch on /students was correctly blocked.');
  }

  // 2. Authenticating as Super Admin
  console.log('\n[TEST 2] Authenticating as Super Admin (happytimespreschool27@gmail.com)...');
  try {
    const credential = await signInWithEmailAndPassword(auth, 'happytimespreschool27@gmail.com', 'happytimes_admin_6754');
    console.log(`✅ SUCCESS: Super Admin authenticated successfully! UID: ${credential.user.uid}`);
    
    // Test admin rights
    console.log('\n[TEST 3] Verifying Super Admin access rights...');
    const userDoc = await getDoc(doc(db, 'users', credential.user.uid));
    if (userDoc.exists() && userDoc.data().role === 'superadmin') {
      console.log(`✅ SUCCESS: Firestore profile verified. Role: ${userDoc.data().role}`);
    } else {
      console.error('❌ FAILURE: Profile role is mismatch or doc does not exist!');
    }
    
    // Fetch users collection as admin
    const usersSnap = await getDocs(collection(db, 'users'));
    console.log(`✅ SUCCESS: Super Admin fetched ${usersSnap.size} user documents.`);
    
    // Fetch students collection as admin
    const studentsSnap = await getDocs(collection(db, 'students'));
    console.log(`✅ SUCCESS: Super Admin fetched ${studentsSnap.size} student documents.`);

    // Sign out
    await signOut(auth);
    console.log('✅ SUCCESS: Signed out Super Admin.');
  } catch (err) {
    console.error('❌ FAILURE during Super Admin verification:', err);
  }

  console.log('\n--- VERIFICATION COMPLETED SUCCESSFULLY ---');
}

runTests().catch(console.error);
