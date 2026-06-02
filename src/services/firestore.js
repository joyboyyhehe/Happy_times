/**
 * Happy Times Preschool — Firestore Data Service
 * All data operations go through this module.
 * No backend API — pure Firestore SDK.
 */

import {
  collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import {
  ref, uploadBytes, getDownloadURL, deleteObject,
} from 'firebase/storage';
import { db, storage, auth } from '../config/firebase.js';

// ─────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────
function uid() { return auth.currentUser?.uid; }

async function logAction(actionType, target = {}) {
  try {
    const user = auth.currentUser;
    if (!user) return;
    await addDoc(collection(db, 'logs'), {
      actorUid: user.uid,
      actorEmail: user.email || null,
      actionType,
      target,
      timestamp: serverTimestamp(),
    });
  } catch (e) {
    console.warn('Log write failed:', e);
  }
}

// ─────────────────────────────────────────────────
// AUTH / USER PROFILE
// ─────────────────────────────────────────────────
export async function getUserProfile(userId) {
  const snap = await getDoc(doc(db, 'users', userId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function createOrUpdateUser(userId, data) {
  await setDoc(doc(db, 'users', userId), data, { merge: true });
}

export async function checkStaffWhitelist(email) {
  const snap = await getDoc(doc(db, 'staff_whitelist', email.toLowerCase()));
  return snap.exists() ? snap.data() : null;
}

// ─────────────────────────────────────────────────
// BRANCHES
// ─────────────────────────────────────────────────
export async function getBranches() {
  const snap = await getDocs(collection(db, 'branches'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
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
// STUDENTS
// ─────────────────────────────────────────────────
export async function getStudents(branchId = null, classId = null) {
  let q = collection(db, 'students');
  const constraints = [];
  if (branchId) constraints.push(where('branchId', '==', branchId));
  if (classId) constraints.push(where('classId', '==', classId));
  const snap = await getDocs(constraints.length ? query(q, ...constraints) : q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getStudent(studentId) {
  const snap = await getDoc(doc(db, 'students', studentId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getStudentsForParent(parentUid) {
  const q = query(collection(db, 'students'), where('parentUids', 'array-contains', parentUid));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addStudent(data) {
  const ref = await addDoc(collection(db, 'students'), {
    ...data,
    createdAt: serverTimestamp(),
    feeTotal: data.feeTotal || 0,
    feePaid: 0,
    parentUids: data.parentUids || [],
  });
  await logAction('student_add', { studentId: ref.id, name: data.name });
  return ref.id;
}

export async function updateStudent(studentId, data) {
  await updateDoc(doc(db, 'students', studentId), { ...data, updatedAt: serverTimestamp() });
  await logAction('student_update', { studentId });
}

export async function deleteStudent(studentId) {
  await deleteDoc(doc(db, 'students', studentId));
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
  const path = doc(db, 'attendance', `${branchId}_${classId}_${date}`, 'records', studentId);
  await setDoc(path, {
    status,
    markedBy: uid(),
    timestamp: serverTimestamp(),
  }, { merge: true });

  // Optimize: Sync to monthly attendance summary
  const [yearStr, monthStr] = date.split('-');
  const summaryPath = doc(db, 'attendance_summary', `${studentId}_${yearStr}_${monthStr}`);
  try {
    await updateDoc(summaryPath, {
      [`records.${date}`]: status,
      updatedAt: serverTimestamp(),
      studentId: studentId,
    });
  } catch (err) {
    // Fallback if document doesn't exist yet
    await setDoc(summaryPath, {
      studentId: studentId,
      records: {
        [date]: status,
      },
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }
}

export async function getStudentAttendanceMonth(studentId, branchId, classId, year, month) {
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
  const snap = await getDoc(doc(db, 'settings', 'attendance_lock'));
  return snap.exists() ? snap.data().lockTime : '10:00';
}

export async function setAttendanceLockTime(lockTime) {
  await setDoc(doc(db, 'settings', 'attendance_lock'), { lockTime });
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
  const update = { feeTotal: total };
  if (dueDate) update.feeDueDate = dueDate;
  await updateDoc(doc(db, 'students', studentId), update);
  await logAction('fee_total_set', { studentId, total });
}

export async function addPayment(studentId, { amount, method, notes = '' }) {
  // Add payment doc
  const payRef = await addDoc(collection(db, 'fees', studentId, 'payments'), {
    amount: Number(amount),
    method,
    notes,
    date: serverTimestamp(),
    recordedBy: uid(),
  });
  // Update feePaid on student doc
  const studentSnap = await getDoc(doc(db, 'students', studentId));
  if (studentSnap.exists()) {
    const current = studentSnap.data().feePaid || 0;
    await updateDoc(doc(db, 'students', studentId), { feePaid: current + Number(amount) });
  }
  await logAction('fee_payment_added', { studentId, amount, method });
  return payRef.id;
}

export async function getPaymentHistory(studentId) {
  const q = query(collection(db, 'fees', studentId, 'payments'), orderBy('date', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ─────────────────────────────────────────────────
// POSTS
// ─────────────────────────────────────────────────
export async function getPosts({ branchId = null, classId = null, limitCount = 50 } = {}) {
  const constraints = [orderBy('timestamp', 'desc'), limit(limitCount)];
  if (classId) {
    constraints.unshift(where('classId', '==', classId));
  } else if (branchId) {
    constraints.unshift(where('branchId', '==', branchId));
  }
  const snap = await getDocs(query(collection(db, 'posts'), ...constraints));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getPostsForParent(branchId, classId) {
  // Parent sees: class posts + branch posts + all-branch posts
  const [classPosts, branchPosts, allPosts] = await Promise.all([
    getDocs(query(collection(db, 'posts'), where('scope', '==', 'class'), where('classId', '==', classId), orderBy('timestamp', 'desc'), limit(30))),
    getDocs(query(collection(db, 'posts'), where('scope', '==', 'branch'), where('branchId', '==', branchId), orderBy('timestamp', 'desc'), limit(30))),
    getDocs(query(collection(db, 'posts'), where('scope', '==', 'all'), orderBy('timestamp', 'desc'), limit(20))),
  ]);
  const seen = new Set();
  const merged = [];
  [...classPosts.docs, ...branchPosts.docs, ...allPosts.docs].forEach(d => {
    if (!seen.has(d.id)) { seen.add(d.id); merged.push({ id: d.id, ...d.data() }); }
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
  const postRef = await addDoc(collection(db, 'posts'), {
    title: data.title,
    body: data.body,
    category: data.category || 'General',
    scope: data.scope || 'branch',
    branchId: data.branchId || null,
    classId: data.classId || null,
    imageUrls,
    authorUid: uid(),
    authorName: auth.currentUser?.displayName || 'Admin',
    timestamp: serverTimestamp(),
  });
  await logAction('post_create', { postId: postRef.id, title: data.title });
  return postRef.id;
}

export async function deletePost(postId) {
  await deleteDoc(doc(db, 'posts', postId));
  await logAction('post_delete', { postId });
}

// ─────────────────────────────────────────────────
// ACTIVITY LOGS (write-once, never deleted)
// ─────────────────────────────────────────────────
export async function getLogs({ branchId = null, actorUid = null, limitCount = 100 } = {}) {
  const constraints = [orderBy('timestamp', 'desc'), limit(limitCount)];
  if (actorUid) constraints.unshift(where('actorUid', '==', actorUid));
  if (branchId) constraints.unshift(where('target.branchId', '==', branchId));
  const snap = await getDocs(query(collection(db, 'logs'), ...constraints));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
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
