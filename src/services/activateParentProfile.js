import { doc, getDoc, setDoc, writeBatch, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { db } from '../config/firebase.js';

/**
 * Activates a parent profile on first login.
 *
 * Flow:
 *  1. Looks for pre-created `users/parent_<phone>` document.
 *  2. If found and NOT archived → runs full activation batch (create uid doc, archive phone doc, link students).
 *  3. If found and ALREADY archived:
 *     a. If `migratedTo` matches current UID → the uid-doc may still be missing (write failure);
 *        re-create it from archived data without touching the phone doc.
 *     b. If `migratedTo` is a DIFFERENT UID (phone re-registered) → re-activate for the new UID.
 *  4. If phone doc doesn't exist → returns null (admin needs to create the record).
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

    // ── ALREADY ARCHIVED ──────────────────────────────────────────────────────
    if (oldData.archived) {
      const migratedTo = oldData.migratedTo;

      if (migratedTo === user.uid) {
        // Same UID — the uid-doc may have been lost; try to re-create it.
        console.log(`[Activation] Profile for ${preCreatedDocId} is archived to same UID. Re-creating uid-doc...`);
        const uidRef = doc(db, 'users', user.uid);
        const uidSnap = await getDoc(uidRef);

        if (uidSnap.exists()) {
          // Document already exists — just return it.
          console.log(`[Activation] uid-doc already exists for ${user.uid}. Returning existing profile.`);
          return { id: user.uid, ...uidSnap.data() };
        }

        // Re-create the uid-doc from archived data
        const recoveredProfile = {
          uid: user.uid,
          role: 'parent',
          name: oldData.name || 'Parent',
          phone: oldData.phone || user.phoneNumber,
          email: oldData.email || '',
          linkedStudentIds: oldData.linkedStudentIds || [],
          branchId: oldData.branchId || '',
          createdAt: oldData.createdAt || serverTimestamp(),
          activatedAt: serverTimestamp(),
          recoveredAt: serverTimestamp(),
        };
        await setDoc(uidRef, recoveredProfile, { merge: true });
        console.log(`[Activation] uid-doc recovered for UID ${user.uid}`);
        return { id: user.uid, ...recoveredProfile };

      } else {
        // Different UID — phone was re-registered; activate under the new UID.
        console.log(`[Activation] Profile for ${preCreatedDocId} archived to old UID ${migratedTo}. Re-activating for new UID ${user.uid}...`);

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
          activatedAt: serverTimestamp(),
        };

        // Re-use a batch to keep student links consistent
        const batch = writeBatch(db);
        batch.set(newUserRef, newProfileData, { merge: true });
        // Update migratedTo on the archived doc (no unarchiving)
        batch.update(preCreatedRef, { migratedTo: user.uid, reactivatedAt: serverTimestamp() });

        const linkedStudentIds = oldData.linkedStudentIds || [];
        for (const studentId of linkedStudentIds) {
          const studentRef = doc(db, 'students', studentId);
          batch.update(studentRef, { parentUids: arrayUnion(user.uid) });
        }
        await batch.commit();

        console.log(`[Activation] Re-activated for new UID ${user.uid}`);
        return { id: user.uid, ...newProfileData };
      }
    }

    // ── FIRST-TIME ACTIVATION ─────────────────────────────────────────────────
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
      activatedAt: serverTimestamp(),
    };
    batch.set(newUserRef, newProfileData, { merge: true });

    // 2. Archive the old parent_phone document
    batch.update(preCreatedRef, {
      uid: user.uid,   // must match authenticated user to satisfy rules update
      role: 'parent',  // must match parent role to satisfy rules update
      archived: true,
      archivedAt: serverTimestamp(),
      migratedTo: user.uid,
    });

    // 3. Update all linked students' parentUids list
    const linkedStudentIds = oldData.linkedStudentIds || [];
    for (const studentId of linkedStudentIds) {
      const studentRef = doc(db, 'students', studentId);
      batch.update(studentRef, { parentUids: arrayUnion(user.uid) });
    }

    await batch.commit();
    console.log(`[Activation] Profile successfully activated for UID ${user.uid}!`);

    return { id: user.uid, ...newProfileData };

  } catch (err) {
    console.error(`[Activation] Error activating parent profile:`, err);
    throw err;
  }
}
