/**
 * generate_user_report.js
 * 
 * Reads the raw Firestore JSON exports (already fetched by MCP) and generates
 * a clean, sorted A-Z user report text file.
 * 
 * Usage:
 *   node scripts/generate_user_report.js <users_json_path> <registrations_json_path>
 * 
 * Or with defaults (reads from the system-generated output files):
 *   node scripts/generate_user_report.js
 */

import { readFileSync, writeFileSync } from 'fs';

// Force UTF-8 output (Windows fix)
process.stdout.reconfigure?.({ encoding: 'utf8' });

const BRANCH_NAMES = {
  'padmanabhanagar': 'Padmanabhanagar',
  'outer-ring-road': 'Outer Ring Road',
  'chikkalsandra':   'Chikkalsandra',
  'rr-nagar':        'RR Nagar',
};

function branchName(id) {
  return BRANCH_NAMES[id] || id || '-';
}

function fmtDate(val) {
  if (!val) return '-';
  if (typeof val === 'object' && val.timestampValue) val = val.timestampValue;
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true });
}

/** Parse the messy Firestore REST response format into a plain JS object */
function parseFirestoreField(field) {
  if (!field || typeof field !== 'object') return null;
  if ('stringValue'    in field) return field.stringValue;
  if ('integerValue'   in field) return parseInt(field.integerValue, 10);
  if ('doubleValue'    in field) return field.doubleValue;
  if ('booleanValue'   in field) return field.booleanValue;
  if ('nullValue'      in field) return null;
  if ('timestampValue' in field) return field.timestampValue;
  if ('arrayValue'     in field) {
    return (field.arrayValue.values || []).map(parseFirestoreField);
  }
  if ('mapValue' in field) {
    const result = {};
    for (const [k, v] of Object.entries(field.mapValue.fields || {})) {
      result[k] = parseFirestoreField(v);
    }
    return result;
  }
  return null;
}

function parseDocument(doc) {
  const result = {};
  for (const [k, v] of Object.entries(doc.fields || {})) {
    result[k] = parseFirestoreField(v);
  }
  // Extract document ID from name path
  result.__docId = (doc.name || '').split('/').pop();
  result.__createTime = doc.createTime;
  result.__updateTime = doc.updateTime;
  return result;
}

function sep(char = '-', len = 80) { return char.repeat(len); }

function sectionTitle(title) {
  const pad = Math.max(0, Math.floor((76 - title.length) / 2));
  return `\n${'='.repeat(80)}\n${' '.repeat(pad)}  ${title}  \n${'='.repeat(80)}\n`;
}

// ── Read raw JSON files ───────────────────────────────────────────────────────
const usersJsonPath        = process.argv[2] || String.raw`C:\Users\prath\.gemini\antigravity-ide\brain\69e56d25-b3af-4a80-b97f-0ffb447729c8\.system_generated\steps\50\output.txt`;
const registrationsJsonPath = process.argv[3] || String.raw`C:\Users\prath\.gemini\antigravity-ide\brain\69e56d25-b3af-4a80-b97f-0ffb447729c8\.system_generated\steps\54\output.txt`;

console.log('Reading users data from:', usersJsonPath);
console.log('Reading registrations data from:', registrationsJsonPath);

const usersRaw        = JSON.parse(readFileSync(usersJsonPath, 'utf-8'));
const registrationsRaw = JSON.parse(readFileSync(registrationsJsonPath, 'utf-8'));

const allUsers = (usersRaw.documents || []).map(parseDocument);
const allRegs  = (registrationsRaw.documents || []).map(parseDocument);

// ── Categorise ────────────────────────────────────────────────────────────────
const staffUsers  = allUsers
  .filter(u => u.role === 'superadmin' || u.role === 'branchadmin')
  .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

// Deduplicate parents by phone (prefer the UID-keyed doc, then parent_XXXXX, then any)
const parentByPhone = {};
allUsers
  .filter(u => u.role === 'parent')
  .forEach(u => {
    const phone = (u.phone || '').replace('+91', '').trim();
    if (!phone) return;
    const existing = parentByPhone[phone];
    if (!existing) {
      parentByPhone[phone] = u;
    } else {
      // Prefer the doc with a real UID (authenticated user), or the richer one
      const existingHasUid = existing.uid && !existing.__docId.startsWith('parent_');
      const newHasUid = u.uid && !u.__docId.startsWith('parent_');
      if (newHasUid && !existingHasUid) parentByPhone[phone] = u;
    }
  });
