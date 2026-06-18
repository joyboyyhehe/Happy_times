/**
 * Happy Times Preschool — Firestore Data Service
 * All data operations go through this module.
 * No backend API — pure Firestore SDK.
 */

import {
  collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, serverTimestamp, Timestamp, startAfter,
  arrayUnion, writeBatch,
} from 'firebase/firestore';
import {
  ref, uploadBytes, getDownloadURL, deleteObject,
} from 'firebase/storage';
import { db, storage, auth } from '../config/firebase.js';
import { logTelemetryEvent, logTelemetryError } from './telemetry.js';


// ─────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────
function uid() { return auth.currentUser?.uid; }

function trackWrite(promise) {
  if (typeof window !== 'undefined') {
    window.pendingWritesCount = (window.pendingWritesCount || 0) + 1;
    window.dispatchEvent(new CustomEvent('pendingWritesChanged', { detail: window.pendingWritesCount }));
    
    promise.finally(() => {
      window.pendingWritesCount = Math.max(0, (window.pendingWritesCount || 1) - 1);
      window.dispatchEvent(new CustomEvent('pendingWritesChanged', { detail: window.pendingWritesCount }));
    });
  }
  return promise;
}

function generateLogDetails(actionType, target) {
  switch (actionType) {
    case 'branch_upsert':
      return `Updated branch details for "${target.branchId}"`;
    case 'student_add':
      return `Added new student "${target.name || 'Unnamed'}"`;
    case 'student_update':
      return `Updated profile details for student (ID: ${target.studentId})`;
    case 'student_delete':
      return `Deleted student record (ID: ${target.studentId})`;
    case 'attendance_lock_set':
      return `Changed global attendance lock time limit to ${target.lockTime} via Settings Panel`;
    case 'fee_total_set':
      return `Updated total fee for student (ID: ${target.studentId}) to ₹${Number(target.total || 0).toLocaleString()}`;
    case 'fee_payment_added':
      return `Recorded payment of ₹${Number(target.amount || 0).toLocaleString()} via ${target.method || 'Cash'} for student (ID: ${target.studentId})`;
    case 'post_create':
      return `Published announcement "${target.title || 'Untitled'}"`;
    case 'post_update':
      return `Edited announcement "${target.title || 'Untitled'}" (ID: ${target.postId})`;
    case 'post_delete':
      return `Deleted announcement/post (ID: ${target.postId})`;
    case 'parent_linked':
      return `Linked parent (UID: ${target.parentUid}) to student (ID: ${target.studentId})`;
    case 'user_role_update':
      return `Updated role for user (ID: ${target.userId}) to ${target.role} for branch ${target.branchId || 'all'}`;
    default:
      return `${actionType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`;
  }
}

async function logAction(actionType, target = {}) {
  try {
    const user = auth.currentUser;
    if (!user) return;

    let actorName = user.displayName || 'Staff Member';
    let actorRole = 'staff';
    let branchId = target.branchId || null;

    try {
      const profileSnap = await getDoc(doc(db, 'users', user.uid));
      if (profileSnap.exists()) {
        const p = profileSnap.data();
        actorName = p.name || actorName;
        actorRole = p.role || actorRole;
        if (!branchId) branchId = p.branchId || null;
      }
    } catch (e) {
      console.warn('Failed to fetch user profile for log:', e);
    }

    const details = generateLogDetails(actionType, target);
    
    // Derive targetType and targetId
    let targetType = 'system';
    let targetId = 'global';
    if (actionType.startsWith('student_')) {
      targetType = 'student';
      targetId = target.studentId || 'unknown';
    } else if (actionType.startsWith('fee_')) {
      targetType = 'fee';
      targetId = target.studentId || 'unknown';
    } else if (actionType.startsWith('post_')) {
      targetType = 'post';
      targetId = target.postId || 'unknown';
    } else if (actionType.startsWith('attendance_')) {
      targetType = 'attendance';
      targetId = target.date || 'unknown';
    } else if (actionType.startsWith('branch_')) {
      targetType = 'branch';
      targetId = target.branchId || 'unknown';
    } else if (actionType.startsWith('user_') || actionType.startsWith('parent_')) {
      targetType = 'users';
      targetId = target.userId || target.parentUid || 'unknown';
    }

    await addDoc(collection(db, 'logs'), {
      actorUid: user.uid,
      actorEmail: user.email || null,
      actorName,
      actorRole,
      action: actionType, // keep old field compatible
      actionType,         // keep new field compatible
      target,
      details,            // human-readable logs details
      branchId,
      targetId,
      targetType,
      timestamp: serverTimestamp(),
    });
  } catch (e) {
    console.warn('Log write failed:', e);
  }
}

