import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { readFileSync, writeFileSync } from 'fs';
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
const auth = getAuth(app);

// Save directly to the artifacts directory
const artifactsDir = 'C:\\Users\\prath\\.gemini\\antigravity-ide\\brain\\6c57999a-2afc-4a67-8bb8-781723e45761';
const backupJsonPath = join(artifactsDir, 'registrations_backup_20260604.json');
const backupSummaryPath = join(artifactsDir, 'registrations_backup_summary.md');

async function backup() {
  console.log('Authenticating as Super Admin...');
  await signInWithEmailAndPassword(auth, 'happytimespreschool27@gmail.com', 'happytimes_admin_6754');
  console.log('Authentication successful!');

  console.log('Fetching registrations...');
  const regsSnap = await getDocs(collection(db, 'registrations'));
  const registrations = regsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  console.log(`Loaded ${registrations.length} registrations.`);

  // Write JSON backup
  writeFileSync(backupJsonPath, JSON.stringify(registrations, null, 2), 'utf-8');
  console.log(`Saved JSON backup to: ${backupJsonPath}`);

  // Categorize
  let pendingCount = 0;
  let approvedCount = 0;
  let rejectedCount = 0;
  const listLines = [];

  registrations.forEach(r => {
    if (r.status === 'approved') approvedCount++;
    else if (r.status === 'rejected') rejectedCount++;
    else pendingCount++;

    const parentName = r.parent1?.name || 'N/A';
    const parentPhone = r.parent1?.phone || 'N/A';
    listLines.push(`| ${r.studentName || 'N/A'} | ${r.className || 'N/A'} | ${r.branch || 'N/A'} | ${parentName} (${parentPhone}) | ${r.status || 'pending'} |`);
  });

  // Write Markdown summary
  const summaryContent = `# Registrations Backup Summary — 2026-06-04

This is a backup summary of all registrations in the Happy Times Preschool database prior to cleanup.

## Summary Stats
* **Total Registrations**: ${registrations.length}
* **Pending**: ${pendingCount}
* **Approved**: ${approvedCount}
* **Rejected**: ${rejectedCount}

## Backup Locations
* **JSON Raw Data**: [registrations_backup_20260604.json](file:///C:/Users/prath/.gemini/antigravity-ide/brain/6c57999a-2afc-4a67-8bb8-781723e45761/registrations_backup_20260604.json)

## Submissions List

| Student Name | Class | Branch | Parent / Phone | Status |
|---|---|---|---|---|
${listLines.join('\n')}
`;

  writeFileSync(backupSummaryPath, summaryContent, 'utf-8');
  console.log(`Saved Markdown summary to: ${backupSummaryPath}`);

  console.log('Backup operation completed successfully!');
}

backup().catch(console.error);
