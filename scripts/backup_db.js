import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

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

async function runBackup() {
  const adminEmail = 'usharanijuniordps@gmail.com';
  const adminPassword = 'happytimes_admin_6754';
  
  console.log(`Authenticating as Super Admin ${adminEmail}...`);
  await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
  console.log('Authentication successful.');
  
  // Ensure backups dir exists
  mkdirSync('backups', { recursive: true });
  
  const collectionsToBackup = ['students', 'posts', 'leaves', 'logs'];
  
  for (const collName of collectionsToBackup) {
    console.log(`Backing up collection: ${collName}...`);
    try {
      const colRef = collection(db, collName);
      const snapshot = await getDocs(colRef);
      const docs = [];
      snapshot.forEach(doc => {
        // serialize timestamps/dates nicely for comparison
        const data = doc.data();
        docs.push({ id: doc.id, ...data });
      });
      
      const filePath = join('backups', `${collName}_backup.json`);
      writeFileSync(filePath, JSON.stringify(docs, null, 2), 'utf-8');
      console.log(`Backup saved: ${filePath} (${docs.length} documents)`);
    } catch (err) {
      console.error(`Error backing up collection ${collName}:`, err);
    }
  }
  
  console.log('Pre-test backup phase complete!');
}

runBackup().catch(console.error);
