/**
 * HappyTimes QA — Full Verification Script (A-Z)
 * Phase 0: Link test phone to QA parent account
 * Phase 2: Create controlled test posts
 * Phase 3: Validate parent query returns expected posts
 * Phase 7: Validate fcm_tokens and users.fcmTokens presence
 */

import admin from 'firebase-admin';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// ── Bootstrap ────────────────────────────────────────────────
admin.initializeApp({ projectId: 'happytimes-preschool-pwa' });
const db = admin.firestore();
const auth = admin.auth();

const QA_PARENT_UID    = 'KxyQom31c8hDyhaDhoWTMjX3Kf02';
const QA_PHONE         = '+919999999999';       // test number from Firebase console
const QA_BRANCH        = 'outer-ring-road';
const QA_CLASS         = 'Mont-2';
const QA_DOC_IDS       = {};                    // will be populated

// ── Phase 0 — Link test phone number ─────────────────────────
async function phase0_linkPhone() {
  console.log('\n══ Phase 0: Link test phone number ══');
  try {
    await auth.updateUser(QA_PARENT_UID, { phoneNumber: QA_PHONE });
    console.log(`✅  Phone ${QA_PHONE} linked to UID ${QA_PARENT_UID}`);
  } catch (err) {
    if (err.code === 'auth/phone-number-already-exists') {
      // Phone may be on another account — remove it first, then re-link
      console.warn('⚠️  Phone already in use. Checking which account owns it…');
      try {
        const existing = await auth.getUserByPhoneNumber(QA_PHONE);
        if (existing.uid !== QA_PARENT_UID) {
          console.log(`   Removing phone from ${existing.uid}…`);
          await auth.updateUser(existing.uid, { phoneNumber: null });
          await auth.updateUser(QA_PARENT_UID, { phoneNumber: QA_PHONE });
          console.log(`✅  Phone re-linked to QA parent (${QA_PARENT_UID})`);
        } else {
          console.log('✅  Phone is already linked to the QA parent — nothing to do.');
        }
      } catch (innerErr) {
        console.error('❌  Failed to re-link phone:', innerErr.message);
      }
    } else {
      console.error('❌  Phase 0 failed:', err.message);
    }
  }
}

// ── Phase 2 — Create controlled test posts ───────────────────
async function phase2_createPosts() {
  console.log('\n══ Phase 2: Create controlled QA test posts ══');
  const now = admin.firestore.FieldValue.serverTimestamp();

  const posts = [
    {
      _key: 'global',
      title: '[QA] Global Post — All Branches',
      body: 'This post targets all branches. Every parent should see this.',
      scope: 'all',
      branchId: null,
      classId: null,
      className: null,
      category: 'General',
      authorUid: QA_PARENT_UID,
      authorName: 'QA Script',
      pushNotification: false,
      status: 'published',
      scheduledFor: null,
      imageUrls: [],
      timestamp: now,
    },
    {
      _key: 'branch',
      title: '[QA] Branch Post — Outer Ring Road',
      body: 'This post targets the Outer Ring Road branch only.',
      scope: 'branch',
      branchId: QA_BRANCH,
      classId: null,
      className: null,
      category: 'General',
      authorUid: QA_PARENT_UID,
      authorName: 'QA Script',
      pushNotification: false,
      status: 'published',
      scheduledFor: null,
      imageUrls: [],
      timestamp: now,
    },
    {
      _key: 'class',
      title: '[QA] Class Post — Mont-2 @ Outer Ring Road',
      body: 'This post targets Mont-2 class at Outer Ring Road only.',
      scope: 'class',
      branchId: QA_BRANCH,
      classId: QA_CLASS,
      className: QA_CLASS,
      category: 'General',
      authorUid: QA_PARENT_UID,
      authorName: 'QA Script',
      pushNotification: false,
      status: 'published',
      scheduledFor: null,
      imageUrls: [],
      timestamp: now,
    },
  ];

  for (const post of posts) {
    const { _key, ...data } = post;
    const ref = await db.collection('posts').add(data);
    QA_DOC_IDS[_key] = ref.id;
    console.log(`✅  Created qa_${_key}_post → ID: ${ref.id}`);
  }

  console.log('\nPost IDs saved:');
  console.log(JSON.stringify(QA_DOC_IDS, null, 2));
}

