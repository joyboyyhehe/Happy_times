import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, getDocs } from 'firebase/firestore';
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
  await signInWithEmailAndPassword(auth, 'happytimespreschool27@gmail.com', 'happytimes_admin_6754');
  console.log('Authenticated.');

  const usersSnap = await getDocs(collection(db, 'users'));
  const parents = usersSnap.docs.filter(d => d.data().role === 'parent');

  const studentsSnap = await getDocs(collection(db, 'students'));
  const padStudents = studentsSnap.docs.filter(d => d.data().branchId === 'padmanabhanagar');
  const padStudentIds = padStudents.map(d => d.id);

  console.log(`Branch padmanabhanagar student IDs:`, padStudentIds);

  console.log('Inspecting parents in users collection:');
  parents.forEach(p => {
    const data = p.data();
    // Check if parent is linked to any padmanabhanagar student
    const isLinkedToPad = (data.linkedStudentIds || []).some(id => padStudentIds.includes(id));
    if (isLinkedToPad) {
      console.log(`Parent Doc ID: ${p.id}, name: ${data.name}, uid: ${data.uid}, linkedStudentIds: ${JSON.stringify(data.linkedStudentIds)}`);
    }
  });
}

inspect().catch(console.error);
