import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
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

  // Set FCM token on user document
  console.log(`Setting FCM token fields on users/${parentUid} document`);
  await setDoc(doc(db, 'users', parentUid), {
    fcmToken: 'dummy_token_userDoc_fcmToken',
    fcm_token: 'dummy_token_userDoc_fcm_token',
    token: 'dummy_token_userDoc_token',
  }, { merge: true });

  // Create a class post
  console.log('Creating a test post for class Mont -3...');
  const postRef = await addDoc(collection(db, 'posts'), {
    title: 'Test User Doc Fields Notification',
    body: 'This is a test to check if Cloud Functions pick up the token from the user document.',
    category: 'General',
    scope: 'class',
    branchId: 'padmanabhanagar',
    classId: 'Mont -3',
    authorUid: auth.currentUser.uid,
    authorName: 'Admin Test',
    timestamp: serverTimestamp(),
  });
  console.log(`Class post created: ${postRef.id}`);
}

test().catch(console.error);