const parentUsers = Object.values(parentByPhone)
  .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

const pendingRegs  = allRegs.filter(r => r.status === 'pending')
  .sort((a, b) => (a.studentName || '').localeCompare(b.studentName || ''));
const approvedRegs = allRegs.filter(r => r.status === 'approved')
  .sort((a, b) => (a.studentName || '').localeCompare(b.studentName || ''));
const rejectedRegs = allRegs.filter(r => r.status === 'rejected')
  .sort((a, b) => (a.studentName || '').localeCompare(b.studentName || ''));

// ── Build report lines ────────────────────────────────────────────────────────
const lines = [];
const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true });

lines.push('='.repeat(80));
lines.push('  HAPPY TIMES PRESCHOOL & MONTESSORI -- COMPLETE USER DIRECTORY');
lines.push(`  Generated on: ${now}`);
lines.push('='.repeat(80));

lines.push('\n' + sep() + '\n  SUMMARY\n' + sep());
lines.push(`  Staff / Admin Users                          : ${staffUsers.length}`);
lines.push(`  Accepted Parent Accounts (Portal Access)     : ${parentUsers.length}`);
lines.push(`  -------------------------------------------------`);
lines.push(`  Pending Registrations (awaiting approval)    : ${pendingRegs.length}`);
lines.push(`  Approved Registrations                       : ${approvedRegs.length}`);
lines.push(`  Rejected Registrations                       : ${rejectedRegs.length}`);
lines.push(`  Total Registrations                          : ${allRegs.length}`);
lines.push(sep());

// ──────────────────────────────────────────────────────────────────────────────
// SECTION A — STAFF / ADMIN USERS
// ──────────────────────────────────────────────────────────────────────────────
lines.push(sectionTitle(`SECTION A - STAFF USERS (${staffUsers.length})`));
lines.push('  Includes: Super Admins and Branch Admins. Sorted A-Z by name.\n');

if (staffUsers.length === 0) {
  lines.push('  No staff users found.\n');
} else {
  staffUsers.forEach((u, i) => {
    const roleLabel = u.role === 'superadmin' ? 'Super Admin (All Branches)' : 'Branch Admin';
    const branch    = u.role === 'superadmin' ? 'All Branches (Global)' : branchName(u.branchId);
    lines.push(`  [${String(i + 1).padStart(2, '0')}] ${u.name || '(no name)'}`);
    lines.push(`       Role         : ${roleLabel}`);
    lines.push(`       Email        : ${u.email || '-'}`);
    lines.push(`       Branch       : ${branch}`);
    lines.push(`       Firebase UID : ${u.uid || '(not yet signed in)'}`);
    lines.push(`       Doc ID       : ${u.__docId}`);
    lines.push(`       Created At   : ${fmtDate(u.createdAt || u.__createTime)}`);
    lines.push(`       Updated At   : ${fmtDate(u.updatedAt || u.__updateTime)}`);
    lines.push('       ' + sep('-', 72));
  });
}

// SECTION B — ACCEPTED PARENT ACCOUNTS
// ──────────────────────────────────────────────────────────────────────────────
lines.push(sectionTitle(`SECTION B - ACCEPTED PARENT ACCOUNTS (${parentUsers.length})`));
lines.push('  Parents who are whitelisted and can log in via OTP. Sorted A-Z.\n');

