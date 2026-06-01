import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { readFileSync, writeFileSync } from 'fs';

// ── Parse .env manually ────────────────────────────────────────────────────────
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

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ── Helpers ────────────────────────────────────────────────────────────────────
const BRANCH_NAMES = {
  'padmanabhanagar': 'Padmanabhanagar',
  'outer-ring-road': 'Outer Ring Road',
  'chikkalsandra':   'Chikkalsandra',
  'rr-nagar':        'RR Nagar',
};

function branchName(id) {
  return BRANCH_NAMES[id] || id || '—';
}

function fmtDate(val) {
  if (!val) return '—';
  // Firestore Timestamps
  if (val.toDate) return val.toDate().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  // ISO strings / plain strings
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
}

function separator(char = '─', len = 80) {
  return char.repeat(len);
}

function sectionTitle(title) {
  const pad = Math.max(0, Math.floor((80 - title.length - 4) / 2));
  return `\n${'═'.repeat(80)}\n${' '.repeat(pad)}  ${title}  \n${'═'.repeat(80)}\n`;
}

// ── Main export function ───────────────────────────────────────────────────────
async function exportAllUsers() {
  console.log('Connecting to Firestore…');

  // 1. Fetch /users (parents + staff)
  const usersSnap = await getDocs(collection(db, 'users'));
  const allUsers = [];
  usersSnap.forEach(d => allUsers.push({ docId: d.id, ...d.data() }));

  // 2. Fetch /registrations (all statuses)
  const regSnap = await getDocs(collection(db, 'registrations'));
  const allRegs = [];
  regSnap.forEach(d => allRegs.push({ docId: d.id, ...d.data() }));

  // ── Split users by type ──────────────────────────────────────────────────────
  const staffUsers  = allUsers
    .filter(u => u.role === 'superadmin' || u.role === 'branchadmin')
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  const parentUsers = allUsers
    .filter(u => u.role === 'parent')
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  // ── Split registrations by status ────────────────────────────────────────────
  const pendingRegs  = allRegs.filter(r => r.status === 'pending')
    .sort((a, b) => (a.studentName || '').localeCompare(b.studentName || ''));
  const approvedRegs = allRegs.filter(r => r.status === 'approved')
    .sort((a, b) => (a.studentName || '').localeCompare(b.studentName || ''));
  const rejectedRegs = allRegs.filter(r => r.status === 'rejected')
    .sort((a, b) => (a.studentName || '').localeCompare(b.studentName || ''));

  // ── Build text report ────────────────────────────────────────────────────────
  const lines = [];
  const generatedAt = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  lines.push('╔' + '═'.repeat(78) + '╗');
  lines.push('║' + '  HAPPY TIMES PRESCHOOL & MONTESSORI — ALL USERS EXPORT'.padEnd(78) + '║');
  lines.push('║' + `  Generated: ${generatedAt}`.padEnd(78) + '║');
  lines.push('╚' + '═'.repeat(78) + '╝');

  lines.push(`\nSUMMARY`);
  lines.push(separator());
  lines.push(`  Staff Users (Super Admins + Branch Admins) : ${staffUsers.length}`);
  lines.push(`  Accepted Parent Users (whitelisted)        : ${parentUsers.length}`);
  lines.push(`  Registrations — Pending (awaiting approval): ${pendingRegs.length}`);
  lines.push(`  Registrations — Approved                   : ${approvedRegs.length}`);
  lines.push(`  Registrations — Rejected                   : ${rejectedRegs.length}`);
  lines.push(`  TOTAL REGISTRATIONS                        : ${allRegs.length}`);
  lines.push(separator());

  // ────────────────────────────────────────────────────────────────────────────
  // SECTION 1 — STAFF USERS
  // ────────────────────────────────────────────────────────────────────────────
  lines.push(sectionTitle(`STAFF USERS (${staffUsers.length})`));

  if (staffUsers.length === 0) {
    lines.push('  No staff users found.\n');
  } else {
    staffUsers.forEach((u, i) => {
      const roleLabel = u.role === 'superadmin' ? 'Super Admin (Global)' : 'Branch Admin';
      lines.push(`  [${String(i + 1).padStart(2, '0')}]  ${u.name || '(no name)'}`);
      lines.push(`       Role         : ${roleLabel}`);
      lines.push(`       Email        : ${u.email || '—'}`);
      lines.push(`       Branch Scope : ${u.role === 'superadmin' ? 'All Branches' : branchName(u.branchId)}`);
      lines.push(`       Firebase UID : ${u.uid || '(not yet logged in)'}`);
      lines.push(`       Doc ID       : ${u.docId}`);
      lines.push(`       Created At   : ${fmtDate(u.createdAt)}`);
      lines.push(`       Updated At   : ${fmtDate(u.updatedAt)}`);
      lines.push('       ' + separator('·', 72));
    });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // SECTION 2 — ACCEPTED PARENT USERS (whitelisted in /users)
  // ────────────────────────────────────────────────────────────────────────────
  lines.push(sectionTitle(`ACCEPTED PARENT ACCOUNTS — WHITELISTED (${parentUsers.length})`));
  lines.push('  These parents have been accepted and can log in via OTP.\n');

  if (parentUsers.length === 0) {
    lines.push('  No parent accounts found.\n');
  } else {
    parentUsers.forEach((u, i) => {
      lines.push(`  [${String(i + 1).padStart(2, '0')}]  ${u.name || '(no name)'}`);
      lines.push(`       Relation          : ${u.relation || '—'}`);
      lines.push(`       Phone             : ${u.phone || '—'}`);
      lines.push(`       Email             : ${u.email || '—'}`);
      lines.push(`       Firebase UID      : ${u.uid || '(not yet logged in)'}`);
      lines.push(`       Linked Students   : ${(u.linkedStudentIds || []).join(', ') || '—'}`);
      lines.push(`       Doc ID            : ${u.docId}`);
      lines.push(`       Created At        : ${fmtDate(u.createdAt)}`);
      lines.push(`       Updated At        : ${fmtDate(u.updatedAt)}`);
      lines.push('       ' + separator('·', 72));
    });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // SECTION 3 — PENDING REGISTRATIONS (waiting for admin to accept)
  // ────────────────────────────────────────────────────────────────────────────
  lines.push(sectionTitle(`PENDING REGISTRATIONS — AWAITING ADMIN APPROVAL (${pendingRegs.length})`));
  lines.push('  These families submitted the online registration form and are waiting for approval.\n');

  if (pendingRegs.length === 0) {
    lines.push('  No pending registrations found.\n');
  } else {
    pendingRegs.forEach((r, i) => {
      lines.push(`  [${String(i + 1).padStart(2, '0')}]  STUDENT: ${r.studentName || '(no name)'}`);
      lines.push(`       Branch           : ${branchName(r.branch)}`);
      lines.push(`       Class Applied    : ${r.className || '—'}`);
      lines.push(`       Status           : PENDING ⏳`);
      lines.push(`       Submitted At     : ${fmtDate(r.submittedAt)}`);
      lines.push('');
      lines.push(`       PRIMARY GUARDIAN`);
      if (r.parent1) {
        lines.push(`         Name     : ${r.parent1.name || '—'}`);
        lines.push(`         Relation : ${r.parent1.relation || '—'}`);
        lines.push(`         Phone    : ${r.parent1.phone ? '+91 ' + r.parent1.phone : '—'}`);
        lines.push(`         Email    : ${r.parent1.email || '—'}`);
      } else {
        lines.push(`         (no primary guardian data)`);
      }
      if (r.parent2) {
        lines.push('');
        lines.push(`       SECONDARY GUARDIAN`);
        lines.push(`         Name     : ${r.parent2.name || '—'}`);
        lines.push(`         Relation : ${r.parent2.relation || '—'}`);
        lines.push(`         Phone    : ${r.parent2.phone ? '+91 ' + r.parent2.phone : '—'}`);
        lines.push(`         Email    : ${r.parent2.email || '—'}`);
      }
      lines.push(`       Doc ID           : ${r.docId}`);
      lines.push('       ' + separator('·', 72));
    });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // SECTION 4 — APPROVED REGISTRATIONS
  // ────────────────────────────────────────────────────────────────────────────
  lines.push(sectionTitle(`APPROVED REGISTRATIONS (${approvedRegs.length})`));
  lines.push('  These registrations were accepted by admin. Parents are whitelisted.\n');

  if (approvedRegs.length === 0) {
    lines.push('  No approved registrations found.\n');
  } else {
    approvedRegs.forEach((r, i) => {
      lines.push(`  [${String(i + 1).padStart(2, '0')}]  STUDENT: ${r.studentName || '(no name)'}`);
      lines.push(`       Branch           : ${branchName(r.branch)}`);
      lines.push(`       Class Applied    : ${r.className || '—'}`);
      lines.push(`       Status           : APPROVED ✅`);
      lines.push(`       Submitted At     : ${fmtDate(r.submittedAt)}`);
      lines.push(`       Approved At      : ${fmtDate(r.approvedAt)}`);
      lines.push('');
      lines.push(`       PRIMARY GUARDIAN`);
      if (r.parent1) {
        lines.push(`         Name     : ${r.parent1.name || '—'}`);
        lines.push(`         Relation : ${r.parent1.relation || '—'}`);
        lines.push(`         Phone    : ${r.parent1.phone ? '+91 ' + r.parent1.phone : '—'}`);
        lines.push(`         Email    : ${r.parent1.email || '—'}`);
      }
      if (r.parent2) {
        lines.push('');
        lines.push(`       SECONDARY GUARDIAN`);
        lines.push(`         Name     : ${r.parent2.name || '—'}`);
        lines.push(`         Relation : ${r.parent2.relation || '—'}`);
        lines.push(`         Phone    : ${r.parent2.phone ? '+91 ' + r.parent2.phone : '—'}`);
        lines.push(`         Email    : ${r.parent2.email || '—'}`);
      }
      lines.push(`       Doc ID           : ${r.docId}`);
      lines.push('       ' + separator('·', 72));
    });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // SECTION 5 — REJECTED REGISTRATIONS
  // ────────────────────────────────────────────────────────────────────────────
  lines.push(sectionTitle(`REJECTED REGISTRATIONS (${rejectedRegs.length})`));
  lines.push('  These registrations were declined by admin.\n');

  if (rejectedRegs.length === 0) {
    lines.push('  No rejected registrations found.\n');
  } else {
    rejectedRegs.forEach((r, i) => {
      lines.push(`  [${String(i + 1).padStart(2, '0')}]  STUDENT: ${r.studentName || '(no name)'}`);
      lines.push(`       Branch           : ${branchName(r.branch)}`);
      lines.push(`       Class Applied    : ${r.className || '—'}`);
      lines.push(`       Status           : REJECTED ❌`);
      lines.push(`       Submitted At     : ${fmtDate(r.submittedAt)}`);
      lines.push(`       Rejected At      : ${fmtDate(r.rejectedAt)}`);
      lines.push('');
      lines.push(`       PRIMARY GUARDIAN`);
      if (r.parent1) {
        lines.push(`         Name     : ${r.parent1.name || '—'}`);
        lines.push(`         Relation : ${r.parent1.relation || '—'}`);
        lines.push(`         Phone    : ${r.parent1.phone ? '+91 ' + r.parent1.phone : '—'}`);
        lines.push(`         Email    : ${r.parent1.email || '—'}`);
      }
      if (r.parent2) {
        lines.push('');
        lines.push(`       SECONDARY GUARDIAN`);
        lines.push(`         Name     : ${r.parent2.name || '—'}`);
        lines.push(`         Relation : ${r.parent2.relation || '—'}`);
        lines.push(`         Phone    : ${r.parent2.phone ? '+91 ' + r.parent2.phone : '—'}`);
        lines.push(`         Email    : ${r.parent2.email || '—'}`);
      }
      lines.push(`       Doc ID           : ${r.docId}`);
      lines.push('       ' + separator('·', 72));
    });
  }

  // ── Write file ───────────────────────────────────────────────────────────────
  lines.push('\n' + '═'.repeat(80));
  lines.push('  END OF REPORT');
  lines.push('═'.repeat(80) + '\n');

  const outputPath = `all_users_export_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.txt`;
  writeFileSync(outputPath, lines.join('\n'), 'utf-8');

  console.log('\n✅  Export complete!');
  console.log(`📄  File saved: ${outputPath}`);
  console.log(`\n  Staff users         : ${staffUsers.length}`);
  console.log(`  Accepted parents    : ${parentUsers.length}`);
  console.log(`  Pending registrations : ${pendingRegs.length}`);
  console.log(`  Approved registrations: ${approvedRegs.length}`);
  console.log(`  Rejected registrations: ${rejectedRegs.length}`);
}

exportAllUsers().catch(err => {
  console.error('Export failed:', err);
  process.exit(1);
});
