import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
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
const auth = getAuth(app);

async function checkIntegrity() {
  console.log('--- STARTING DATABASE INTEGRITY SCAN ---');
  
  console.log('Authenticating as Super Admin...');
  await signInWithEmailAndPassword(auth, 'happytimespreschool27@gmail.com', 'happytimes_admin_6754');
  console.log('Authentication successful!');
  
  // 1. Fetch collections
  console.log('Fetching users...');
  const usersSnap = await getDocs(collection(db, 'users'));
  const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  console.log('Fetching students...');
  const studentsSnap = await getDocs(collection(db, 'students'));
  const students = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  console.log('Fetching registrations...');
  const regsSnap = await getDocs(collection(db, 'registrations'));
  const regs = regsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  console.log(`\nTotals loaded: users=${users.length}, students=${students.length}, registrations=${regs.length}`);
  
  // 2. Perform Integrity Checks
  const studentIds = new Set(students.map(s => s.id));
  const userIds = new Set(users.map(u => u.id));
  const parentPhoneDocs = new Set(users.filter(u => u.role === 'parent').map(u => u.phone ? u.phone.replace('+91', '').trim() : ''));
  
  const orphanedStudents = [];
  const studentsWithoutBranch = [];
  const unlinkedParents = [];
  const staffWithoutRoles = [];
  const duplicateRegs = [];
  
  // Check Students
  students.forEach(s => {
    // Check missing branchId
    if (!s.branchId) {
      studentsWithoutBranch.push(s);
    }
    
    // Check orphaned students (no parents list or all parentUids missing/unregistered)
    const pUids = s.parentUids || [];
    if (pUids.length === 0) {
      orphanedStudents.push({ student: s, reason: 'Empty parentUids list' });
    } else {
      const activeParents = pUids.filter(uid => userIds.has(uid));
      if (activeParents.length === 0) {
        orphanedStudents.push({ student: s, reason: `Unregistered parent UIDs: [${pUids.join(', ')}]` });
      }
    }
  });
  
  // Check Users (Parents & Staff)
  users.forEach(u => {
    const role = u.role;
    if (role === 'parent') {
      const linked = u.linkedStudentIds || [];
      if (linked.length === 0) {
        unlinkedParents.push({ parent: u, reason: 'No linked student IDs' });
      } else {
        const activeStudents = linked.filter(sid => studentIds.has(sid));
        if (activeStudents.length === 0) {
          unlinkedParents.push({ parent: u, reason: `Linked students do not exist in database: [${linked.join(', ')}]` });
        }
      }
    } else if (role === 'teacher' || role === 'staff' || role === 'branchadmin' || role === 'superadmin') {
      // Whitelist or profile role verification
      if (!role) {
        staffWithoutRoles.push({ user: u, reason: 'Empty or missing role field' });
      }
    } else if (!role) {
      staffWithoutRoles.push({ user: u, reason: 'Undefined system role' });
    }
  });
  
  // Check Duplicate Registrations (same student name & class & parent1 phone)
  const regKeys = new Map();
  regs.forEach(r => {
    const sName = (r.studentName || '').toLowerCase().trim();
    const cName = (r.className || '').toLowerCase().trim();
    const parentPhone = r.parent1?.phone ? r.parent1.phone.replace('+91', '').trim() : 'unknown';
    
    if (sName && cName && parentPhone) {
      const key = `${sName}_${cName}_${parentPhone}`;
      if (regKeys.has(key)) {
        regKeys.get(key).push(r);
      } else {
        regKeys.set(key, [r]);
      }
    }
  });
  
  for (const [key, list] of regKeys.entries()) {
    if (list.length > 1) {
      duplicateRegs.push({ key, count: list.length, docs: list.map(l => l.id) });
    }
  }
  
  // 3. Print Results
  console.log('\n==================================================');
  console.log('DATABASE INTEGRITY SCAN RESULTS');
  console.log('==================================================');
  
  console.log(`\n1. Students without branchId: ${studentsWithoutBranch.length}`);
  studentsWithoutBranch.forEach(s => console.log(`  - Student ID: ${s.id}, Name: ${s.name}`));
  
  console.log(`\n2. Orphaned students: ${orphanedStudents.length}`);
  orphanedStudents.forEach(o => console.log(`  - Student ID: ${o.student.id}, Name: ${o.student.name} (${o.reason})`));
  
  console.log(`\n3. Unlinked parents: ${unlinkedParents.length}`);
  unlinkedParents.forEach(p => console.log(`  - Parent ID: ${p.parent.id}, Name: ${p.parent.name}, Phone: ${p.parent.phone} (${p.reason})`));
  
  console.log(`\n4. Users without valid roles: ${staffWithoutRoles.length}`);
  staffWithoutRoles.forEach(s => console.log(`  - User ID: ${s.user.id}, Name: ${s.user.name} (${s.reason})`));
  
  console.log(`\n5. Duplicate registration keys found: ${duplicateRegs.length}`);
  duplicateRegs.forEach(d => console.log(`  - Key: "${d.key}", Count: ${d.count}, Doc IDs: [${d.docs.join(', ')}]`));
  
  console.log('\n==================================================');
  console.log('SCAN COMPLETE');
  console.log('==================================================');
  
  await signOut(auth);
  console.log('Signed out Super Admin.');
}

checkIntegrity().catch(console.error);
