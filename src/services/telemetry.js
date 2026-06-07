import { getAnalyticsInstance, db, auth } from '../config/firebase.js';
import { logEvent as fbLogEvent } from 'firebase/analytics';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

// Helper to log event to Firebase Analytics
export async function logTelemetryEvent(eventName, params = {}) {
  try {
    const analytics = await getAnalyticsInstance();
    if (analytics) {
      fbLogEvent(analytics, eventName, params);
      console.log(`[Telemetry Event]: ${eventName}`, params);
    } else {
      console.log(`[Telemetry Event (Console Only)]: ${eventName}`, params);
    }
  } catch (err) {
    console.warn('Failed to log telemetry event:', err);
  }
}

// Helper to log error to console and Firestore if critical
export async function logTelemetryError(error, context = {}) {
  const errorMessage = error?.message || String(error);
  const errorStack = error?.stack || '';
  
  console.error(`[Telemetry Error] [${context.category || 'general'}]:`, error);

  // Check if error is critical
  const isCritical = context.isCritical || 
    errorMessage.includes('permission-denied') ||
    errorMessage.includes('unauthorized') ||
    errorMessage.includes('auth/') ||
    context.category === 'auth' ||
    context.category === 'attendance_write' ||
    context.category === 'payment_write' ||
    context.category === 'notification_registration' ||
    context.category === 'permission_denied';

  if (isCritical) {
    // Map input categories to exact narrowed whitelist categories for Firestore rules validation
    let standardCategory = 'uncaught_exception';
    const cat = context.category;
    if (cat === 'auth' || cat === 'auth_failure') {
      standardCategory = 'auth_failure';
    } else if (cat === 'attendance_write' || cat === 'attendance_write_failure') {
      standardCategory = 'attendance_write_failure';
    } else if (cat === 'payment_write' || cat === 'payment_failure') {
      standardCategory = 'payment_failure';
    } else if (cat === 'notification_registration' || cat === 'notification_failure') {
      standardCategory = 'notification_failure';
    } else if (cat === 'permission_denied' || errorMessage.includes('permission-denied')) {
      standardCategory = 'permission_denied';
    } else if (cat === 'unhandled_promise_rejection') {
      standardCategory = 'unhandled_promise_rejection';
    } else if (cat === 'uncaught_exception') {
      standardCategory = 'uncaught_exception';
    }

    // Skip writing to Firestore if user is not logged in to avoid Firebase security rules errors
    if (!auth || !auth.currentUser) {
      console.warn('[Telemetry] Unauthenticated user: skipping critical error Firestore log.', {
        message: errorMessage,
        category: standardCategory
      });
      return;
    }

    try {
      // Log critical failure to Firestore `/critical_logs`
      await addDoc(collection(db, 'critical_logs'), {
        message: errorMessage,
        stack: errorStack,
        category: standardCategory,
        timestamp: serverTimestamp(),
        deviceInfo: {
          userAgent: navigator.userAgent,
          language: navigator.language,
          online: navigator.onLine,
        },
        ...context.additionalMetadata
      });
      console.log('[Telemetry] Critical error logged to Firestore.');
    } catch (dbErr) {
      console.warn('Failed to write critical error to Firestore:', dbErr);
    }
  }
}

// Initialize global window error handlers
export function initGlobalErrorTracking() {
  if (typeof window === 'undefined') return;

  window.onerror = function (message, source, lineno, colno, error) {
    logTelemetryError(error || new Error(message), {
      category: 'uncaught_exception',
      isCritical: true,
      additionalMetadata: { source, lineno, colno }
    });
    return false; // let the default handler run
  };

  window.onunhandledrejection = function (event) {
    logTelemetryError(event.reason || new Error('Unhandled Promise Rejection'), {
      category: 'unhandled_promise_rejection',
      isCritical: true
    });
  };

  console.log('[Telemetry] Global error and rejection tracking initialized.');
}