// ─────────────────────────────────────────────────
// AUTH / USER PROFILE
// ─────────────────────────────────────────────────
export function normalizeRole(role) {
  if (role === 'teacher') return 'branchadmin';
  if (role === 'staff') return 'branchadmin';
  return role;
}

export async function getUserProfile(userId) {
  const snap = await getDoc(doc(db, 'users', userId));
  if (!snap.exists()) return null;
  const data = snap.data();
  return { id: snap.id, ...data, role: normalizeRole(data.role) };
}

export async function createOrUpdateUser(userId, data) {
  await setDoc(doc(db, 'users', userId), data, { merge: true });
}

export async function checkStaffWhitelist(email) {
  // 1. First check staff_whitelist collection
  try {
    const snap = await getDoc(doc(db, 'staff_whitelist', email.toLowerCase()));
    if (snap.exists()) {
      const data = snap.data();
      return { ...data, role: normalizeRole(data.role) };
    }
  } catch (err) {
    console.warn('checkStaffWhitelist: staff_whitelist check failed:', err);
  }

  // 2. Fallback check: query the users collection for a matching email
  try {
    const q = query(
      collection(db, 'users'),
      where('email', '==', email.toLowerCase())
    );
    const querySnap = await getDocs(q);
    
    // Find the first user document that has a staff/admin/teacher role
    for (const docSnap of querySnap.docs) {
      const userData = docSnap.data();
      const role = normalizeRole(userData.role);
      if (
        role === 'superadmin' || 
        role === 'branchadmin'
      ) {
        return {
          email: userData.email,
          role: role,
          branchId: userData.branchId || null
        };
      }
    }
  } catch (err) {
    console.warn('checkStaffWhitelist: users fallback check failed:', err);
  }

  return null;
}

export async function getStaffWhitelist() {
  const snap = await getDocs(collection(db, 'staff_whitelist'));
  return snap.docs.map(d => ({ email: d.id, ...d.data() }));
}

export async function addToStaffWhitelist(email, role, branchId = null) {
  const allowedRoles = ['superadmin', 'branchadmin'];
  if (!allowedRoles.includes(role)) {
    throw new Error(`Role ${role} is not permitted. Only 'branchadmin' and 'superadmin' are allowed.`);
  }
  // Security: branchadmin MUST have a branchId assigned
  if (role === 'branchadmin' && !branchId) {
    throw new Error('Branch selection is required when creating a Branch Admin account.');
  }
  const emailLower = email.toLowerCase().trim();
  const promise = setDoc(doc(db, 'staff_whitelist', emailLower), {
    email: emailLower,
    role,
    branchId,
    createdAt: serverTimestamp()
  });
  await trackWrite(promise);
  await logAction('user_role_update', { userId: emailLower, role, branchId });
}

export async function removeFromStaffWhitelist(email) {
  const emailLower = email.toLowerCase().trim();
  const promise = deleteDoc(doc(db, 'staff_whitelist', emailLower));
  await trackWrite(promise);
  await logAction('user_role_update', { userId: emailLower, role: 'none', branchId: null });
}

