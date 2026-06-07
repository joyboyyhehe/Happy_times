import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// Class aliases mapping rules
const ALIASES = {
  'Mont -1': 'Mont-1',
  'Mont -2': 'Mont-2',
  'Mont -3': 'Mont-3',
  'Mont 1': 'Mont-1',
  'Mont 2': 'Mont-2',
  'Mont 3': 'Mont-3',
  'Pre Mont': 'Pre-Mont',
  'PreMont': 'Pre-Mont',
  'premont': 'Pre-Mont',
  'pre-mont': 'Pre-Mont',
  'PreMontessori': 'Pre-Mont',
  'Daycare': 'Pre-Mont',
  'Playgroup': 'Pre-Mont',
  'Nursery': 'Pre-Mont',
  'LKG': 'Mont-1',
  'UKG': 'Mont-3',
};

const EXECUTE = process.argv.includes('--execute');
const DRY_RUN = !EXECUTE;

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupPath = `students_backup_${timestamp}.json`;
const reportPath = `migration_report_${timestamp}.json`;

let db;
let isAdmin = false;
let clientDb;

const serviceAccountPath = resolve('serviceAccountKey.json');
if (existsSync(serviceAccountPath)) {
  console.log('Found serviceAccountKey.json. Initializing Firebase Admin SDK...');
  const { initializeApp, cert } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');

  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
  initializeApp({ credential: cert(serviceAccount) });
  db = getFirestore();
  isAdmin = true;
} else {
  console.log('serviceAccountKey.json not found. Falling back to Client SDK...');
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
    console.error('   SUPERADMIN_EMAIL=your_email@gmail.com SUPERADMIN_PASSWORD=your_password node scripts/backup_and_migrate_classes.js [--execute]');
    process.exit(1);
  }

  console.log(`Authenticating as ${email}...`);
  try {
    await signInWithEmailAndPassword(auth, email, password);
    console.log('✅ Authentication successful!');
  } catch (err) {
    console.error('❌ Authentication failed:', err);
    process.exit(1);
  }
}

// Unified wrappers for fetching and updating
let fetchAll;
let updateDocument;

if (isAdmin) {
  fetchAll = async (colName) => {
    const snap = await db.collection(colName).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  };
  updateDocument = async (colName, docId, data) => {
    await db.collection(colName).doc(docId).update(data);
  };
} else {
  const { collection, getDocs, doc, updateDoc } = await import('firebase/firestore');
  fetchAll = async (colName) => {
    const snap = await getDocs(collection(clientDb, colName));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  };
  updateDocument = async (colName, docId, data) => {
    await updateDoc(doc(clientDb, colName, docId), data);
  };
}

