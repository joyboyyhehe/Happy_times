/**
 * Utility functions for detecting PWA install status and browser mode.
 */

export function isStandalone() {
  // Guard for window existence
  if (typeof window === 'undefined') {
    return false;
  }

  // 1. Check window matchMedia display modes safely
  const hasMatchMedia = typeof window.matchMedia === 'function';
  const isStandaloneMedia = hasMatchMedia ? window.matchMedia('(display-mode: standalone)').matches : false;
  const isFullscreenMedia = hasMatchMedia ? window.matchMedia('(display-mode: fullscreen)').matches : false;
  const isMinimalUiMedia = hasMatchMedia ? window.matchMedia('(display-mode: minimal-ui)').matches : false;

  // 2. Check iOS Safari standalone property safely
  const isNavStandalone = 
    (typeof window.navigator !== 'undefined' && window.navigator.standalone === true) || 
    (typeof navigator !== 'undefined' && navigator.standalone === true);

  // 3. Check Referrer for Android Trusted Web Activities (TWA) safely
  const isAndroidTWAReferrer = 
    typeof document !== 'undefined' && 
    document.referrer && 
    document.referrer.includes('android-app://');

  // 4. Check query string parameters or launch hash (custom launcher tags) safely
  let hasStandaloneQuery = false;
  try {
    const queryParams = new URLSearchParams(window.location.search);
    hasStandaloneQuery = queryParams.get('mode') === 'standalone' || 
                         queryParams.get('utm_source') === 'pwa';
  } catch (e) {
    // Ignore query parsing errors
  }

  return (
    isStandaloneMedia ||
    isFullscreenMedia ||
    isMinimalUiMedia ||
    isNavStandalone ||
    isAndroidTWAReferrer ||
    hasStandaloneQuery
  );
}

export function isInstalledApp() {
  return isStandalone();
}

export function isBrowserMode() {
  return !isStandalone();
}
