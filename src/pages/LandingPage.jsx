import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLogo from '../components/AppLogo.jsx';

export default function LandingPage() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installing, setInstalling] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isCooldown, setIsCooldown] = useState(false);
  const navigate = useNavigate();

  const COOLDOWN_DAYS = 7;
  const COOLDOWN_MS = COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

  useEffect(() => {
    // 1. Detect iOS
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIOS(ios);

    // 2. Check if installation is in cooldown
    const dismissedTime = localStorage.getItem('pwa_install_dismissed_time');
    if (dismissedTime) {
      const elapsed = Date.now() - parseInt(dismissedTime, 10);
      if (elapsed < COOLDOWN_MS) {
        setIsCooldown(true);
      } else {
        localStorage.removeItem('pwa_install_dismissed_time'); // Cooldown expired
      }
    }

    // 3. Listen for the beforeinstallprompt event (Chrome/Android/Desktop)
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // 4. Listen for successful install
    const installHandler = () => {
      setDeferredPrompt(null);
      proceedToLogin();
    };
    window.addEventListener('appinstalled', installHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installHandler);
    };
  }, [navigate]);

  function proceedToLogin() {
    sessionStorage.setItem('browser_login_allowed', 'true');
    navigate('/login', { replace: true });
  }

  async function handleInstall() {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }
    if (!deferredPrompt) {
      proceedToLogin();
      return;
    }
    setInstalling(true);
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setInstalling(false);
    
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      // Wait for appinstalled listener or let browser launch it
    } else {
      // User dismissed prompt, trigger cooldown
      handleMaybeLater();
    }
  }

  function handleMaybeLater() {
    localStorage.setItem('pwa_install_dismissed_time', Date.now().toString());
    setIsCooldown(true);
    setShowIOSGuide(false);
    sessionStorage.setItem('browser_login_allowed', 'true');
  }

  const features = [
    { icon: '📋', title: 'Daily Attendance', desc: "Real-time attendance tracking" },
    { icon: '📸', title: 'School Posts', desc: 'Photos, announcements & updates' },
    { icon: '🔔', title: 'Instant Alerts', desc: 'Push notifications for every update' },
  ];

  return (
    <div className="landing-shell">
      {/* Background gradient blobs */}
      <div className="landing-blob landing-blob-1" />
      <div className="landing-blob landing-blob-2" />
      <div className="landing-blob landing-blob-3" />

      {/* Browser Badge */}
      <div className="browser-badge-top">
        <span className="browser-badge-dot"></span>
        <span className="browser-badge-title">Running in Browser Mode</span>
        <span className="browser-badge-separator">·</span>
        <span className="browser-badge-hint">Install for best experience</span>
      </div>

      <div className="landing-content" style={{ paddingTop: '80px', paddingBottom: '24px', justifyContent: 'space-between', flex: 1 }}>
        {/* Hero */}
        <div className="landing-hero" style={{ padding: '20px 0 16px' }}>
          <div className="landing-logo-wrap">
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

        {/* Dynamic CTAs based on Cooldown */}
        <div className="landing-cta-wrap">
          {isCooldown ? (
            // Cooldown State: Main CTA is Login, Install is a secondary link/button
            <>
              <button
                className="landing-install-btn"
                onClick={proceedToLogin}
                style={{
                  background: 'linear-gradient(135deg, #185FA5 0%, #1A1528 100%)',
                  boxShadow: '0 6px 24px rgba(24,95,165,0.2)'
                }}
              >
                <span className="landing-btn-inner">
                  Continue to Login →
                </span>
              </button>
              {deferredPrompt && (
                <button
                  className="landing-skip-btn"
                  onClick={handleInstall}
                  style={{ textDecoration: 'underline', color: 'var(--primary)' }}
                >
                  Install App (recommended)
                </button>
              )}
            </>
          ) : (
            // Normal State: Main CTA is Install, Login is secondary/discreet
            <>
              <button
                className="landing-install-btn"
                onClick={handleInstall}
                disabled={installing}
              >
                {installing ? (
                  <span className="landing-btn-inner">
                    <div className="spinner spinner-sm" style={{ borderTopColor: 'white' }} />
                    Installing…
                  </span>
                ) : (
                  <span className="landing-btn-inner">
                    <span className="landing-btn-icon">⬇️</span>
                    {isIOS ? 'Add to Home Screen' : deferredPrompt ? 'Install App' : 'Get Mobile App'}
                  </span>
                )}
              </button>
              
              <div className="landing-cooldown-actions" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginTop: '6px' }}>
                <button
                  className="landing-skip-btn"
                  onClick={handleMaybeLater}
                  style={{ fontSize: '13px' }}
                >
                  Maybe Later
                </button>
                <button
                  className="landing-skip-btn"
                  onClick={proceedToLogin}
                  style={{ fontSize: '13px', fontWeight: '600', color: 'white' }}
                >
                  Continue to Login
                </button>
              </div>
            </>
          )}
        </div>

        {/* iOS Guide */}
        {showIOSGuide && (
          <div className="landing-ios-guide">
            <div className="landing-ios-guide-inner">
              <button
                className="landing-ios-close"
                onClick={() => setShowIOSGuide(false)}
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
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button
                  className="landing-ios-ok"
                  onClick={handleMaybeLater}
                  style={{ flex: 1 }}
                >
                  Dismiss Guide
                </button>
                <button
                  className="landing-ios-ok"
                  onClick={() => { setShowIOSGuide(false); proceedToLogin(); }}
                  style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.06)' }}
                >
                  Skip to Login
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
