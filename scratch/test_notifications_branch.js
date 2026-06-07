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

  // 1. Ensure Pooja is in class 'Mont -3' and branch 'padmanabhanagar'
  console.log('Updating Pooja student details...');
  await setDoc(doc(db, 'students', studentId), {
    branchId: 'padmanabhanagar',
    classId: 'Mont -3',
  }, { merge: true });

  // 2. Create a test post for branch 'padmanabhanagar'
  console.log('Creating a test post for branch padmanabhanagar...');
  const postRefBranch = await addDoc(collection(db, 'posts'), {
    title: 'Test Branch Notification',
    body: 'This is a test to check if Cloud Functions pick up the branch token.',
    category: 'General',
    scope: 'branch',
    branchId: 'padmanabhanagar',
    classId: null,
    authorUid: auth.currentUser.uid,
    authorName: 'Admin Test',
    timestamp: serverTimestamp(),
  });
  console.log(`Branch post created: ${postRefBranch.id}`);

  // 3. Create a test post for class 'Mont -3' of branch 'padmanabhanagar'
  console.log('Creating a test post for class Mont -3...');
  const postRefClass = await addDoc(collection(db, 'posts'), {
    title: 'Test Class Notification',
    body: 'This is a test to check if Cloud Functions pick up the class token.',
    category: 'General',
    scope: 'class',
    branchId: 'padmanabhanagar',
    classId: 'Mont -3',
    authorUid: auth.currentUser.uid,
    authorName: 'Admin Test',
    timestamp: serverTimestamp(),
  });
  console.log(`Class post created: ${postRefClass.id}`);
}

test().catch(console.error);
