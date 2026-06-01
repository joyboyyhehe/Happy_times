import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
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

// Get Today's Date String in YYYY-MM-DD format
const getTodayDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const todayDate = getTodayDateString();

async function seedAttendance() {
  const mockAttendance = [
    {
      studentId: 'student_test2_1779973329681',
      branchId: 'padmanabhanagar',
      className: 'LKG',
      status: 'present'
    },
    {
      studentId: 'student_baby1_1779973331090',
      branchId: 'chikkalsandra',
      className: 'Playgroup',
      status: 'late'
    }
  ];

  for (const record of mockAttendance) {
    const docId = `${record.studentId}_${todayDate}`;
    const attRef = doc(db, 'attendance', docId);
    
    await setDoc(attRef, {
      studentId: record.studentId,
      branchId: record.branchId,
      className: record.className,
      date: todayDate,
      status: record.status,
      markedBy: 'system_seeder',
      markedAt: new Date().toISOString()
    });
    
    console.log(`Seeded attendance for student ${record.studentId} with status ${record.status} on date ${todayDate}`);
  }
}

seedAttendance().catch(console.error);
