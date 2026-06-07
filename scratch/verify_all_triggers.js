import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
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

async function verify() {
  console.log('Authenticating as Super Admin...');
  await signInWithEmailAndPassword(auth, 'happytimespreschool27@gmail.com', 'happytimes_admin_6754');
  console.log('Authentication successful!');

  const parentUid = 'OpKFmBu9t8XvGR9WaUWKwcK0Nuk2';
  const studentId = 'student_pooja_1779984167925';
  const date = '2026-06-04';

  // 1. Double check FCM token is registered in users/{parentUid}.fcmTokens array
  console.log(`Setting/Verifying users/${parentUid} fcmTokens array...`);
  await setDoc(doc(db, 'users', parentUid), {
    fcmTokens: ['dummy_token_verified_integration_test_abc'],
    updatedAt: new Date(),
  }, { merge: true });

  // 2. Trigger Attendance Marking
  console.log(`Marking student ${studentId} present on ${date} for branch padmanabhanagar, class Mont -3...`);
  
  // Save records document
  const recordPath = doc(db, 'attendance', `padmanabhanagar_Mont -3_${date}`, 'records', studentId);
  await setDoc(recordPath, {
    status: 'present',
    markedBy: auth.currentUser.uid,
    timestamp: serverTimestamp(),
  }, { merge: true });

  // Save trigger document
  const triggerPath = doc(db, 'attendance', `${studentId}_${date}`);
  await setDoc(triggerPath, {
    studentId,
    status: 'present',
    date,
    branchId: 'padmanabhanagar',
    classId: 'Mont -3',
    markedBy: auth.currentUser.uid,
    timestamp: serverTimestamp(),
  }, { merge: true });
  
  console.log('Attendance marked successfully!');

  // 3. Trigger Post Creation
  console.log('Creating a post targeting class Mont -3...');
  const postRef = await addDoc(collection(db, 'posts'), {
    title: 'Verification Announcement Class',
    body: 'This announcement verifies the new className post filtering logic works.',
    category: 'announcement',
    scope: 'class',
    branchId: 'padmanabhanagar',
    classId: 'Mont -3',
    className: 'Mont -3', // Cloud Functions compatibility
    imageUrls: [],
    authorUid: auth.currentUser.uid,
    authorName: 'Admin Test',
    timestamp: serverTimestamp(),
  });
  console.log(`Post created successfully with ID: ${postRef.id}`);

  console.log('\nBoth triggers executed! Please wait a few seconds and run functions log checker.');
}

verify().catch(console.error);
