import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';
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

async function approveRegistrations() {
  const regRef = collection(db, 'registrations');
  const regSnap = await getDocs(regRef);
  
  const pendingList = [];
  regSnap.forEach(d => {
    const data = d.data();
    if (data.status === 'pending') {
      pendingList.push({ id: d.id, data });
    }
  });

  const rawPhone = process.argv[2];
  if (!rawPhone) {
    console.log('\n================================================================');
    console.log('                 PENDING REGISTERED PROFILES                    ');
    console.log('================================================================');
    if (pendingList.length === 0) {
      console.log(' No pending registrations found. Everything is fully approved!');
      console.log('================================================================\n');
      return;
    }

    pendingList.forEach((item, index) => {
      const parent = item.data.parent1 || {};
      console.log(` ${index + 1}. Student: "${item.data.studentName}"`);
      console.log(`    Parent:  "${parent.name}" (${parent.relation})`);
      console.log(`    Phone:   "${parent.phone}"`);
      console.log(`    Class:   "${item.data.className}" [Branch: ${item.data.branch}]`);
      console.log(' --------------------------------------------------------------');
    });
    console.log('\nTo approve a registered profile, run this script with their phone number:');
    console.log('  node scripts/approve_registration.js <10_digit_phone_number>');
    console.log('\nExample:');
    console.log('  node scripts/approve_registration.js 9606664929');
    console.log('================================================================\n');
    return;
  }

  let cleanPhone = rawPhone.replace(/\D/g, '');
  if (cleanPhone.length === 12 && cleanPhone.startsWith('91')) {
    cleanPhone = cleanPhone.substring(2);
  }

  if (cleanPhone.length !== 10) {
    console.error(`Error: Invalid phone number length. Found ${cleanPhone.length} digits, expected 10.`);
    return;
  }

  const formattedPhone = `+91${cleanPhone}`;
  console.log(`\nProcessing approvals for phone: ${formattedPhone}...`);
  
  const approvals = [];
  pendingList.forEach(item => {
    const parentPhone = item.data.parent1?.phone || '';
    const cleanParentPhone = parentPhone.replace(/\D/g, '');
    
    // Match exact 10 digits
    const cleanParent10Digit = cleanParentPhone.length === 12 && cleanParentPhone.startsWith('91') 
      ? cleanParentPhone.substring(2) 
      : cleanParentPhone;

    if (cleanParent10Digit === cleanPhone) {
      approvals.push(item);
    }
  });

  if (approvals.length === 0) {
    console.log(`No pending registrations found for phone: ${formattedPhone}`);
    return;
  }

  console.log(`Found ${approvals.length} registration(s) to approve.`);
  const studentIds = [];

  // 1. Create student profiles and collect IDs
  for (const app of approvals) {
    const { data } = app;
    const studentId = `student_${data.studentName.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
    studentIds.push(studentId);

    const studentProfile = {
      name: data.studentName,
      dob: '2021-01-01', // Default DOB or fallback
      gender: 'Male',
      branchId: data.branch,
      className: data.className,
      enrollmentDate: new Date().toISOString().split('T')[0],
      status: 'active',
      parentUids: [], // Linked on login
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await setDoc(doc(db, 'students', studentId), studentProfile);
    console.log(`[+] Created student profile for: "${data.studentName}" (ID: ${studentId})`);

    // Update registration status to approved
    await updateDoc(doc(db, 'registrations', app.id), {
      status: 'approved',
      approvedAt: new Date().toISOString()
    });
    console.log(`[✓] Updated registration status for ${app.id} to "approved"`);
  }

  // 2. Create Parent User Profile
  const parent1 = approvals[0].data.parent1;
  const parentUserId = `parent_${cleanPhone}`;
  
  const parentProfile = {
    name: parent1.name || 'v prathap',
    role: 'parent',
    phone: formattedPhone,
    email: parent1.email || '',
    relation: parent1.relation || 'Mother',
    linkedStudentIds: studentIds,
    uid: null, // Will link on first login
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await setDoc(doc(db, 'users', parentUserId), parentProfile);
  console.log(`[+] Pre-whitelisted parent profile: "${parentProfile.name}" (${formattedPhone})`);

  console.log('\nApproval and pre-whitelisting completed successfully!');
}

approveRegistrations().catch(err => {
  console.error('Error approving registrations:', err);
  process.exit(1);
});
