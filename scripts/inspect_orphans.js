import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
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

async function inspect() {
  console.log('Authenticating as Super Admin...');
  await signInWithEmailAndPassword(auth, 'happytimespreschool27@gmail.com', 'happytimes_admin_6754');
  console.log('Authentication successful!');

  console.log('Fetching registrations...');
  const regsSnap = await getDocs(collection(db, 'registrations'));
  const regs = regsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  console.log('Fetching users...');
  const usersSnap = await getDocs(collection(db, 'users'));
  const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  console.log('Fetching students...');
  const studentsSnap = await getDocs(collection(db, 'students'));
  const students = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Dynamically filter orphaned students
  const orphans = students.filter(s => 
    (!s.parentUids || s.parentUids.length === 0) &&
    (!s.linkedParentIds || s.linkedParentIds.length === 0)
  );

  console.log(`\nIdentified ${orphans.length} dynamic orphans in the students collection.`);

  for (const o of orphans) {
    console.log(`\n==================================`);
    console.log(`Inspecting orphan: "${o.name}" (ID: ${o.id})`);
    
    // Find matching registrations exactly matching name
    const matchingRegs = regs.filter(r => 
      (r.studentName || '').trim().toLowerCase() === (o.name || '').trim().toLowerCase()
    );
    console.log(`Matching registrations: ${matchingRegs.length}`);
    matchingRegs.forEach(r => {
      console.log(`  - Reg ID: ${r.id}, Name: ${r.studentName}, Status: ${r.status}, Parent Phone: ${r.parent1?.phone}, Parent Name: ${r.parent1?.name}`);
    });

    // Find users where linkedStudentIds contains o.id
    const matchingUsers = users.filter(u => 
      (u.linkedStudentIds || []).includes(o.id)
    );
    console.log(`Users linking this student: ${matchingUsers.length}`);
    matchingUsers.forEach(u => {
      console.log(`  - User ID: ${u.id}, Name: ${u.name}, Phone: ${u.phone}, Role: ${u.role}, UID: ${u.uid}`);
    });
  }
}

inspect().catch(console.error);
