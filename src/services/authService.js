import { auth } from '../config/firebase.js';
import {
  signInWithPopup,
  signInWithRedirect,
  GoogleAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
} from 'firebase/auth';
import { translateAuthError } from '../utils/authErrorTranslator.js';

// Strict 10-second timeout helper
function withTimeout(promise, timeoutMs = 10000, operationName = 'Login request') {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      const error = new Error(`${operationName} timed out.`);
      error.code = 'auth/timeout';
      reject(error);
    }, timeoutMs);
  });

  return Promise.race([
    promise.then((res) => {
      clearTimeout(timeoutId);
      return res;
    }),
    timeoutPromise
  ]);
}

/**
 * Sign in using Google Provider (pop-up with redirect fallback).
 */
export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  try {
    const result = await withTimeout(signInWithPopup(auth, provider), 10000, 'Google Sign-in');
    return result;
  } catch (error) {
    console.warn('[authService] Google Sign-In popup error:', error.code, error.message);
    
    // Popup blockers / mobile environments fallback to Redirect
    const fallbackCodes = [
      'auth/popup-blocked',
      'auth/popup-closed-by-user',
      'auth/cancelled-popup-request',
      'auth/operation-not-supported-in-this-environment'
    ];

    if (fallbackCodes.includes(error.code)) {
      console.log('[authService] Google Sign-In redirect fallback initiated.');
      await signInWithRedirect(auth, provider);
      return null;
    }
    
    throw new Error(translateAuthError(error));
  }
}

/**
 * Sign in using Email and Password (test/admin accounts).
 */
export async function loginWithEmail(email, password) {
  try {
    const result = await withTimeout(
      signInWithEmailAndPassword(auth, email, password),
      10000,
      'Email Sign-in'
    );
    return result;
  } catch (error) {
    throw new Error(translateAuthError(error));
  }
}

/**
 * Sends OTP to a phone number.
 * @param {string} phone - 10 digit phone number
 * @param {string} elementId - ID of recaptcha container element
 */
export async function sendOtp(phone, elementId) {
  try {
    const formatted = phone.startsWith('+') ? phone : `+91${phone}`;
    
    // Reset/recreate recaptcha verifier
    if (window.recaptchaVerifier) {
      try { window.recaptchaVerifier.clear(); } catch (_) {}
      window.recaptchaVerifier = null;
    }
    
    window.recaptchaVerifier = new RecaptchaVerifier(auth, elementId, {
      size: 'invisible'
    });
    
    const confirmationResult = await withTimeout(
      signInWithPhoneNumber(auth, formatted, window.recaptchaVerifier),
      10000,
      'OTP Sending'
    );
    
    return confirmationResult;
  } catch (error) {
    if (window.recaptchaVerifier) {
      try { window.recaptchaVerifier.clear(); } catch (_) {}
      window.recaptchaVerifier = null;
    }
    throw new Error(translateAuthError(error));
  }
}

/**
 * Confirms the OTP code sent to phone.
 */
export async function verifyOtp(confirmationResult, otp) {
  try {
    const userCredential = await withTimeout(
      confirmationResult.confirm(otp),
      10000,
      'OTP Verification'
    );
    return userCredential;
  } catch (error) {
    throw new Error(translateAuthError(error));
  }
}

/**
 * Sign out current authenticated session.
 */
export async function logout() {
  try {
    await fbSignOut(auth);
  } catch (error) {
    throw new Error(translateAuthError(error));
  }
}
