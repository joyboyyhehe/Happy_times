import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
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

async function setupManualParent() {
  const adminEmail = 'usharanijuniordps@gmail.com';
  const adminPassword = 'happytimes_admin_6754';
  const email = 'qa_parent_manual@happytimes.com';
  const password = 'happytimes_admin_6754';
  const studentId = 'student_abhinav_surya_kamble_1780577323600';
  
  console.log(`Setting up QA manual parent account: ${email}...`);
  
  try {
    let uid = '';
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      uid = userCredential.user.uid;
      console.log(`Auth user created: ${uid}`);
    } catch (authErr) {
      if (authErr.code === 'auth/email-already-in-use') {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        uid = userCredential.user.uid;
        console.log(`Auth user already exists: ${uid}`);
      } else {
        throw authErr;
      }
    }
    
    // Auth as superadmin to write to firestore
    await auth.signOut();
    await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
    
    await setDoc(doc(db, 'users', uid), {
      name: 'QA Manual Parent (Abhinav\'s Mother)',
      role: 'parent',
      email: email,
      phone: '+919999999999',
      relation: 'Mother',
      linkedStudentIds: [studentId],
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    await setDoc(doc(db, 'students', studentId), {
      parentUids: [uid]
    }, { merge: true });
    
    console.log(`Manual parent setup completed. Ready to test!`);
  } catch (err) {
    console.error('Error during setup:', err);
  }
}

setupManualParent().catch(console.error);
