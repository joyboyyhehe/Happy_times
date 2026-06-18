/**
 * backfill_parent_docs.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Creates missing users/parent_{phone} Firestore docs from TWO sources:
 *   1. students collection (phone1 / phone2 fields)
 *   2. registrations collection (parent1.phone / parent2.phone from the portal)
 *
 * This fixes the login bug for ALL parents — including those whose student
 * records don't have phone numbers saved but who registered via the portal.
 *
 * Usage:
 *   node scripts/backfill_parent_docs.js
 *
 * Run from the project root (c:\Happytimes\happytimes-pwa).
 */

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  query,
  where,
} from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { readFileSync } from 'fs';

// ── Load .env ────────────────────────────────────────────────────────────────
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
  apiKey:            envConfig.VITE_FIREBASE_API_KEY,
  authDomain:        envConfig.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         envConfig.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     envConfig.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: envConfig.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             envConfig.VITE_FIREBASE_APP_ID,
};

const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

const ADMIN_EMAIL    = envConfig.VITE_SUPERADMIN_EMAIL    || 'usharanijuniordps@gmail.com';
const ADMIN_PASSWORD = envConfig.VITE_SUPERADMIN_PASSWORD || 'happytimes_admin_6754';

// ── Helpers ──────────────────────────────────────────────────────────────────
function normalizePhone(raw) {
  if (!raw) return null;
  let clean = String(raw).replace(/\D/g, '');
  if (clean.length > 10) clean = clean.slice(-10);
  if (clean.length < 10) return null;
  return clean;
}

// Write or merge a parent doc. Returns 'created', 'skipped', or 'error'.
async function ensureParentDoc(phone, { name, email, relation, branchId, studentId, source }) {
  const docId = `parent_${phone}`;
  const ref   = doc(db, 'users', docId);
  let snap;
  try {
    snap = await getDoc(ref);
  } catch (e) {
    console.error(`  ❌ Could not read ${docId}:`, e.message);
    return 'error';
  }

  if (snap.exists() && snap.data().archived === true) {
    console.log(`  ⏭️  ${docId} — already activated, skipping`);
    return 'skipped';
  }

  const existing         = snap.exists() ? snap.data() : {};
  const linkedStudentIds = Array.from(
    new Set([...(existing.linkedStudentIds || []), ...(studentId ? [studentId] : [])])
  );

  try {
    await setDoc(ref, {
      role:             'parent',
      phone,
      name:             existing.name  || name  || 'Parent',
      email:            existing.email || email || '',
      relation:         existing.relation || relation || '',
      branchId:         existing.branchId || branchId || '',
      linkedStudentIds,
      archived:         false,
      createdAt:        existing.createdAt || serverTimestamp(),
      updatedAt:        serverTimestamp(),
    }, { merge: true });

    console.log(`  ✅ ${docId} ← [${source}] ${name || phone}`);
    return 'created';
  } catch (e) {
    console.error(`  ❌ Failed to write ${docId}:`, e.message);
    return 'error';
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function run() {
  console.log('🔐 Signing in as Super Admin...');
  await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
  console.log('✅ Signed in.\n');

  let created = 0, skipped = 0, errors = 0;

  // ── SOURCE 1: students collection (phone1 / phone2) ──────────────────────
  console.log('📚 Source 1: students collection (phone1 / phone2)...');
  const studentsSnap = await getDocs(
    query(collection(db, 'students'), where('active', '==', true))
  );
  console.log(`   Found ${studentsSnap.size} active students.\n`);

  for (const studentDoc of studentsSnap.docs) {
    const student   = studentDoc.data();
    const studentId = studentDoc.id;

    for (const phoneField of ['phone1', 'phone2']) {
      const phone = normalizePhone(student[phoneField]);
      if (!phone) continue;

      const result = await ensureParentDoc(phone, {
        name:      'Parent',
        branchId:  student.branchId || '',
        studentId,
        source:    `student/${student.name || studentId}`,
      });
      if (result === 'created') created++;
      else if (result === 'skipped') skipped++;
      else errors++;
    }
  }

  // ── SOURCE 2: registrations collection (parent1 / parent2) ───────────────
  console.log('\n📋 Source 2: registrations collection (approved)...');
  const regsSnap = await getDocs(
    query(collection(db, 'registrations'), where('status', '==', 'approved'))
  );
  console.log(`   Found ${regsSnap.size} approved registrations.\n`);

  for (const regDoc of regsSnap.docs) {
    const reg = regDoc.data();

    for (const parentKey of ['parent1', 'parent2']) {
      const parent = reg[parentKey];
      if (!parent) continue;
      const phone = normalizePhone(parent.phone);
      if (!phone) continue;

      const result = await ensureParentDoc(phone, {
        name:     parent.name     || 'Parent',
        email:    parent.email    || '',
        relation: parent.relation || '',
        branchId: reg.branch      || '',
        studentId: null,   // student ID not stored in registration; linked on login
        source:   `registration/${reg.studentName}`,
      });
      if (result === 'created') created++;
      else if (result === 'skipped') skipped++;
      else errors++;
    }
  }

  console.log(`
╔══════════════════════════════╗
║    Backfill Complete         ║
╠══════════════════════════════╣
║  Docs created     : ${String(created).padEnd(8)} ║
║  Already activated: ${String(skipped).padEnd(8)} ║
║  Errors           : ${String(errors).padEnd(8)} ║
╚══════════════════════════════╝
`);

  if (errors > 0) {
    console.warn('⚠️  Some docs failed. Re-run the script to retry.');
    process.exit(1);
  }
  process.exit(0);
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
