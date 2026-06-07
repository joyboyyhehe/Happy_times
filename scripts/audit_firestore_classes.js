import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const CANONICAL_CLASSES = ['Pre-Mont', 'Mont-1', 'Mont-2', 'Mont-3'];

let db;
let isAdmin = false;
let clientDb;

const serviceAccountPath = resolve('serviceAccountKey.json');
if (existsSync(serviceAccountPath)) {
  const { initializeApp, cert } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');

  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
  initializeApp({ credential: cert(serviceAccount) });
  db = getFirestore();
  isAdmin = true;
} else {
  const { initializeApp } = await import('firebase/app');
  const { getFirestore } = await import('firebase/firestore');
  const { getAuth, signInWithEmailAndPassword } = await import('firebase/auth');

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
  clientDb = getFirestore(app);
  const auth = getAuth(app);

  const email = process.env.SUPERADMIN_EMAIL;
  const password = process.env.SUPERADMIN_PASSWORD;

  if (!email || !password) {
    console.error('❌ Error: Credentials not provided in environment variables.');
    console.error('   Please run with environment variables set:');
    console.error('   SUPERADMIN_EMAIL=your_email@gmail.com SUPERADMIN_PASSWORD=your_password node scripts/audit_firestore_classes.js');
    process.exit(1);
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    console.error('❌ Authentication failed:', err);
    process.exit(1);
  }
}

// Unified wrappers for fetching
let fetchAll;

if (isAdmin) {
  fetchAll = async (colName) => {
    const snap = await db.collection(colName).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  };
} else {
  const { collection, getDocs } = await import('firebase/firestore');
  fetchAll = async (colName) => {
    const snap = await getDocs(collection(clientDb, colName));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  };
}

async function audit() {
  console.log('--- STARTING FIRESTORE WEEKLY CLASS REGISTRY AUDIT ---');
  console.log(`Canonical Classes: ${CANONICAL_CLASSES.join(', ')}\n`);

  let anomaliesCount = 0;

  // 1. Audit Students
  const students = await fetchAll('students');
  students.forEach(s => {
    const classId = s.classId || '';
    const className = s.className || '';
    if (classId && !CANONICAL_CLASSES.includes(classId)) {
      console.warn(`⚠️ Student "${s.name}" (ID: ${s.id}) has non-canonical classId: "${classId}"`);
      anomaliesCount++;
    }
    if (className && !CANONICAL_CLASSES.includes(className)) {
      console.warn(`⚠️ Student "${s.name}" (ID: ${s.id}) has non-canonical className: "${className}"`);
      anomaliesCount++;
    }
  });

  // 2. Audit Posts
  const posts = await fetchAll('posts');
  posts.forEach(p => {
    const classId = p.classId || '';
    const className = p.className || '';
    if (classId && !CANONICAL_CLASSES.includes(classId)) {
      console.warn(`⚠️ Post "${p.title}" (ID: ${p.id}) has non-canonical classId: "${classId}"`);
      anomaliesCount++;
    }
    if (className && !CANONICAL_CLASSES.includes(className)) {
      console.warn(`⚠️ Post "${p.title}" (ID: ${p.id}) has non-canonical className: "${className}"`);
      anomaliesCount++;
    }
  });

  // 3. Audit Registrations
  const registrations = await fetchAll('registrations');
  registrations.forEach(r => {
    const className = r.className || '';
    if (className && !CANONICAL_CLASSES.includes(className)) {
      console.warn(`⚠️ Registration for "${r.studentName}" (ID: ${r.id}) has non-canonical className: "${className}"`);
      anomaliesCount++;
    }
  });

  // 4. Audit Attendance docs
  const attendance = await fetchAll('attendance');
  attendance.forEach(att => {
    const classId = att.classId || '';
    const className = att.className || '';
    if (classId && !CANONICAL_CLASSES.includes(classId)) {
      console.warn(`⚠️ Attendance Doc (ID: ${att.id}) has non-canonical classId: "${classId}"`);
      anomaliesCount++;
    }
    if (className && !CANONICAL_CLASSES.includes(className)) {
      console.warn(`⚠️ Attendance Doc (ID: ${att.id}) has non-canonical className: "${className}"`);
      anomaliesCount++;
    }
  });

  console.log('\n--- AUDIT CONCLUDED ---');
  if (anomaliesCount === 0) {
    console.log('✅ Success: Zero non-canonical class names found across Firestore!');
  } else {
    console.warn(`❌ Warning: Found ${anomaliesCount} non-canonical class name instances.`);
  }
}

audit().catch(console.error);
