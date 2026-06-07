import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, deleteDoc, getDoc, arrayUnion, serverTimestamp, collection, getDocs, writeBatch } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
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

async function cleanup() {
  console.log('Authenticating as Super Admin...');
  await signInWithEmailAndPassword(auth, 'happytimespreschool27@gmail.com', 'happytimes_admin_6754');
  console.log('Authentication successful!');

  const batch = writeBatch(db);

  // 1. Delete duplicate registrations
  console.log('Processing duplicate registrations...');
  const dupReg1 = doc(db, 'registrations', 'bUOpCxsnGrYyLsEiGCA1');
  const dupReg2 = doc(db, 'registrations', 'p4CMrG7DiSd2mABw3wQm');
  batch.delete(dupReg1);
  batch.delete(dupReg2);
  console.log('Queued deletion of bUOpCxsnGrYyLsEiGCA1 and p4CMrG7DiSd2mABw3wQm.');

  // 2. Archive parent_9972344442 instead of deleting
  console.log('Archiving parent_9972344442...');
  const oldParentDoc = doc(db, 'users', 'parent_9972344442');
  batch.update(oldParentDoc, {
    archived: true,
    archivedAt: serverTimestamp(),
    migratedTo: 'OpKFmBu9t8XvGR9WaUWKwcK0Nuk2'
  });

  // 3. Link Pooja to correct parent UID
  console.log('Linking student Pooja to active parent UID...');
  const studentPoojaDoc = doc(db, 'students', 'student_pooja_1779984167925');
  batch.update(studentPoojaDoc, {
    parentUids: ['OpKFmBu9t8XvGR9WaUWKwcK0Nuk2']
  });

  const activeParentDoc = doc(db, 'users', 'OpKFmBu9t8XvGR9WaUWKwcK0Nuk2');
  batch.update(activeParentDoc, {
    linkedStudentIds: arrayUnion('student_pooja_1779984167925')
  });

  // 4. Delete pending registrations (only those with status "pending" or not approved/rejected)
  console.log('Scanning for pending registrations to clean up...');
  const regsSnap = await getDocs(collection(db, 'registrations'));
  let deletedPendingCount = 0;
  regsSnap.forEach(d => {
    const data = d.data();
    // Exclude the duplicates we already queued to delete
    if (d.id !== 'bUOpCxsnGrYyLsEiGCA1' && d.id !== 'p4CMrG7DiSd2mABw3wQm') {
      const status = data.status || 'pending';
      if (status !== 'approved' && status !== 'rejected') {
        batch.delete(d.ref);
        deletedPendingCount++;
      }
    }
  });
  console.log(`Queued deletion of ${deletedPendingCount} pending registrations.`);

  console.log('Committing cleanup batch write...');
  await batch.commit();
  console.log('Database cleanup completed successfully!');
}

cleanup().catch(console.error);
