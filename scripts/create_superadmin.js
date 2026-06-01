import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
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

async function createAdmin() {
  const email = 'happytimespreschool27@gmail.com';
  const password = 'happytimes_admin_6754';
  
  console.log(`Creating user ${email} in Firebase Auth...`);
  
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    console.log(`User created successfully with UID: ${user.uid}`);
    
    console.log('Writing superadmin profile to Firestore users collection...');
    await setDoc(doc(db, 'users', user.uid), {
      name: 'Super Admin (happytimespreschool27)',
      role: 'superadmin',
      email: email,
      createdAt: new Date()
    });
    console.log('Profile created successfully! Super Admin is fully whitelisted.');
  } catch (err) {
    console.error('Error creating superadmin:', err);
  }
}

createAdmin().catch(console.error);