if (parentUsers.length === 0) {
  lines.push('  No parent accounts found.\n');
} else {
  parentUsers.forEach((u, i) => {
    const phone = u.phone || '-';
    const students = Array.isArray(u.linkedStudentIds) ? u.linkedStudentIds.join(', ') : '-';
    lines.push(`  [${String(i + 1).padStart(2, '0')}] ${u.name || '(no name)'}`);
    lines.push(`       Relation     : ${u.relation || '-'}`);
    lines.push(`       Phone        : ${phone}`);
    lines.push(`       Email        : ${u.email || '-'}`);
    lines.push(`       Portal Login : ${u.uid ? '[YES] Logged in (UID: ' + u.uid + ')' : '[NO]  Not yet logged in'}`);
    lines.push(`       Students     : ${students}`);
    lines.push(`       Doc ID       : ${u.__docId}`);
    lines.push(`       Created At   : ${fmtDate(u.createdAt || u.__createTime)}`);
    lines.push('       ' + sep('-', 72));
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// SECTION C — PENDING REGISTRATIONS
// ──────────────────────────────────────────────────────────────────────────────
lines.push(sectionTitle(`SECTION C - PENDING REGISTRATIONS [PENDING] (${pendingRegs.length})`));
lines.push('  Families who submitted the form and are waiting for admin approval.\n');
lines.push('  * Sorted A-Z by student name.\n');

function regEntry(r, i, status) {
  const p1 = r.parent1 || {};
  const p2 = r.parent2 || null;
  lines.push(`  [${String(i + 1).padStart(2, '0')}] STUDENT : ${r.studentName || '(no name)'}`);
  lines.push(`       Branch    : ${branchName(r.branch)}`);
  lines.push(`       Class     : ${r.className || '—'}`);
  lines.push(`       Status    : ${status}`);
  lines.push(`       Submitted : ${fmtDate(r.submittedAt || r.__createTime)}`);
  if (r.approvedAt) lines.push(`       Approved  : ${fmtDate(r.approvedAt)}`);
  if (r.rejectedAt) lines.push(`       Rejected  : ${fmtDate(r.rejectedAt)}`);
  lines.push('');
  lines.push(`       PRIMARY GUARDIAN (${p1.relation || '-'})`);
  lines.push(`         Name     : ${p1.name || '-'}`);
  lines.push(`         Phone    : ${p1.phone ? '+91 ' + p1.phone : '-'}`);
  lines.push(`         Email    : ${p1.email || '-'}`);
  if (p1.verifiedUid) lines.push(`         OTP      : [VERIFIED] UID: ${p1.verifiedUid}`);
  if (p2 && p2.name) {
    lines.push('');
    lines.push(`       SECONDARY GUARDIAN (${p2.relation || '-'})`);
    lines.push(`         Name     : ${p2.name}`);
    lines.push(`         Phone    : ${p2.phone ? '+91 ' + p2.phone : '-'}`);
    lines.push(`         Email    : ${p2.email || '-'}`);
  }
  lines.push(`       Doc ID    : ${r.__docId}`);
  lines.push('       ' + sep('.', 72));
}

if (pendingRegs.length === 0) {
  lines.push('  No pending registrations.\n');
} else {
  pendingRegs.forEach((r, i) => regEntry(r, i, 'PENDING (Awaiting Admin Approval)'));
}

// ──────────────────────────────────────────────────────────────────────────────
// SECTION D — APPROVED REGISTRATIONS
// ──────────────────────────────────────────────────────────────────────────────
lines.push(sectionTitle(`SECTION D - APPROVED REGISTRATIONS (${approvedRegs.length})`));
lines.push('  Registrations accepted by admin. Parents are whitelisted. Sorted A-Z.\n');

if (approvedRegs.length === 0) {
  lines.push('  No approved registrations.\n');
} else {
  approvedRegs.forEach((r, i) => regEntry(r, i, 'APPROVED'));
}

// ──────────────────────────────────────────────────────────────────────────────
// SECTION E — REJECTED REGISTRATIONS
// ──────────────────────────────────────────────────────────────────────────────
lines.push(sectionTitle(`SECTION E - REJECTED REGISTRATIONS (${rejectedRegs.length})`));
lines.push('  Registrations that were declined by admin. Sorted A-Z.\n');

if (rejectedRegs.length === 0) {
  lines.push('  No rejected registrations.\n');
} else {
  rejectedRegs.forEach((r, i) => regEntry(r, i, 'REJECTED'));
}

// ── Footer ────────────────────────────────────────────────────────────────────
lines.push('\n' + '='.repeat(80));
lines.push('  END OF REPORT -- HAPPY TIMES PRESCHOOL & MONTESSORI');
lines.push('='.repeat(80) + '\n');

// ── Write file ────────────────────────────────────────────────────────────────
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outputPath = `all_users_report_${timestamp}.txt`;
// Write with UTF-8 BOM so Windows Notepad shows it correctly
const BOM = '\uFEFF';
writeFileSync(outputPath, BOM + lines.join('\r\n'), 'utf-8');

console.log('\n✅  Report generated successfully!');
console.log(`📄  File: ${outputPath}`);
console.log(`\n  Staff users              : ${staffUsers.length}`);
console.log(`  Accepted parent accounts : ${parentUsers.length}`);
console.log(`  Pending registrations    : ${pendingRegs.length}`);
console.log(`  Approved registrations   : ${approvedRegs.length}`);
console.log(`  Rejected registrations   : ${rejectedRegs.length}`);
