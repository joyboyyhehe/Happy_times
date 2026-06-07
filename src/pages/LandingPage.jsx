import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLogo from '../components/AppLogo.jsx';
import { isInstalledApp, isStandalone } from '../utils/appMode.js';
import { logTelemetryEvent } from '../services/telemetry.js';

// Telemetry helper to log events directly to the logs collection in Firestore
async function logInstallGateEvent(event, details = '') {
  try {
    const { db } = await import('../config/firebase.js');
    const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
    await addDoc(collection(db, 'logs'), {
      actionType: 'install_gate_event',
      event,
      details,
      timestamp: serverTimestamp(),
      userAgent: navigator.userAgent,
    });
    console.log(`[Install Telemetry]: ${event} - ${details}`);
  } catch (err) {
    console.warn('Failed to log install telemetry:', err);
  }
}

export default function LandingPage() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installStatus, setInstallStatus] = useState('idle'); // 'idle' | 'preparing' | 'confirming' | 'installed' | 'cancelled'
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [swRegistered, setSwRegistered] = useState(false);
  const [manifestDetected, setManifestDetected] = useState(false);
  const [rejectCount, setRejectCount] = useState(0);
  const [tapCount, setTapCount] = useState(0);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const navigate = useNavigate();

  const disableInstallGate = import.meta.env.VITE_DISABLE_INSTALL_GATE === 'true';

  useEffect(() => {
    // 1. Detect iOS
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIOS(ios);

    // 2. Check if manifest exists in DOM
    const hasManifest = !!document.querySelector('link[rel="manifest"]');
    setManifestDetected(hasManifest);
    if (!hasManifest) {
      logInstallGateEvent('manifest_missing', 'Manifest link rel tag not detected in document head');
    }

    // 3. Check Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(() => {
        setSwRegistered(true);
      });
    } else {
      setSwRegistered(false);
      logInstallGateEvent('sw_missing', 'Service Worker not supported or registered in navigator');
    }

    // 4. Retrieve rejection counter from localStorage
    const count = parseInt(localStorage.getItem('pwa_install_rejected_count') || '0', 10);
    setRejectCount(count);

    // 5. Listen for beforeinstallprompt event (Chrome/Android/Desktop)
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      logInstallGateEvent('install_prompt_shown', 'Native beforeinstallprompt event captured');
    };
    window.addEventListener('beforeinstallprompt', handler);

    // 6. Listen for successful install
    const installHandler = () => {
      setInstallStatus('installed');
      logInstallGateEvent('install_completed', 'PWA installation completed (appinstalled event fired)');
      proceedToLogin();
    };
    window.addEventListener('appinstalled', installHandler);

    // 7. Telemetry for unsupported browser check (non-iOS and no install event handler fired)
    const timer = setTimeout(() => {
      if (!ios && !window.beforeinstallprompt && !deferredPrompt && !disableInstallGate) {
        logInstallGateEvent('unsupported_browser', 'Browser does not support native PWA installation triggers');
      }
    }, 2000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installHandler);
      clearTimeout(timer);
    };
  }, [deferredPrompt]);

  function proceedToLogin() {
    sessionStorage.setItem('browser_login_allowed', 'true');
    navigate('/login', { replace: true });
  }

  async function handleInstall() {
    if (isIOS) {
      setShowIOSGuide(true);
      logInstallGateEvent('install_prompt_shown', 'iOS installation instructions helper dialog displayed');
      return;
    }
    if (!deferredPrompt) {
      proceedToLogin();
      return;
    }

    setInstallStatus('preparing');
    try {
      setInstallStatus('confirming');
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setInstallStatus('installed');
        logInstallGateEvent('install_completed', 'PWA native installation accepted by user');
        setDeferredPrompt(null);
      } else {
        setInstallStatus('cancelled');
        logInstallGateEvent('install_declined', 'PWA native installation declined by user');
        
        // Increment decline counter
        const newCount = rejectCount + 1;
        setRejectCount(newCount);
        localStorage.setItem('pwa_install_rejected_count', newCount.toString());
        
        if (newCount >= 3) {
          logInstallGateEvent('fallback_unlocked', `Lockout threshold met: ${newCount} declines. Fallback login option visible.`);
        }

        setTimeout(() => {
          setInstallStatus('idle');
        }, 3000);
      }
    } catch (err) {
      setInstallStatus('idle');
      console.error('Install prompt failed:', err);
    }
  }

  function handleLogoTap() {
    const nextCount = tapCount + 1;
    setTapCount(nextCount);
    if (nextCount >= 5) {
      setShowDiagnostics(!showDiagnostics);
      setTapCount(0);
    }
  }

  const features = [
    { icon: '📋', title: 'Daily Attendance', desc: "Real-time attendance tracking" },
    { icon: '📸', title: 'School Posts', desc: 'Photos, announcements & updates' },
    { icon: '🔔', title: 'Instant Alerts', desc: 'Push notifications for every update' },
  ];

  const hasFallbackOption = disableInstallGate || rejectCount >= 3 || isIOS || (!isIOS && !deferredPrompt);

  return (
    <div className="landing-shell">
      {/* Background blobs */}
      <div className="landing-blob landing-blob-1" />
      <div className="landing-blob landing-blob-2" />
      <div className="landing-blob landing-blob-3" />

      {/* Browser mode status bar */}
      <div className="browser-badge-top">
        <span className="browser-badge-dot"></span>
        <span className="browser-badge-title">Running in Web Browser</span>
        <span className="browser-badge-separator">·</span>
        <span className="browser-badge-hint">Install app for dashboard access</span>
      </div>

      <div className="landing-content" style={{ paddingTop: '80px', paddingBottom: '24px', justifyContent: 'space-between', flex: 1 }}>
        {/* Logo and title */}
        <div className="landing-hero" style={{ padding: '20px 0 16px' }}>
          <div className="landing-logo-wrap" onClick={handleLogoTap} style={{ cursor: 'pointer' }}>
            <AppLogo variant="landing" />
          </div>

          <h1 className="landing-title">
            Happy Times<br />
            <span className="landing-title-accent">Preschool</span>
          </h1>
          <p className="landing-subtitle">
            Your child's school, right in your pocket.
          </p>
        </div>

        {/* Features */}
        <div className="landing-features" style={{ marginBottom: '20px' }}>
          {features.map((f) => (
            <div key={f.title} className="landing-feature-card">
              <div className="landing-feature-icon">{f.icon}</div>
              <div>
                <div className="landing-feature-title">{f.title}</div>
                <div className="landing-feature-desc">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Diagnostic Panel */}
        {showDiagnostics && (
          <div className="alert-info" style={{ margin: '0 20px 20px', textAlign: 'left', fontSize: '11px', fontFamily: 'monospace', background: 'rgba(24,95,165,0.9)', color: 'white', borderRadius: 'var(--radius-md)', padding: '12px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '4px' }}>⚙️ DIAGNOSTICS CONSOLE</div>
            <div>Installed: {isInstalledApp() ? 'YES ✅' : 'NO ❌'}</div>
            <div>Standalone Mode: {isStandalone() ? 'YES ✅' : 'NO ❌'}</div>
            <div>SW Registered: {swRegistered ? 'YES ✅' : 'NO ❌'}</div>
            <div>Manifest Detected: {manifestDetected ? 'YES ✅' : 'NO ❌'}</div>
            <div>Declined Count: {rejectCount}</div>
            <div>Bypass Gate Active: {disableInstallGate ? 'YES ✅' : 'NO ❌'}</div>
            <div style={{ wordBreak: 'break-all', marginTop: '4px', opacity: 0.8 }}>UA: {navigator.userAgent}</div>
          </div>
        )}

        {/* CTAs */}
        <div className="landing-cta-wrap">
          {installStatus === 'confirming' || installStatus === 'preparing' ? (
            <button className="landing-install-btn" disabled>
              <span className="landing-btn-inner">
                <div className="spinner spinner-sm" style={{ borderTopColor: 'white', marginRight: '8px' }} />
                {installStatus === 'preparing' ? 'Preparing install...' : 'Waiting for confirmation...'}
              </span>
            </button>
          ) : installStatus === 'installed' ? (
            <button className="landing-install-btn" disabled style={{ background: '#4CAF50' }}>
              <span className="landing-btn-inner">
                Installed successfully ✓
              </span>
            </button>
          ) : installStatus === 'cancelled' ? (
            <button className="landing-install-btn" disabled style={{ background: '#f44336' }}>
              <span className="landing-btn-inner">
                Cancelled install ❌
              </span>
            </button>
          ) : (
            <button className="landing-install-btn" onClick={handleInstall}>
              <span className="landing-btn-inner">
                <span className="landing-btn-icon">⬇️</span>
                {isIOS ? 'Add to Home Screen' : deferredPrompt ? 'Install App' : 'Get Mobile App'}
              </span>
            </button>
          )}

          {/* Fallback Login Option */}
          {hasFallbackOption && (
            <div className="landing-cooldown-actions" style={{ display: 'flex', justifyContent: 'center', width: '100%', marginTop: '12px' }}>
              <button
                className="landing-skip-btn"
                onClick={proceedToLogin}
                style={{ fontSize: '14px', fontWeight: '600', color: 'white', background: 'rgba(255,255,255,0.08)', padding: '10px 20px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                {disableInstallGate ? 'Continue to Login →' : 'Skip to Fallback Login →'}
              </button>
            </div>
          )}

          {/* Help Info when not bypass and no prompt */}
          {!hasFallbackOption && (
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'center' }}>
              Requires PWA-supported browser. If prompt does not appear, retry or check settings.
            </p>
          )}
        </div>

        {/* iOS / Safari Step-by-Step Installation Guide */}
        {showIOSGuide && (
          <div className="landing-ios-guide">
            <div className="landing-ios-guide-inner">
              <button
                className="landing-ios-close"
                onClick={() => {
                  setShowIOSGuide(false);
                  logInstallGateEvent('install_declined', 'iOS installation instructions dialog closed by user');
                }}
              >×</button>
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
                <div className="landing-ios-step">
                  <div className="landing-ios-step-num">4</div>
                  <div>Log in there for the best experience!</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button
                  className="landing-ios-ok"
                  onClick={() => {
                    setShowIOSGuide(false);
                    proceedToLogin();
                  }}
                  style={{ flex: 1 }}
                >
                  Continue to Login
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
