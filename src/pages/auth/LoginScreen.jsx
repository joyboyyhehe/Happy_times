import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../../config/firebase.js';
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from 'firebase/auth';
import { checkStaffWhitelist, createOrUpdateUser } from '../../services/firestore.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { initNotifications } from '../../services/notifications.js';

export default function LoginScreen() {
  const [view, setView] = useState('select'); // 'select' | 'phone' | 'otp' | 'unauthorized'
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmResult, setConfirmResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [unauthorizedEmail, setUnauthorizedEmail] = useState('');
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();

  useEffect(() => {
    // Process Google redirect sign-in result when returning to the app
    getRedirectResult(auth)
      .then(async (result) => {
        if (result && result.user) {
          setLoading(true);
          const email = result.user.email;
          const whitelistEntry = await checkStaffWhitelist(email);
          if (!whitelistEntry) {
            await auth.signOut();
            setUnauthorizedEmail(email);
            setView('unauthorized');
            setLoading(false);
            return;
          }

          await createOrUpdateUser(result.user.uid, {
            email,
            name: result.user.displayName || email,
            role: whitelistEntry.role,
            branchId: whitelistEntry.branchId || null,
            lastLogin: new Date(),
          });

          const profile = await refreshProfile();
          if (profile) navigateByRole(profile.role);
        }
      })
      .catch((e) => {
        console.error('[Auth] Google Redirect Error:', e);
        setError('Google Sign-In failed or was cancelled during redirect. Please try again.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  function navigateByRole(role) {
    initNotifications().catch(console.error);
    switch (role) {
      case 'superadmin': navigate('/super-admin', { replace: true }); break;
      case 'branchadmin': navigate('/branch-admin', { replace: true }); break;
      case 'parent': navigate('/parent', { replace: true }); break;
      default: setError('Unknown role. Contact admin.');
    }
  }

  async function handleGoogleSignIn() {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();

      // Proactively detect mobile iOS/Android WebViews or stand-alone PWA apps which block popups
      const isWebView = /FBAN|FBAV|Instagram|Twitter|Line|WhatsApp/i.test(navigator.userAgent) || 
                        (navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad') || navigator.userAgent.includes('iPod')) && !navigator.userAgent.includes('Safari');
      const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;

      if (isWebView || isStandalone) {
        console.log('[Auth] Mobile PWA/WebView environment detected. Falling back to redirect.');
        await signInWithRedirect(auth, provider);
      } else {
        const result = await signInWithPopup(auth, provider);
        const email = result.user.email;

        const whitelistEntry = await checkStaffWhitelist(email);
        if (!whitelistEntry) {
          await auth.signOut();
          setUnauthorizedEmail(email);
          setView('unauthorized');
          setLoading(false);
          return;
        }

        await createOrUpdateUser(result.user.uid, {
          email,
          name: result.user.displayName || email,
          role: whitelistEntry.role,
          branchId: whitelistEntry.branchId || null,
          lastLogin: new Date(),
        });

        const profile = await refreshProfile();
        if (profile) navigateByRole(profile.role);
      }
    } catch (e) {
      console.error('[Auth] Google Sign-In Error:', e);
      await auth.signOut().catch(() => {});
      if (e.code === 'auth/popup-closed-by-user') {
        setError('Login popup was closed. Please try again.');
      } else if (e.code === 'auth/unauthorized-domain') {
        setError('This domain is not authorized. Check Firebase Authorized Domains.');
      } else {
        setError(e.message || 'Sign-in failed. Please try again.');
      }
      setLoading(false);
    }
  }

  async function handleSendOtp() {
    if (phone.length < 10) { setError('Enter a valid 10-digit mobile number'); return; }
    setLoading(true);
    setError(null);
    try {
      const formatted = phone.startsWith('+') ? phone : `+91${phone}`;
      if (window.recaptchaVerifier) {
        try { window.recaptchaVerifier.clear(); } catch (err) { /* ignore */ }
        window.recaptchaVerifier = null;
      }
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
      });
      const result = await signInWithPhoneNumber(auth, formatted, window.recaptchaVerifier);
      setConfirmResult(result);
      setView('otp');
      setLoading(false);
    } catch (e) {
      console.error('[Auth] Send OTP Error:', e);
      if (e.code === 'auth/unauthorized-domain') {
        setError('This domain is not authorized. Check Firebase Authorized Domains.');
      } else {
        setError(e.message || 'Failed to send OTP. Please try again.');
      }
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    if (otp.length !== 6) { setError('Enter the 6-digit OTP'); return; }
    setLoading(true);
    setError(null);
    try {
      await confirmResult.confirm(otp);
      const profile = await refreshProfile();
      if (profile) {
        navigateByRole(profile.role);
      } else {
        setError('Account not found. Contact your school admin.');
        await auth.signOut().catch(() => {});
        setLoading(false);
      }
    } catch (e) {
      await auth.signOut().catch(() => {});
      if (e.message?.includes('OTP') || e.code?.includes('code')) {
        setError('Invalid OTP. Please try again.');
      } else {
        setError(e.message || 'Verification failed. Please try again.');
      }
      setLoading(false);
    }
  }

  return (
    <div className="login-shell">
      {/* Decorative background */}
      <div className="login-bg">
        <div className="login-bg-blob login-bg-blob-1" />
        <div className="login-bg-blob login-bg-blob-2" />
      </div>

      {/* Top brand strip */}
      <div className="login-brand-strip">
        <div className="login-logo-sm">
          <span>HT</span>
        </div>
        <span className="login-brand-name">Happy Times</span>
      </div>

      {/* Card */}
      <div className="login-card-wrap">
        <div className="login-card">

          {/* ── UNAUTHORIZED VIEW ── */}
          {view === 'unauthorized' && (
            <div className="fade-in">
              <div className="login-card-icon login-card-icon--danger">🔒</div>
              <h1 className="login-card-title">Access Denied</h1>
              <p className="login-card-sub">
                <strong>{unauthorizedEmail}</strong> is not registered as staff.
                Please contact the Super Admin.
              </p>
              <div style={{ height: 24 }} />
              <button
                className="btn btn-outline w-full"
                onClick={() => { setView('select'); setError(null); }}
              >
                ← Back to login
              </button>
            </div>
          )}

          {/* ── SELECT VIEW ── */}
          {view === 'select' && (
            <div className="fade-in">
              <div className="login-card-icon">👋</div>
              <h1 className="login-card-title">Welcome back!</h1>
              <p className="login-card-sub">Happy Times Preschool &amp; Montessori</p>

              <div style={{ height: 32 }} />

              <div className="login-role-grid">
                {/* Parent */}
                <button
                  id="login-parent"
                  className="login-role-btn"
                  onClick={() => setView('phone')}
                >
                  <div className="login-role-icon login-role-icon--parent">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                      <circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                  </div>
                  <div className="login-role-label">I'm a Parent</div>
                  <div className="login-role-hint">Mobile + OTP</div>
                  <div className="login-role-arrow">→</div>
                </button>

                {/* Staff */}
                <button
                  id="login-staff"
                  className="login-role-btn login-role-btn--staff"
                  onClick={loading ? undefined : handleGoogleSignIn}
                  disabled={loading}
                >
                  <div className="login-role-icon login-role-icon--staff">
                    {loading ? (
                      <div className="spinner spinner-sm" />
                    ) : (
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                      </svg>
                    )}
                  </div>
                  <div className="login-role-label">I'm Staff</div>
                  <div className="login-role-hint">Sign in with Google</div>
                  <div className="login-role-arrow">→</div>
                </button>
              </div>
            </div>
          )}

          {/* ── PHONE VIEW ── */}
          {view === 'phone' && (
            <div className="fade-in">
              <div className="login-card-icon login-card-icon--phone">📱</div>
              <h1 className="login-card-title">Parent Login</h1>
              <p className="login-card-sub">Enter your registered mobile number</p>

              <div style={{ height: 28 }} />

              <div className="login-phone-input-wrap">
                <div className="login-phone-prefix">+91</div>
                <input
                  id="phone-input"
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="Mobile number"
                  className="login-phone-input"
                  autoFocus
                />
              </div>

              <div style={{ height: 16 }} />

              <button
                id="send-otp-btn"
                className="btn btn-primary"
                onClick={handleSendOtp}
                disabled={loading}
                style={{ borderRadius: 'var(--radius-md)', height: 52, fontSize: 16 }}
              >
                {loading
                  ? <div className="spinner spinner-sm" style={{ borderTopColor: 'white' }} />
                  : 'Send OTP →'}
              </button>

              <div style={{ height: 12 }} />

              <button
                className="login-back-btn"
                onClick={() => { setView('select'); setError(null); }}
              >
                ← Back
              </button>
            </div>
          )}

          {/* ── OTP VIEW ── */}
          {view === 'otp' && (
            <div className="fade-in">
              <div className="login-card-icon login-card-icon--otp">🔢</div>
              <h1 className="login-card-title">Enter OTP</h1>
              <p className="login-card-sub">Sent to +91 {phone}</p>

              <div style={{ height: 28 }} />

              <input
                id="otp-input"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="· · · · · ·"
                className="login-otp-input"
                autoFocus
              />

              <div style={{ height: 16 }} />

              <button
                id="verify-otp-btn"
                className="btn btn-primary"
                onClick={handleVerifyOtp}
                disabled={loading}
                style={{ borderRadius: 'var(--radius-md)', height: 52, fontSize: 16 }}
              >
                {loading
                  ? <div className="spinner spinner-sm" style={{ borderTopColor: 'white' }} />
                  : 'Verify OTP ✓'}
              </button>

              <div style={{ height: 16 }} />

              <div className="login-otp-footer">
                <button
                  className="login-back-btn"
                  onClick={() => { setView('phone'); setOtp(''); setError(null); }}
                >
                  ← Change number
                </button>
                <button
                  className="login-resend-btn"
                  onClick={handleSendOtp}
                  disabled={loading}
                >
                  Resend OTP
                </button>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="alert-error" style={{ marginTop: 16 }}>
              <span>⚠</span>
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <p className="login-footer-text">
        Secure &amp; private · Happy Times Preschool
      </p>

      <div id="recaptcha-container" />
    </div>
  );
}
