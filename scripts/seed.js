import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';
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

const BRANCHES = [
  { id: 'padmanabhanagar', name: 'Padmanabhanagar', address: 'Padmanabhanagar, Bangalore' },
  { id: 'outer-ring-road', name: 'Outer Ring Road', address: 'Outer Ring Road, Bangalore' },
  { id: 'chikkalsandra', name: 'Chikkalsandra', address: 'Chikkalsandra, Bangalore' },
  { id: 'rr-nagar', name: 'RR Nagar', address: 'RR Nagar, Bangalore' },
];

const USERS = [
  {
    id: 'super_admin_seed',
    data: {
      name: 'Happy Times Super Admin',
      role: 'superadmin',
      email: 'happytimespreschool27@gmail.com',
      createdAt: new Date().toISOString(),
    }
  },
  // Add a branch admin for testing
  {
    id: 'branch_admin_seed',
    data: {
      name: 'Padmanabhanagar Admin',
      role: 'branchadmin',
      email: 'happytimespreschool.padmin@gmail.com',
      branchId: 'padmanabhanagar',
      createdAt: new Date().toISOString(),
    }
  },
  // Add a test parent for testing
  {
    id: 'parent_seed',
    data: {
      name: 'Ramesh Kumar',
      role: 'parent',
      phone: '+919980413994', // Test phone number
      linkedStudentIds: ['student_test_1'],
      createdAt: new Date().toISOString(),
    }
  }
];

const STUDENTS = [
  {
    id: 'student_test_1',
    data: {
      name: 'Aarav Kumar',
      dob: '2021-05-15',
      gender: 'Male',
      branchId: 'padmanabhanagar',
      className: 'Nursery',
      enrollmentDate: '2025-06-01',
      status: 'active',
      parentUids: [], // Linked during login/setup
      createdAt: new Date().toISOString(),
    }
  }
];

async function seed() {
  console.log('Starting seeding...');
  
  // Seed branches
  for (const branch of BRANCHES) {
    await setDoc(doc(db, 'branches', branch.id), {
      name: branch.name,
      address: branch.address,
    });
    console.log(`Seeded branch: ${branch.name}`);
  }

  // Seed settings
  await setDoc(doc(db, 'settings', 'global'), {
    attendanceLockTime: '10:00',
    updatedAt: new Date().toISOString(),
  });
  console.log('Seeded global settings.');

  // Seed users
  for (const user of USERS) {
    await setDoc(doc(db, 'users', user.id), user.data);
    console.log(`Seeded user profile: ${user.data.name} (${user.data.role})`);
  }

  // Seed students
  for (const student of STUDENTS) {
    await setDoc(doc(db, 'students', student.id), student.data);
    console.log(`Seeded student profile: ${student.data.name}`);
  }

  console.log('Seeding complete successfully!');
}

seed().catch(err => {
  console.error('Error seeding database:', err);
  process.exit(1);
});