// ── Phase 3 — Validate parent feed query ─────────────────────
async function phase3_validateFeed() {
  console.log('\n══ Phase 3: Validate parent feed query ══');

  // Mirror the exact logic from getPostsForParent() in firestore.js
  const [classDocs, branchDocs, allDocs] = await Promise.all([
    db.collection('posts')
      .where('scope', '==', 'class')
      .where('classId', '==', QA_CLASS)
      .orderBy('timestamp', 'desc')
      .limit(30)
      .get(),
    db.collection('posts')
      .where('scope', '==', 'branch')
      .where('branchId', '==', QA_BRANCH)
      .orderBy('timestamp', 'desc')
      .limit(30)
      .get(),
    db.collection('posts')
      .where('scope', '==', 'all')
      .orderBy('timestamp', 'desc')
      .limit(20)
      .get(),
  ]);

  const seen = new Set();
  const merged = [];
  [...classDocs.docs, ...branchDocs.docs, ...allDocs.docs].forEach(d => {
    if (!seen.has(d.id)) {
      seen.add(d.id);
      merged.push({ id: d.id, ...d.data() });
    }
  });

  console.log(`\nTotal posts in feed query: ${merged.length}`);
  console.log('\nQA Post visibility check:');

  for (const [key, docId] of Object.entries(QA_DOC_IDS)) {
    const found = merged.find(p => p.id === docId);
    if (found) {
      console.log(`  ✅  qa_${key}_post (${docId}) — VISIBLE in feed`);
    } else {
      console.log(`  ❌  qa_${key}_post (${docId}) — MISSING from feed`);
    }
  }

  // List all found posts with scope info
  console.log('\nAll posts in feed:');
  merged.forEach(p => {
    const isQA = Object.values(QA_DOC_IDS).includes(p.id);
    console.log(`  ${isQA ? '🔵 QA' : '⚪   '} [${p.scope}] ${p.title?.substring(0, 60)} (${p.id})`);
  });
}

// ── Phase 7 — FCM token check ─────────────────────────────────
async function phase7_checkFCMTokens() {
  console.log('\n══ Phase 7: Check FCM tokens in Firestore ══');

  // Check /fcm_tokens/{uid}
  const tokenDoc = await db.collection('fcm_tokens').doc(QA_PARENT_UID).get();
  if (tokenDoc.exists) {
    const data = tokenDoc.data();
    console.log(`✅  /fcm_tokens/${QA_PARENT_UID} exists`);
    console.log(`   Token: ${data.token ? data.token.substring(0, 30) + '…' : 'MISSING'}`);
    console.log(`   Updated: ${data.updatedAt?.toDate?.() || data.updatedAt}`);
  } else {
    console.log(`❌  /fcm_tokens/${QA_PARENT_UID} does NOT exist — token was never saved`);
    console.log('   → Parent has not completed notification permission flow yet');
  }

  // Check /users/{uid}.fcmTokens array
  const userDoc = await db.collection('users').doc(QA_PARENT_UID).get();
  if (userDoc.exists) {
    const data = userDoc.data();
    const tokens = data.fcmTokens || [];
    if (tokens.length > 0) {
      console.log(`✅  /users/${QA_PARENT_UID}.fcmTokens: ${tokens.length} token(s)`);
      tokens.forEach((t, i) => console.log(`   [${i}] ${t.substring(0, 30)}…`));
    } else {
      console.log(`❌  /users/${QA_PARENT_UID}.fcmTokens is empty or missing`);
      console.log('   → Parent has not completed notification permission flow yet');
    }
  }
}

// ── Phase 0 student verification ─────────────────────────────
async function verifyStudentData() {
  console.log('\n══ Phase 0 (Data): Student + Parent link verification ══');
  const userDoc = await db.collection('users').doc(QA_PARENT_UID).get();
  const userData = userDoc.data();
  console.log(`Parent name: ${userData.name}`);
  console.log(`Parent role: ${userData.role}`);
  console.log(`Linked students: ${JSON.stringify(userData.linkedStudentIds)}`);
  console.log(`Phone in Firestore: ${userData.phone}`);

  const studentDoc = await db.collection('students').doc('student_abhinav_surya_kamble_1780577323600').get();
  if (studentDoc.exists) {
    const s = studentDoc.data();
    console.log(`\nStudent: ${s.name}`);
    console.log(`  branchId: ${s.branchId}   (expected: ${QA_BRANCH}) ${s.branchId === QA_BRANCH ? '✅' : '❌'}`);
    console.log(`  classId:  ${s.classId}    (expected: ${QA_CLASS}) ${s.classId === QA_CLASS ? '✅' : '❌'}`);
    console.log(`  active:   ${s.active}              ${s.active === true ? '✅' : '❌'}`);
    console.log(`  parentUids: ${JSON.stringify(s.parentUids)}`);
    const parentLinked = (s.parentUids || []).includes(QA_PARENT_UID);
    console.log(`  QA parent in parentUids: ${parentLinked ? '✅' : '❌'}`);
  } else {
    console.log('❌  Student document not found!');
  }
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  HappyTimes PWA — Full A-Z Verification Script');
  console.log('═══════════════════════════════════════════════════════');
  await phase0_linkPhone();
  await verifyStudentData();
  await phase2_createPosts();
  await phase3_validateFeed();
  await phase7_checkFCMTokens();
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  Script complete. Scroll up to review each phase.');
  console.log('═══════════════════════════════════════════════════════');
  process.exit(0);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