// ─────────────────────────────────────────────────
// BRANCHES
// ─────────────────────────────────────────────────
export async function getBranches() {
  try {
    const cached = localStorage.getItem('ht_cache_branches');
    if (cached) {
      const parsed = JSON.parse(cached);
      // Background revalidation
      getDocs(collection(db, 'branches')).then(snap => {
        const fresh = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        localStorage.setItem('ht_cache_branches', JSON.stringify(fresh));
      }).catch(console.warn);
      return parsed;
    }
  } catch (err) {
    console.warn('Branches cache read failed:', err);
  }

  const snap = await getDocs(collection(db, 'branches'));
  const fresh = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  try {
    localStorage.setItem('ht_cache_branches', JSON.stringify(fresh));
  } catch (err) {
    console.warn('Branches cache write failed:', err);
  }
  return fresh;
}

export async function getBranch(branchId) {
  const snap = await getDoc(doc(db, 'branches', branchId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function upsertBranch(branchId, data) {
  await setDoc(doc(db, 'branches', branchId), data, { merge: true });
  await logAction('branch_upsert', { branchId });
}

// ─────────────────────────────────────────────────
export async function getStudents(branchId = null, classId = null) {
  let q = collection(db, 'students');
  const constraints = [where('active', '==', true)];
  if (branchId) constraints.push(where('branchId', '==', branchId));
  if (classId) constraints.push(where('classId', '==', classId));
  const snap = await getDocs(query(q, ...constraints));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getStudent(studentId) {
  const snap = await getDoc(doc(db, 'students', studentId));
  if (!snap.exists()) return null;
  const data = snap.data();
  return data.active !== true ? null : { id: snap.id, ...data };
}

export async function getStudentsForParent(parentUid) {
  const q = query(
    collection(db, 'students'),
    where('parentUids', 'array-contains', parentUid),
    where('active', '==', true)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Ensures a parent pre-registration document exists at users/parent_{phone}.
 * This doc is what activateParentProfile looks for on the parent's first login.
 * Safe to call multiple times — uses merge:true and never overwrites uid/activated docs.
 */
async function ensureParentPreRegistration(phone, studentId, data = {}) {
  if (!phone) return;
  // Normalize: strip +91 or any prefix to get a 10-digit number
  let clean = String(phone).replace(/\D/g, '');
  if (clean.length > 10) clean = clean.slice(-10);
  if (!clean || clean.length < 10) return;

  const docId = `parent_${clean}`;
  const ref = doc(db, 'users', docId);
  const snap = await getDoc(ref);

  if (snap.exists() && snap.data().archived) {
    // Already activated — do not overwrite. Just ensure this student is linked.
    return;
  }

  const existing = snap.exists() ? snap.data() : {};
  const linkedStudentIds = Array.from(new Set([...(existing.linkedStudentIds || []), studentId]));

  await setDoc(ref, {
    role: 'parent',
    phone: clean,
    name: data.name || existing.name || 'Parent',
    email: existing.email || '',
    branchId: data.branchId || existing.branchId || '',
    linkedStudentIds,
    archived: false,
    createdAt: existing.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function addStudent(data) {
  const ref = await addDoc(collection(db, 'students'), {
    ...data,
    active: true,
    archived: false,
    className: data.classId || '', // Cloud Functions compatibility
    createdAt: serverTimestamp(),
    feeTotal: data.feeTotal || 0,
    feePaid: 0,
    parentUids: data.parentUids || [],
  });

  // Auto-create parent pre-registration docs so parents can log in via OTP
  if (data.phone1) {
    await ensureParentPreRegistration(data.phone1, ref.id, { branchId: data.branchId, name: data.guardianName || data.name });
  }
  if (data.phone2) {
    await ensureParentPreRegistration(data.phone2, ref.id, { branchId: data.branchId, name: data.guardianName || data.name });
  }

  await logAction('student_add', { studentId: ref.id, name: data.name });
  return ref.id;
}

export async function updateStudent(studentId, data) {
  const updateData = { ...data, updatedAt: serverTimestamp() };
  if (data.classId !== undefined) {
    updateData.className = data.classId; // Cloud Functions compatibility
  }
  await updateDoc(doc(db, 'students', studentId), updateData);

  // Keep parent pre-registration docs in sync when phone numbers change
  if (data.phone1) {
    await ensureParentPreRegistration(data.phone1, studentId, { branchId: data.branchId });
  }
  if (data.phone2) {
    await ensureParentPreRegistration(data.phone2, studentId, { branchId: data.branchId });
  }

  await logAction('student_update', { studentId });
}

export async function deleteStudent(studentId) {
  await updateDoc(doc(db, 'students', studentId), {
    active: false,
    archived: true,
    updatedAt: serverTimestamp()
  });
  await logAction('student_delete', { studentId });
}


// ─────────────────────────────────────────────────
// ATTENDANCE
// ─────────────────────────────────────────────────
// Path: attendance/{branchId}_{classId}_{date}/{studentId}
function attendanceDocPath(branchId, classId, date, studentId) {
  return `attendance/${branchId}_${classId}_${date}/records/${studentId}`;
}

export async function getAttendance(branchId, classId, date) {
  // date: 'YYYY-MM-DD'
  const colRef = collection(db, 'attendance', `${branchId}_${classId}_${date}`, 'records');
  const snap = await getDocs(colRef);
  const result = {};
  snap.docs.forEach(d => { result[d.id] = d.data(); });
  return result;
}

export async function setAttendanceRecord(branchId, classId, date, studentId, status) {
  try {
    const path = doc(db, 'attendance', `${branchId}_${classId}_${date}`, 'records', studentId);
    await trackWrite(setDoc(path, {
      status,
      markedBy: uid(),
      timestamp: serverTimestamp(),
    }, { merge: true }));

    // Set trigger document for Cloud Function (attendance/{attendanceId})
    const triggerPath = doc(db, 'attendance', `${studentId}_${date}`);
    await trackWrite(setDoc(triggerPath, {
      studentId,
      status,
      date,
      branchId,
      classId,
      markedBy: uid(),
      timestamp: serverTimestamp(),
    }, { merge: true }));

    // Optimize: Sync to monthly attendance summary
    const [yearStr, monthStr] = date.split('-');
    const summaryPath = doc(db, 'attendance_summary', `${studentId}_${yearStr}_${monthStr}`);
    try {
      await trackWrite(updateDoc(summaryPath, {
        [`records.${date}`]: status,
        updatedAt: serverTimestamp(),
        studentId: studentId,
      }));
    } catch (err) {
      // Fallback if document doesn't exist yet
      await trackWrite(setDoc(summaryPath, {
        studentId: studentId,
        records: {
          [date]: status,
        },
        updatedAt: serverTimestamp(),
      }, { merge: true }));
    }

    logTelemetryEvent('attendance_marked', { branchId, classId, date, status });
  } catch (err) {
    logTelemetryEvent('attendance_sync_failed', { branchId, classId, date, studentId });
    logTelemetryError(err, {
      category: 'attendance_write',
      isCritical: true,
      additionalMetadata: { branchId, classId, date, studentId, status }
    });
    throw err;
  }
}

/**
 * Batch-save multiple attendance records in a single Firestore commit.
 * @param {string} branchId
 * @param {string} classId
 * @param {string} date - 'YYYY-MM-DD'
 * @param {Object} records - { [studentId]: 'present' | 'absent' | 'late' }
 */
export async function batchSaveAttendance(branchId, classId, date, records) {
  const batch = writeBatch(db);
  const markedBy = uid();
  const entries = Object.entries(records);

  for (const [studentId, status] of entries) {
    // Main attendance record path
    const recordPath = doc(db, 'attendance', `${branchId}_${classId}_${date}`, 'records', studentId);
    batch.set(recordPath, { status, markedBy, timestamp: serverTimestamp() }, { merge: true });

    // Trigger document for Cloud Function compatibility
    const triggerPath = doc(db, 'attendance', `${studentId}_${date}`);
    batch.set(triggerPath, { studentId, status, date, branchId, classId, markedBy, timestamp: serverTimestamp() }, { merge: true });
  }

  try {
    await batch.commit();
    logTelemetryEvent('attendance_batch_saved', { branchId, classId, date, count: entries.length });

    // Update monthly summary docs (non-batch, fire-and-forget)
    for (const [studentId, status] of entries) {
      const [yearStr, monthStr] = date.split('-');
      const summaryPath = doc(db, 'attendance_summary', `${studentId}_${yearStr}_${monthStr}`);
      setDoc(summaryPath, { studentId, records: { [date]: status }, updatedAt: serverTimestamp() }, { merge: true })
        .catch(err => console.warn('Summary update failed:', err));
    }
  } catch (err) {
    logTelemetryError(err, { category: 'attendance_write', isCritical: true, additionalMetadata: { branchId, classId, date } });
    throw err;
  }
}

export async function getStudentAttendanceMonth(studentId, branchId, classId, year, month) {
  if (!studentId || !branchId || !classId) {
    return {};
  }
  // Returns map { 'YYYY-MM-DD': status }
  const yearStr = String(year);
  const monthStr = String(month).padStart(2, '0');
  const summaryPath = doc(db, 'attendance_summary', `${studentId}_${yearStr}_${monthStr}`);
  
  try {
    const summarySnap = await getDoc(summaryPath);
    if (summarySnap.exists()) {
      return summarySnap.data().records || {};
    }
  } catch (err) {
    console.warn('Failed to fetch attendance summary, falling back to daily scans:', err);
  }

  // Fallback: Multi-read daily documents for backward compatibility
  const result = {};
  const daysInMonth = new Date(year, month, 0).getDate();
  const fetches = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    fetches.push(
      getDoc(doc(db, 'attendance', `${branchId}_${classId}_${date}`, 'records', studentId))
        .then(snap => { if (snap.exists()) result[date] = snap.data().status; })
    );
  }
  await Promise.all(fetches);

  // Proactively save back to summary collection for future O(1) retrieval
  if (Object.keys(result).length > 0) {
    try {
      await setDoc(summaryPath, {
        studentId: studentId,
        records: result,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (err) {
      console.error('Failed to cache attendance summary:', err);
    }
  }

  return result;
}

// ─────────────────────────────────────────────────
// ATTENDANCE LOCK SETTINGS
// ─────────────────────────────────────────────────
export async function getAttendanceLockTime() {
  try {
    const cached = localStorage.getItem('ht_cache_lock_time');
    if (cached) {
      // Background revalidation
      getDoc(doc(db, 'settings', 'attendance_lock')).then(snap => {
        if (snap.exists()) {
          localStorage.setItem('ht_cache_lock_time', snap.data().lockTime);
        }
      }).catch(console.warn);
      return cached;
    }
  } catch (err) {
    console.warn('Attendance lock time cache read failed:', err);
  }

  const snap = await getDoc(doc(db, 'settings', 'attendance_lock'));
  const val = snap.exists() ? snap.data().lockTime : '10:00';
  try {
    localStorage.setItem('ht_cache_lock_time', val);
  } catch (err) {
    console.warn('Attendance lock time cache write failed:', err);
  }
  return val;
}

export async function setAttendanceLockTime(lockTime) {
  await setDoc(doc(db, 'settings', 'attendance_lock'), { lockTime });
  try {
    localStorage.setItem('ht_cache_lock_time', lockTime);
  } catch (err) {
    console.warn('Attendance lock time cache write failed:', err);
  }
  await logAction('attendance_lock_set', { lockTime });
}

export function isAttendanceLocked(lockTime) {
  if (!lockTime) return false;
  const [h, m] = lockTime.split(':').map(Number);
  const now = new Date();
  const lock = new Date();
  lock.setHours(h, m, 0, 0);
  return now >= lock;
}

// ─────────────────────────────────────────────────
// FEES
// ─────────────────────────────────────────────────
export async function getFeeRecord(studentId) {
  const snap = await getDoc(doc(db, 'students', studentId));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    total: data.feeTotal || 0,
    paid: data.feePaid || 0,
    pending: (data.feeTotal || 0) - (data.feePaid || 0),
    dueDate: data.feeDueDate || null,
  };
}

export async function setFeeTotal(studentId, total, dueDate = null) {
  try {
    const update = { feeTotal: total };
    if (dueDate) update.feeDueDate = dueDate;
    await trackWrite(updateDoc(doc(db, 'students', studentId), update));

    // Update mirror document for Cloud Function (fees/{studentId})
    await trackWrite(setDoc(doc(db, 'fees', studentId), {
      studentId,
      totalFee: total,
      updatedAt: serverTimestamp(),
    }, { merge: true }));

    await logAction('fee_total_set', { studentId, total });
    logTelemetryEvent('fee_added', { studentId, total });
  } catch (err) {
    logTelemetryError(err, {
      category: 'payment_write',
      isCritical: true,
      additionalMetadata: { studentId, total, dueDate }
    });
    throw err;
  }
}

export async function addPayment(studentId, { amount, method, notes = '' }) {
  try {
    // Add payment doc
    const payRef = await trackWrite(addDoc(collection(db, 'fees', studentId, 'payments'), {
      amount: Number(amount),
      method,
      notes,
      date: serverTimestamp(),
      recordedBy: uid(),
    }));
    // Update feePaid on student doc
    const studentSnap = await getDoc(doc(db, 'students', studentId));
    if (studentSnap.exists()) {
      const current = studentSnap.data().feePaid || 0;
      await trackWrite(updateDoc(doc(db, 'students', studentId), { feePaid: current + Number(amount) }));
    }

    // Update mirror document payments array for Cloud Function (fees/{studentId})
    const paymentObj = {
      amount: Number(amount),
      method,
      notes,
      date: new Date(), // client date for raw array compatibility
      recordedBy: uid(),
    };
    await trackWrite(setDoc(doc(db, 'fees', studentId), {
      payments: arrayUnion(paymentObj),
      updatedAt: serverTimestamp(),
    }, { merge: true }));

    await logAction('fee_payment_added', { studentId, amount, method });
    logTelemetryEvent('payment_recorded', { studentId, amount, method });
    return payRef.id;
  } catch (err) {
    logTelemetryError(err, {
      category: 'payment_write',
      isCritical: true,
      additionalMetadata: { studentId, amount, method }
    });
    throw err;
  }
}

export async function getPaymentHistory(studentId) {
  const q = query(collection(db, 'fees', studentId, 'payments'), orderBy('date', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ─────────────────────────────────────────────────
// POSTS
// ─────────────────────────────────────────────────
export async function getPosts({ branchId = null, classId = null, limitCount = 10, lastVisible = null } = {}) {
  const constraints = [orderBy('timestamp', 'desc'), limit(limitCount)];
  if (classId) {
    constraints.unshift(where('classId', '==', classId));
  } else if (branchId) {
    constraints.unshift(where('branchId', '==', branchId));
  }
  if (lastVisible) {
    constraints.push(startAfter(lastVisible));
  }
  const snap = await getDocs(query(collection(db, 'posts'), ...constraints));
  const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const lastDoc = snap.docs[snap.docs.length - 1] || null;
  return { items, lastDoc };
}

export async function getPostsForParent(branchId, classId) {
  // Parent sees: class posts + branch posts + all-branch posts
  const queries = [];
  
  if (classId) {
    queries.push(
      getDocs(query(collection(db, 'posts'), where('scope', '==', 'class'), where('classId', '==', classId), orderBy('timestamp', 'desc'), limit(30)))
        .catch(err => {
          console.warn('[firestore] Failed to query class posts:', err);
          return { docs: [] };
        })
    );
  } else {
    queries.push(Promise.resolve({ docs: [] }));
  }
  
  if (branchId) {
    queries.push(
      getDocs(query(collection(db, 'posts'), where('scope', '==', 'branch'), where('branchId', '==', branchId), orderBy('timestamp', 'desc'), limit(30)))
        .catch(err => {
          console.warn('[firestore] Failed to query branch posts:', err);
          return { docs: [] };
        })
    );
  } else {
    queries.push(Promise.resolve({ docs: [] }));
  }
  
  queries.push(
    getDocs(query(collection(db, 'posts'), where('scope', 'in', ['all', 'all_branches']), orderBy('timestamp', 'desc'), limit(20)))
      .catch(err => {
        console.warn('[firestore] Failed to query global posts:', err);
        return { docs: [] };
      })
  );

  const [classPosts, branchPosts, allPosts] = await Promise.all(queries);
  const seen = new Set();
  const merged = [];
  [...classPosts.docs, ...branchPosts.docs, ...allPosts.docs].forEach(d => {
    if (!seen.has(d.id)) {
      seen.add(d.id);
      const data = d.data();
      let normalizedScope = 'global';
      if (data.scope === 'branch') normalizedScope = 'branch';
      else if (data.scope === 'class') normalizedScope = 'class';
      merged.push({ id: d.id, ...data, scope: normalizedScope });
    }
  });
  return merged.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
}

export async function createPost(data) {
  const imageUrls = [];
  if (data.images?.length) {
    for (const file of data.images) {
      const storageRef = ref(storage, `posts/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      imageUrls.push(url);
    }
  }
  // Normalise scope: 'all_branches' → 'all' for backward compat with parent queries
  const scope = data.scope === 'all_branches' ? 'all' : (data.scope || 'branch');
  const postRef = await addDoc(collection(db, 'posts'), {
    title: data.title,
    body: data.body,
    category: data.category || 'General',
    scope,
    branchId: data.branchId || null,
    classId: data.classId || null,
    className: data.classId || null, // Cloud Functions compatibility
    imageUrls,
    authorUid: uid(),
    authorName: auth.currentUser?.displayName || 'Admin',
    timestamp: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: null,
    edited: false,
    // New metadata fields
    pushNotification: data.pushNotification !== false,  // default true
    status: data.status || 'published',
    scheduledFor: data.scheduledFor || null,
  });
  await logAction('post_create', { postId: postRef.id, title: data.title });
  return postRef.id;
}

export async function updatePost(postId, data) {
  // Upload any new File objects; keep existing URL strings as-is
  const imageUrls = [];
  const existingUrls = data.existingImageUrls || [];
  imageUrls.push(...existingUrls);
  if (data.images?.length) {
    for (const file of data.images) {
      if (file instanceof File) {
        const storageRef = ref(storage, `posts/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        imageUrls.push(url);
      }
    }
  }
  const scope = data.scope === 'all_branches' ? 'all' : (data.scope || 'branch');
  await updateDoc(doc(db, 'posts', postId), {
    title: data.title,
    body: data.body,
    category: data.category || 'General',
    scope,
    branchId: data.branchId || null,
    classId: data.classId || null,
    className: data.classId || null,
    imageUrls,
    edited: true,
    updatedAt: serverTimestamp(),
  });
  await logAction('post_update', { postId, title: data.title });
}

export async function deletePost(postId) {
  await deleteDoc(doc(db, 'posts', postId));
  await logAction('post_delete', { postId });
}

// ─────────────────────────────────────────────────
// ACTIVITY LOGS (write-once, never deleted)
// ─────────────────────────────────────────────────
export async function getLogs({ branchId = null, actorUid = null, limitCount = 25, lastVisible = null } = {}) {
  const constraints = [orderBy('timestamp', 'desc'), limit(limitCount)];
  if (actorUid) constraints.unshift(where('actorUid', '==', actorUid));
  if (branchId) constraints.unshift(where('target.branchId', '==', branchId));
  if (lastVisible) {
    constraints.push(startAfter(lastVisible));
  }
  const snap = await getDocs(query(collection(db, 'logs'), ...constraints));
  const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const lastDoc = snap.docs[snap.docs.length - 1] || null;
  return { items, lastDoc };
}

// ─────────────────────────────────────────────────
// PARENT MANAGEMENT
// ─────────────────────────────────────────────────
export async function linkParentToStudent(studentId, parentUid, relation = 'parent') {
  const studentSnap = await getDoc(doc(db, 'students', studentId));
  if (!studentSnap.exists()) throw new Error('Student not found');
  const existing = studentSnap.data().parentUids || [];
  if (!existing.includes(parentUid)) {
    await updateDoc(doc(db, 'students', studentId), {
      parentUids: [...existing, parentUid],
    });
  }
  await logAction('parent_linked', { studentId, parentUid, relation });
}

// ─────────────────────────────────────────────────
// BRANCH ADMIN MANAGEMENT
// ─────────────────────────────────────────────────
export async function getBranchAdmins() {
  const q = query(collection(db, 'users'), where('role', '==', 'branchadmin'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function updateUserRole(userId, role, branchId = null) {
  const update = { role };
  if (branchId) update.branchId = branchId;
  await updateDoc(doc(db, 'users', userId), update);
  await logAction('user_role_update', { userId, role, branchId });
}

// ─────────────────────────────────────────────────
// DASHBOARD STATS
// ─────────────────────────────────────────────────
export async function getDashboardStats(branchId = null) {
  const studentQuery = branchId
    ? query(collection(db, 'students'), where('branchId', '==', branchId))
    : collection(db, 'students');
  const snap = await getDocs(studentQuery);
  const students = snap.docs.map(d => d.data());

  const totalStudents = students.length;
  const totalFeeTotal = students.reduce((s, st) => s + (st.feeTotal || 0), 0);
  const totalFeePaid = students.reduce((s, st) => s + (st.feePaid || 0), 0);
  const totalPending = totalFeeTotal - totalFeePaid;

  return { totalStudents, totalFeeTotal, totalFeePaid, totalPending };
}

// ─────────────────────────────────────────────────
// LEAVE REQUESTS (NEW — leaves collection)
// ─────────────────────────────────────────────────

/**
 * Parent: submit a new leave request.
 * Creates a document in the `leaves` collection with status='pending'.
 */
export async function createLeave({ studentId, studentName, parentUid, parentName, branchId, classId, fromDate, toDate, reason }) {
  const leaveRef = await trackWrite(addDoc(collection(db, 'leaves'), {
    studentId,
    studentName: studentName || '',
    parentUid,
    parentName: parentName || '',
    branchId: branchId || '',
    classId: classId || '',
    fromDate,
    toDate,
    reason: reason || '',
    status: 'pending',
    createdAt: serverTimestamp(),
    reviewedAt: null,
    reviewerUid: null,
    reviewerName: null,
  }));
  await logAction('leave_created', { studentId, parentUid, fromDate, toDate });
  logTelemetryEvent('leave_submitted', { studentId, branchId });
  return leaveRef.id;
}

/**
 * Parent: fetch own leave requests (by parentUid).
 * Ordered by creation date, newest first.
 */
export async function getMyLeaves(parentUid) {
  const q = query(
    collection(db, 'leaves'),
    where('parentUid', '==', parentUid),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Branch Admin: fetch leaves for a specific branch.
 * Optionally filter by status ('pending', 'approved', 'rejected').
 */
export async function getBranchLeaves(branchId, filterStatus = null) {
  const constraints = [where('branchId', '==', branchId), orderBy('createdAt', 'desc'), limit(50)];
  if (filterStatus) {
    constraints.splice(1, 0, where('status', '==', filterStatus));
  }
  const snap = await getDocs(query(collection(db, 'leaves'), ...constraints));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Branch Admin / Super Admin: approve or reject a leave request.
 */
export async function updateLeaveStatus(leaveId, { status, reviewerUid, reviewerName }) {
  await trackWrite(updateDoc(doc(db, 'leaves', leaveId), {
    status,
    reviewerUid: reviewerUid || uid(),
    reviewerName: reviewerName || 'Admin',
    reviewedAt: serverTimestamp(),
  }));
  await logAction('leave_reviewed', { leaveId, status, reviewerName });
  logTelemetryEvent('leave_status_updated', { leaveId, status });
}

/**
 * Super Admin: fetch all leaves across branches.
 * Optionally filter by status.
 */
export async function getAllLeaves(filterStatus = null) {
  const constraints = [orderBy('createdAt', 'desc'), limit(50)];
  if (filterStatus) {
    constraints.unshift(where('status', '==', filterStatus));
  }
  const snap = await getDocs(query(collection(db, 'leaves'), ...constraints));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
