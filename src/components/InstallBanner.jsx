import { useState, useEffect } from 'react';
import { isBrowserMode } from '../utils/appMode.js';

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const COOLDOWN_DAYS = 7;
  const COOLDOWN_MS = COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

  useEffect(() => {
    // 1. Only run in browser mode
    if (!isBrowserMode()) return;

    // 2. Detect iOS
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIOS(ios);

    // 3. Check if banner is on cooldown
    const dismissedTime = localStorage.getItem('pwa_banner_dismissed_time');
    if (dismissedTime) {
      const elapsed = Date.now() - parseInt(dismissedTime, 10);
      if (elapsed < COOLDOWN_MS) {
        setDismissed(true);
        return;
      } else {
        localStorage.removeItem('pwa_banner_dismissed_time');
      }
    }

    // 4. Listen for beforeinstallprompt
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // 5. Listen for successful install
    const installHandler = () => {
      setDeferredPrompt(null);
      setDismissed(true);
    };
    window.addEventListener('appinstalled', installHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installHandler);
    };
  }, []);

  if (!isBrowserMode() || dismissed) {
    return null;
  }

  // Only render if iOS or if programmatic install prompt is available
  if (!isIOS && !deferredPrompt) {
    return null;
  }

  async function handleInstall() {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setDismissed(true);
    } else {
      handleDismiss();
    }
  }

  function handleDismiss() {
    localStorage.setItem('pwa_banner_dismissed_time', Date.now().toString());
    setDismissed(true);
  }

  return (
    <>
      <div className="install-banner">
        <div className="install-banner-text">
          <strong>📱 Install Happy Times App</strong>
          <span>Receive real-time push alerts & offline updates directly on your home screen.</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button className="install-btn" onClick={handleInstall} style={{ cursor: 'pointer' }}>
            Install
          </button>
          <button 
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              fontSize: '22px',
              fontWeight: '300',
              padding: '0 6px',
              cursor: 'pointer',
              lineHeight: '1'
            }}
            onClick={handleDismiss}
            aria-label="Dismiss banner"
          >
            &times;
          </button>
        </div>
      </div>

      {showIOSGuide && (
        <div className="landing-ios-guide" style={{ zIndex: 10000 }}>
          <div className="landing-ios-guide-inner">
            <button
              className="landing-ios-close"
              onClick={() => setShowIOSGuide(false)}
            >&times;</button>
            <div className="landing-ios-title">Add to Home Screen</div>
            <div className="landing-ios-steps">
              <div className="landing-ios-step">
                <div className="landing-ios-step-num">1</div>
                <div>Tap the <strong>Share</strong> button <span style={{ fontSize: 18 }}>⎋</span> at the bottom of Safari</div>
              </div>
              <div className="landing-ios-step">
                <div className="landing-ios-step-num">2</div>
                <div>Scroll down and tap <strong>"Add to Home Screen"</strong></div>
              </div>
              <div className="landing-ios-step">
                <div className="landing-ios-step-num">3</div>
                <div>Go to your device's <strong>Home Screen</strong> and tap the new <strong>Happy Times</strong> app icon</div>
              </div>
            </div>
            <button className="landing-ios-ok" onClick={handleDismiss}>
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