async function migrate() {
  console.log('\n--- MONTESSORI CLASS NAME MIGRATION ---');
  console.log(`Mode: ${DRY_RUN ? '🟡 DRY RUN (no changes written)' : '🔴 EXECUTE (writing changes to Firestore)'}\n`);

  const report = {
    studentChanges: 0,
    postChanges: 0,
    registrationChanges: 0,
    legacyAttendanceDetected: 0,
    legacyAttendanceSummaryDetected: 0,
    failedDocs: []
  };

  // 1. BACKUP & MIGRATE STUDENTS
  console.log('Fetching students...');
  const students = await fetchAll('students');
  console.log(`Loaded ${students.length} students. Backing up to ${backupPath}...`);
  
  // Write student backup file first
  writeFileSync(backupPath, JSON.stringify(students, null, 2), 'utf-8');
  console.log('✅ Student backup complete.');

  console.log('\nChecking students for class mappings...');
  for (const s of students) {
    const oldClassId = s.classId || '';
    const oldClassName = s.className || '';
    const newClassId = ALIASES[oldClassId] || oldClassId;
    const newClassName = ALIASES[oldClassName] || oldClassName;

    if (oldClassId !== newClassId || oldClassName !== newClassName) {
      console.log(`  - Student "${s.name}" (ID: ${s.id}):`);
      if (oldClassId !== newClassId) console.log(`      classId:   "${oldClassId}" → "${newClassId}"`);
      if (oldClassName !== newClassName) console.log(`      className: "${oldClassName}" → "${newClassName}"`);

      report.studentChanges++;

      if (EXECUTE) {
        try {
          await updateDocument('students', s.id, {
            classId: newClassId,
            className: newClassName,
            updatedAt: new Date()
          });
        } catch (err) {
          console.error(`❌ Failed to update student doc ${s.id}:`, err);
          report.failedDocs.push({ collection: 'students', docId: s.id, error: err.message });
        }
      }
    }
  }

  // 2. MIGRATE POSTS
  console.log('\nChecking posts for class mappings...');
  const posts = await fetchAll('posts');
  for (const p of posts) {
    const oldClassId = p.classId || '';
    const oldClassName = p.className || '';
    const newClassId = ALIASES[oldClassId] || oldClassId;
    const newClassName = ALIASES[oldClassName] || oldClassName;

    if (oldClassId !== newClassId || oldClassName !== newClassName) {
      console.log(`  - Post "${p.title}" (ID: ${p.id}):`);
      if (oldClassId !== newClassId) console.log(`      classId:   "${oldClassId}" → "${newClassId}"`);
      if (oldClassName !== newClassName) console.log(`      className: "${oldClassName}" → "${newClassName}"`);

      report.postChanges++;

      if (EXECUTE) {
        try {
          await updateDocument('posts', p.id, {
            classId: newClassId,
            className: newClassName
          });
        } catch (err) {
          console.error(`❌ Failed to update post doc ${p.id}:`, err);
          report.failedDocs.push({ collection: 'posts', docId: p.id, error: err.message });
        }
      }
    }
  }

  // 3. MIGRATE REGISTRATIONS
  console.log('\nChecking registrations for class mappings...');
  const registrations = await fetchAll('registrations');
  for (const r of registrations) {
    const oldClassName = r.className || '';
    const newClassName = ALIASES[oldClassName] || oldClassName;

    if (oldClassName !== newClassName) {
      console.log(`  - Registration "${r.studentName}" (ID: ${r.id}):`);
      console.log(`      className: "${oldClassName}" → "${newClassName}"`);

      report.registrationChanges++;

      if (EXECUTE) {
        try {
          await updateDocument('registrations', r.id, {
            className: newClassName
          });
        } catch (err) {
          console.error(`❌ Failed to update registration doc ${r.id}:`, err);
          report.failedDocs.push({ collection: 'registrations', docId: r.id, error: err.message });
        }
      }
    }
  }

  // 4. DETECT LEGACY VALUES IN ATTENDANCE
  console.log('\nScanning attendance documents for legacy classId/className values...');
  const attendanceDocs = await fetchAll('attendance');
  for (const att of attendanceDocs) {
    const classId = att.classId || '';
    const className = att.className || '';
    if (ALIASES[classId] || ALIASES[className]) {
      report.legacyAttendanceDetected++;
      if (report.legacyAttendanceDetected <= 10) {
        console.log(`  - Detected in attendance doc ${att.id}: classId: "${classId}", className: "${className}"`);
      }
    }
  }
  if (report.legacyAttendanceDetected > 10) {
    console.log(`  ... and ${report.legacyAttendanceDetected - 10} more attendance records containing legacy classes.`);
  }

  // 5. DETECT LEGACY VALUES IN ATTENDANCE_SUMMARY
  console.log('\nScanning attendance_summary documents...');
  const summaryDocs = await fetchAll('attendance_summary');
  for (const sum of summaryDocs) {
    const classId = sum.classId || '';
    const className = sum.className || '';
    if (ALIASES[classId] || ALIASES[className]) {
      report.legacyAttendanceSummaryDetected++;
      if (report.legacyAttendanceSummaryDetected <= 10) {
        console.log(`  - Detected in attendance_summary doc ${sum.id}: classId: "${classId}", className: "${className}"`);
      }
    }
  }

  // 6. WRITE RUN REPORT
  writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`\n📄 Migration report saved: ${reportPath}`);

  console.log('\n====================================');
  console.log('📊 Migration Summary:');
  console.log(`   Student updates:   ${report.studentChanges}`);
  console.log(`   Post updates:      ${report.postChanges}`);
  console.log(`   Registration updates: ${report.registrationChanges}`);
  console.log(`   Legacy attendance items detected:        ${report.legacyAttendanceDetected}`);
  console.log(`   Legacy attendance_summary items detected: ${report.legacyAttendanceSummaryDetected}`);
  console.log(`   Failed documents:  ${report.failedDocs.length}`);
  console.log('====================================');

  if (DRY_RUN) {
    console.log('\n🟡 Dry Run complete. No changes were saved to Firestore.');
    console.log('   Run with the --execute flag to write these changes to the database:');
    console.log('   node scripts/backup_and_migrate_classes.js --execute\n');
  } else {
    console.log('\n✅ Execute complete. Firestore documents updated successfully!\n');
  }
}

migrate().catch(console.error);
