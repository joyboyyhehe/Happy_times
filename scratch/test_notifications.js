import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
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

async function test() {
  await signInWithEmailAndPassword(auth, 'happytimespreschool27@gmail.com', 'happytimes_admin_6754');
  console.log('Authenticated.');

  const parentUid = 'OpKFmBu9t8XvGR9WaUWKwcK0Nuk2';
  const studentId = 'student_pooja_1779984167925';

  // 1. Inspect Pooja
  const sSnap = await getDoc(doc(db, 'students', studentId));
  if (!sSnap.exists()) {
    console.error('Student Pooja not found');
    return;
  }
  const sData = sSnap.data();
  console.log(`Student: Pooja, branchId: ${sData.branchId}, classId: ${sData.classId}, parentUids: ${JSON.stringify(sData.parentUids)}`);

  // 2. Set dummy FCM token
  console.log(`Setting dummy FCM token for parent: ${parentUid}`);
  await setDoc(doc(db, 'fcm_tokens', parentUid), {
    token: 'dummy_token_12345_post_test',
    updatedAt: new Date(),
  }, { merge: true });

  // 3. Create a test post in the posts collection
  console.log('Creating a test post for all branches/classes...');
  const postRef = await addDoc(collection(db, 'posts'), {
    title: 'Test Notification Trigger',
    body: 'This is a test to check if Cloud Functions pick up the parent token.',
    category: 'General',
    scope: 'all',
    branchId: null,
    classId: null,
    authorUid: auth.currentUser.uid,
    authorName: 'Admin Test',
    timestamp: serverTimestamp(),
  });
  console.log(`Test post created with ID: ${postRef.id}`);
  console.log('Please wait a few seconds and check firebase functions logs.');
}

test().catch(console.error);
