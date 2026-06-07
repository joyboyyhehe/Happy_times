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

async function createParent() {
  const adminEmail = 'usharanijuniordps@gmail.com';
  const adminPassword = 'happytimes_admin_6754';
  const email = 'test_parent@happytimes.com';
  const password = 'happytimes_admin_6754';
  
  console.log(`Creating/signing in user ${email} in Firebase Auth...`);
  
  try {
    let uid = '';
    // Sign in/create parent in auth first
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      uid = userCredential.user.uid;
      console.log(`User created successfully with UID: ${uid}`);
    } catch (authErr) {
      if (authErr.code === 'auth/email-already-in-use') {
        console.log('Auth user already exists, signing in to obtain UID...');
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        uid = userCredential.user.uid;
        console.log(`Signed in successfully. UID: ${uid}`);
      } else {
        throw authErr;
      }
    }
    
    // Now sign out and sign in as Super Admin to write database documents
    console.log(`Signing out parent and signing in as Super Admin (${adminEmail}) to bypass security rules...`);
    await auth.signOut();
    await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
    console.log('Authenticated as Super Admin successfully.');
    
    console.log('Writing parent profile to Firestore users collection...');
    await setDoc(doc(db, 'users', uid), {
      name: 'Test Parent (Abhinav\'s Mother)',
      role: 'parent',
      email: email,
      phone: '+919999999999',
      relation: 'Mother',
      linkedStudentIds: ['student_abhinav_surya_kamble_1780577323600'],
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // Also update the student's parentUids list to link back
    console.log('Linking parent UID back inside student document...');
    await setDoc(doc(db, 'students', 'student_abhinav_surya_kamble_1780577323600'), {
      parentUids: [uid]
    }, { merge: true });
    
    console.log('Parent account created and linked successfully!');
  } catch (err) {
    console.error('Error creating parent:', err);
  }
}

createParent().catch(console.error);
