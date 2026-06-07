import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc, limit, query, where } from 'firebase/firestore';
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

async function smokeTest() {
  console.log('--- STARTING PROD SMOKE TEST ---');

  // 1. Auth Test
  console.log('\n[1/6] Authenticating as Super Admin...');
  let user;
  try {
    const credential = await signInWithEmailAndPassword(auth, 'usharanijuniordps@gmail.com', 'happytimes_admin_6754');
    user = credential.user;
    console.log(`✅ SUCCESS: Auth working. UID: ${user.uid}`);
  } catch (err) {
    console.error('❌ FAILURE: Auth failed. Check credentials or internet.', err);
    process.exit(1);
  }

  // 2. Fetch User Profile
  console.log('\n[2/6] Querying Super Admin profile...');
  try {
    const profileSnap = await getDoc(doc(db, 'users', user.uid));
    if (profileSnap.exists()) {
      console.log(`✅ SUCCESS: Profile loaded. Name: "${profileSnap.data().name}", Role: "${profileSnap.data().role}"`);
    } else {
      console.log('⚠️ WARNING: Profile doc not found (expected if auth only exists in firebase auth but users collection doesn\'t have profile yet).');
    }
  } catch (err) {
    console.error('❌ FAILURE: Fetching user profile failed.', err);
  }

  // 3. Query Active Students
  console.log('\n[3/6] Querying active students (where active == true)...');
  try {
    const q = query(collection(db, 'students'), where('active', '==', true), limit(5));
    const snap = await getDocs(q);
    console.log(`✅ SUCCESS: Loaded ${snap.size} active students.`);
    snap.docs.forEach(d => {
      console.log(`   - Student: "${d.data().name}" (ID: ${d.id}, Class: ${d.data().classId})`);
    });
  } catch (err) {
    console.error('❌ FAILURE: Active student query failed.', err);
  }

  // 4. Query Leaves
  console.log('\n[4/6] Querying leaves collection...');
  try {
    const snap = await getDocs(query(collection(db, 'leaves'), limit(5)));
    console.log(`✅ SUCCESS: Loaded ${snap.size} leave documents.`);
  } catch (err) {
    console.error('❌ FAILURE: Leaves query failed.', err);
  }

  // 5. Verification of Notification trigger collections/paths
  console.log('\n[5/6] Verifying notification targets...');
  try {
    // Check if system notifications config doc exists
    const notifyConfig = await getDoc(doc(db, 'config', 'notifications'));
    if (notifyConfig.exists()) {
      console.log('✅ SUCCESS: System notification settings exists.');
    } else {
      console.log('ℹ️ INFO: No config/notifications document found. Default values will be used.');
    }
  } catch (err) {
    console.error('❌ FAILURE: Check on config collections failed.', err);
  }

  // 6. Sign Out
  console.log('\n[6/6] Logging out...');
  try {
    await signOut(auth);
    console.log('✅ SUCCESS: Signed out super admin safely.');
  } catch (err) {
    console.error('❌ FAILURE: Logout failed.', err);
  }

  console.log('\n--- SMOKE TEST CONCLUDED ---');
}

smokeTest().catch(console.error);
