import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Detect iOS
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIOS(ios);

    // Listen for the beforeinstallprompt event (Chrome/Android)
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Listen for successful install
    window.addEventListener('appinstalled', () => {
      setInstalled(true);
      setDeferredPrompt(null);
      setTimeout(() => navigate('/login', { replace: true }), 1500);
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [navigate]);

  async function handleInstall() {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }
    if (!deferredPrompt) {
      // Already installed or not supported — go to login
      navigate('/login', { replace: true });
      return;
    }
    setInstalling(true);
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setInstalling(false);
    if (outcome === 'accepted') {
      setInstalled(true);
    } else {
      // User dismissed — let them proceed to login anyway
      navigate('/login', { replace: true });
    }
  }

  const features = [
    { icon: '📋', title: 'Daily Attendance', desc: "Mark & track your child's attendance in real time" },
    { icon: '💰', title: 'Fee Payments', desc: 'View fee history & receive payment confirmations' },
    { icon: '📸', title: 'School Posts', desc: 'Photos, announcements & updates from teachers' },
    { icon: '🔔', title: 'Instant Alerts', desc: 'Push notifications for every important update' },
  ];

  return (
    <div className="landing-shell">
      {/* Background gradient blobs */}
      <div className="landing-blob landing-blob-1" />
      <div className="landing-blob landing-blob-2" />
      <div className="landing-blob landing-blob-3" />

      <div className="landing-content">
        {/* Hero */}
        <div className="landing-hero">
          <div className="landing-logo-wrap">
            <div className="landing-logo">
              <span>HT</span>
            </div>
            <div className="landing-logo-ring" />
          </div>

          <h1 className="landing-title">
            Happy Times<br />
            <span className="landing-title-accent">Preschool</span>
          </h1>
          <p className="landing-subtitle">
            Your child's school, right in your pocket.<br />
            Install our app for the best experience.
          </p>
        </div>

        {/* Features */}
        <div className="landing-features">
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

        {/* Install CTA */}
        <div className="landing-cta-wrap">
          {installed ? (
            <div className="landing-installed">
              <span>✅</span>
              <span>App installed! Opening…</span>
            </div>
          ) : (
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
                    {isIOS ? 'Add to Home Screen' : deferredPrompt ? 'Install App' : 'Open App'}
                  </span>
                )}
              </button>
              <button
                className="landing-skip-btn"
                onClick={() => navigate('/login', { replace: true })}
              >
                Continue in browser →
              </button>
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
                  <div>Tap <strong>"Add"</strong> in the top right corner</div>
                </div>
              </div>
              <button
                className="landing-ios-ok"
                onClick={() => { setShowIOSGuide(false); navigate('/login', { replace: true }); }}
              >
                Got it, continue anyway
              </button>
            </div>
          </div>
        )}

        <p className="landing-footer">
          Happy Times Preschool &amp; Montessori · Secure &amp; Private
        </p>
      </div>
    </div>
  );
}
