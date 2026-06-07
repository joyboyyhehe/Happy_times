/**
 * normalize_classnames.js — One-time migration script
 *
 * Scans all student documents in Firestore and normalizes class name variants:
 *   'Mont -1' → 'Mont-1'
 *   'Mont -2' → 'Mont-2'
 *   'Mont -3' → 'Mont-3'
 *   'Pre Mont' / 'PreMont' → 'Pre-Mont'
 *
 * SAFETY:
 *   - Run with --dry-run first (default) to preview changes
 *   - Pass --execute to actually write changes
 *   - Logs every change to console for audit trail
 *   - Does NOT delete any documents or fields
 *   - Updates both 'classId' and 'className' fields
 *
 * USAGE:
 *   node scripts/normalize_classnames.js              # dry run
 *   node scripts/normalize_classnames.js --execute     # apply changes
 *
 * PREREQUISITES:
 *   - Firebase Admin SDK credentials configured
 *   - Run from project root: happytimes-pwa/
 *
 * TIMING:
 *   - Run AFTER deploying code that supports both old + new names
 *   - Run OUTSIDE active attendance hours (after 8 PM)
 *   - Verify attendance loads correctly after migration
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// ── Config ──
const ALIASES = {
  'Mont -1': 'Mont-1',
  'Mont -2': 'Mont-2',
  'Mont -3': 'Mont-3',
  'Pre Mont': 'Pre-Mont',
  'PreMont': 'Pre-Mont',
  'premont': 'Pre-Mont',
  'pre-mont': 'Pre-Mont',
};

const DRY_RUN = !process.argv.includes('--execute');

// ── Init Firebase Admin ──
const serviceAccountPath = resolve('serviceAccountKey.json');
if (!existsSync(serviceAccountPath)) {
  console.error('❌ serviceAccountKey.json not found in project root.');
  console.error('   Download from Firebase Console → Project Settings → Service Accounts');
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ── Main ──
async function main() {
  console.log(`\n🔧 Class Name Normalization Script`);
  console.log(`   Mode: ${DRY_RUN ? '🟡 DRY RUN (preview only)' : '🔴 EXECUTE (writing changes)'}`);
  console.log(`   Time: ${new Date().toISOString()}\n`);

  const studentsSnap = await db.collection('students').get();
  console.log(`📊 Total students found: ${studentsSnap.size}\n`);

  let changeCount = 0;
  let skipCount = 0;
  const changes = [];

  for (const docSnap of studentsSnap.docs) {
    const data = docSnap.data();
    const studentId = docSnap.id;
    const rawClassId = data.classId || '';
    const rawClassName = data.className || '';

    const normalizedClassId = ALIASES[rawClassId] || null;
    const normalizedClassName = ALIASES[rawClassName] || null;

    if (normalizedClassId || normalizedClassName) {
      const update = {};
      if (normalizedClassId) update.classId = normalizedClassId;
      if (normalizedClassName) update.className = normalizedClassName;

      changes.push({
        studentId,
        name: data.name || '(no name)',
        oldClassId: rawClassId,
        newClassId: normalizedClassId || rawClassId,
        oldClassName: rawClassName,
        newClassName: normalizedClassName || rawClassName,
      });

      if (!DRY_RUN) {
        await db.collection('students').doc(studentId).update(update);
      }

      changeCount++;
      console.log(
        `  ${DRY_RUN ? '📋' : '✅'} ${data.name || studentId}: ` +
        `classId "${rawClassId}" → "${normalizedClassId || rawClassId}", ` +
        `className "${rawClassName}" → "${normalizedClassName || rawClassName}"`
      );
    } else {
      skipCount++;
    }
  }

  console.log(`\n────────────────────────────────────`);
  console.log(`📊 Results:`);
  console.log(`   Changed: ${changeCount}`);
  console.log(`   Skipped (already correct): ${skipCount}`);
  console.log(`   Total: ${studentsSnap.size}`);

  if (DRY_RUN && changeCount > 0) {
    console.log(`\n⚠️  This was a DRY RUN. No changes were written.`);
    console.log(`   Run with --execute to apply changes:`);
    console.log(`   node scripts/normalize_classnames.js --execute\n`);
  } else if (!DRY_RUN && changeCount > 0) {
    console.log(`\n✅ All changes applied successfully.`);
    console.log(`   Verify attendance loads correctly before removing backward compatibility.\n`);
  } else {
    console.log(`\n✅ No normalization needed — all class names are already canonical.\n`);
  }
}

main().catch((err) => {
  console.error('❌ Script failed:', err);
  process.exit(1);
});
