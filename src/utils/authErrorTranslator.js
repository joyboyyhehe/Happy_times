/**
 * Maps standard Firebase Auth error codes to user-friendly display messages.
 * Prevents raw exceptions or configuration detail codes from reaching the user.
 * 
 * @param {Error|Object} error - The caught error object
 * @returns {string} User-friendly error message
 */
export function translateAuthError(error) {
  if (!error) return 'An unknown authentication error occurred.';
  
  const code = error.code || '';
  const message = error.message || '';

  // Handle specific Firebase Auth error codes
  switch (code) {
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect password.';
    case 'auth/user-not-found':
      return 'No account found with this email.';
    case 'auth/invalid-email':
      return 'Invalid email address.';
    case 'auth/network-request-failed':
      return 'Please check your internet connection.';
    case 'auth/internal-error':
      return 'Service temporarily unavailable. Please try again.';
    case 'auth/too-many-requests':
      return 'Too many login attempts. Please try again later.';
    case 'auth/popup-closed-by-user':
      return 'Login popup was closed. Please try again.';
    case 'auth/popup-blocked':
      return 'Login popup was blocked by your browser. Please check your pop-up blocker settings.';
    case 'auth/cancelled-popup-request':
      return 'Sign-in request was cancelled. Please try again.';
    case 'auth/invalid-verification-code':
      return 'Invalid OTP. Please try again.';
    case 'auth/code-expired':
      return 'OTP has expired. Please request a new one.';
    case 'auth/captcha-check-failed':
      return 'reCAPTCHA verification failed. Please try again.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support.';
    case 'auth/operation-not-allowed':
      return 'This login method is not allowed. Please contact support.';
    case 'auth/timeout':
      return 'Login took longer than expected. Please check your network connection and retry.';
    default:
      // Fallback translations based on common keywords
      if (message.includes('network') || message.includes('offline')) {
        return 'Please check your internet connection.';
      }
      if (message.includes('timeout') || message.includes('time out')) {
        return 'Login is taking longer than expected.';
      }
      if (message.includes('permission') || message.includes('insufficient')) {
        return 'You do not have permission to access this portal.';
      }
      
      return 'Sign-in failed. Please try again.';
  }
}
