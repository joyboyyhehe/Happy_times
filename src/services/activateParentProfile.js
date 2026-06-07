import { doc, getDoc, writeBatch, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { db } from '../config/firebase.js';

/**
 * Activates a parent profile on first login.
 * Finds the pre-created parent_phone document, creates a new document under the Auth UID,
 * archives the old document, and links the student records.
 */
export async function activateParentProfile(user) {
  if (!user || !user.phoneNumber) return null;

  // Clean phone number: strip +91 to get 10-digit number
  let cleanPhone = user.phoneNumber;
  if (cleanPhone.startsWith('+91')) {
    cleanPhone = cleanPhone.replace('+91', '').trim();
  } else if (cleanPhone.startsWith('+')) {
    // general fallback if country code is not +91
    cleanPhone = cleanPhone.slice(3).trim();
  }

  const preCreatedDocId = `parent_${cleanPhone}`;
  const preCreatedRef = doc(db, 'users', preCreatedDocId);

  try {
    const preCreatedSnap = await getDoc(preCreatedRef);
    if (!preCreatedSnap.exists()) {
      console.log(`[Activation] No pre-created parent profile found for ${preCreatedDocId}`);
      return null;
    }

    const oldData = preCreatedSnap.data();
    if (oldData.archived) {
      console.log(`[Activation] Pre-created profile ${preCreatedDocId} is already archived.`);
      return null;
    }

    console.log(`[Activation] Activating profile for phone ${cleanPhone} to UID ${user.uid}...`);

    const batch = writeBatch(db);

    // 1. Create new profile under the user's Auth UID
    const newUserRef = doc(db, 'users', user.uid);
    const newProfileData = {
      uid: user.uid,
      role: 'parent',
      name: oldData.name || 'Parent',
      phone: oldData.phone || user.phoneNumber,
      email: oldData.email || '',
      linkedStudentIds: oldData.linkedStudentIds || [],
      branchId: oldData.branchId || '',
      createdAt: oldData.createdAt || serverTimestamp(),
      activatedAt: serverTimestamp()
    };
    batch.set(newUserRef, newProfileData, { merge: true });

    // 2. Archive the old parent_phone document
    batch.update(preCreatedRef, {
      uid: user.uid, // must match authenticated user to satisfy rules update
      role: 'parent', // must match parent role to satisfy rules update
      archived: true,
      archivedAt: serverTimestamp(),
      migratedTo: user.uid
    });

    // 3. Update all linked students' parentUids list
    const linkedStudentIds = oldData.linkedStudentIds || [];
    for (const studentId of linkedStudentIds) {
      const studentRef = doc(db, 'students', studentId);
      batch.update(studentRef, {
        parentUids: arrayUnion(user.uid)
      });
    }

    await batch.commit();
    console.log(`[Activation] Profile successfully activated for UID ${user.uid}!`);
    
    return {
      id: user.uid,
      ...newProfileData
    };
  } catch (err) {
    console.error(`[Activation] Error activating parent profile:`, err);
    throw err;
  }
}
