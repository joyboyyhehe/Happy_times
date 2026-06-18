import { db } from '../config/firebase.js';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getUserProfile, checkStaffWhitelist, createOrUpdateUser } from './firestore.js';
import { activateParentProfile } from './activateParentProfile.js';

/**
 * Fetch a user's profile, attempting auto-activation if they are a parent.
 */
export async function fetchProfile(uid, firebaseUser = null) {
  try {
    let profile = await getUserProfile(uid);
    if (!profile && firebaseUser && firebaseUser.phoneNumber) {
      console.log('[profileService] No profile found for parent. Attempting auto-activation...');
      profile = await activateParentProfile(firebaseUser);
      if (!profile) {
        // Fallback check
        profile = await getUserProfile(uid);
      }
    }
    return profile;
  } catch (error) {
    console.error('[profileService] Error fetching profile:', error);
    throw new Error('Unable to load your profile. Please check your network connection.');
  }
}

/**
 * Check if the email is in the staff whitelist.
 */
export async function verifyWhitelist(email) {
  try {
    return await checkStaffWhitelist(email);
  } catch (error) {
    console.error('[profileService] Whitelist verification failed:', error);
    throw new Error('Unable to verify whitelist. Service temporarily unavailable.');
  }
}

/**
 * Creates or updates user account metadata on login.
 */
export async function syncUserAccount(uid, userData) {
  try {
    await createOrUpdateUser(uid, userData);
  } catch (error) {
    console.error('[profileService] Error syncing user account:', error);
    throw new Error('Unable to update your user account details.');
  }
}

/**
 * Fetch global Maintenance settings.
 */
export async function fetchMaintenanceSettings() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'maintenance'));
    if (snap.exists()) {
      const data = snap.data();
      return {
        enabled: data.enabled === true,
        message: data.message || 'System maintenance in progress',
        estimatedReturn: data.estimatedReturn || '',
        contactNumber: data.contactNumber || ''
      };
    }
    return { enabled: false, message: 'System maintenance in progress', estimatedReturn: '', contactNumber: '' };
  } catch (error) {
    console.warn('[profileService] Error loading maintenance settings:', error);
    // Silent fail safe: default to false
    return { enabled: false, message: 'System maintenance in progress', estimatedReturn: '', contactNumber: '' };
  }
}

/**
 * Update global Maintenance settings.
 */
export async function setMaintenanceSettings(settings) {
  try {
    await setDoc(doc(db, 'settings', 'maintenance'), {
      enabled: settings.enabled === true,
      message: settings.message || 'System maintenance in progress',
      estimatedReturn: settings.estimatedReturn || '',
      contactNumber: settings.contactNumber || '',
      updatedAt: new Date()
    }, { merge: true });
  } catch (error) {
    console.error('[profileService] Error setting maintenance settings:', error);
    throw new Error('Unable to update maintenance settings.');
  }
}
