import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../../config/firebase.js';
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { checkStaffWhitelist, createOrUpdateUser } from '../../services/firestore.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { initNotifications } from '../../services/notifications.js';
import { logTelemetryEvent, logTelemetryError } from '../../services/telemetry.js';
import AppLogo from '../../components/AppLogo.jsx';


export default function LoginScreen() {
  const [view, setView] = useState('select'); // 'select' | 'phone' | 'otp' | 'unauthorized' | 'test_email'
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmResult, setConfirmResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [unauthorizedEmail, setUnauthorizedEmail] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const authTimeoutRef = useRef(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('test') === 'true') {
      setView('test_email');
    }

    // Process Google redirect sign-in result when returning to the app
    getRedirectResult(auth)
      .then(async (result) => {
        if (result && result.user) {
          console.log('[AUTH] redirect returned');
          setLoading(true);
          const email = result.user.email;
          const whitelistEntry = await checkStaffWhitelist(email);
          console.log('[AUTH] whitelist verified');
          
          if (!whitelistEntry) {
            logTelemetryEvent('login_failed', { email, reason: 'not_whitelisted' });
            logTelemetryError(new Error(`Staff email ${email} is not in whitelist`), { category: 'auth', isCritical: true });
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
          if (profile) {
            logTelemetryEvent('login_success', { email, role: profile.role });
            navigateByRole(profile.role);
          }
        }
      })
      .catch((e) => {
        console.error('[Auth] Google Redirect Error:', e);
        logTelemetryEvent('login_failed', { reason: 'google_redirect_error' });
        logTelemetryError(e, { category: 'auth', isCritical: true });
        setError('Google Sign-In failed or was cancelled during redirect. Please try again.');
      })
      .finally(() => {
        setLoading(false);
      });

    return () => {
      if (authTimeoutRef.current) {
        clearTimeout(authTimeoutRef.current);
      }
    };
  }, []);

  function navigateByRole(role) {
    console.log('[AUTH] navigation starting');
    initNotifications().catch(console.error);
    switch (role) {
      case 'superadmin': navigate('/super-admin', { replace: true }); break;
      case 'branchadmin':
      case 'teacher':
      case 'staff':
        navigate('/branch-admin', { replace: true }); 
        break;
      case 'parent': navigate('/parent', { replace: true }); break;
      default: setError('Unknown role. Contact admin.');
    }
  }

  async function handleGoogleSignIn() {
    console.log('[AUTH] login started');
    setLoading(true);
    setError(null);

    // Clear any pre-existing timeout first
    if (authTimeoutRef.current) {
      clearTimeout(authTimeoutRef.current);
      authTimeoutRef.current = null;
    }

    // Set 90-second Auth Timeout Protection on the Ref
    authTimeoutRef.current = setTimeout(() => {
      console.warn('[AUTH] Login transaction timed out.');
      authTimeoutRef.current = null;
      setLoading(false);
      setError('Login timed out. Please check your network connection and try again.');
      logTelemetryEvent('login_timeout', { provider: 'google' });
    }, 90000);

    try {
      const provider = new GoogleAuthProvider();
      console.log('[AUTH] popup started');

      try {
        const result = await signInWithPopup(auth, provider);
        
        // Success -> Clear timeout ref immediately
        if (authTimeoutRef.current) {
          clearTimeout(authTimeoutRef.current);
          authTimeoutRef.current = null;
        }

        console.log('[AUTH] popup success');
        const email = result.user.email;

        const whitelistEntry = await checkStaffWhitelist(email);
        console.log('[AUTH] whitelist verified');
        
        if (!whitelistEntry) {
          logTelemetryEvent('login_failed', { email, reason: 'not_whitelisted' });
          logTelemetryError(new Error(`Staff email ${email} is not in whitelist`), { category: 'auth', isCritical: true });
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
        if (profile) {
          logTelemetryEvent('login_success', { email, role: profile.role });
          navigateByRole(profile.role);
        }
        setLoading(false);
      } catch (popupErr) {
        console.warn('[AUTH] signInWithPopup threw an error:', popupErr.code, popupErr.message);

        // Fallback ONLY on specific popup blocks/failures
        const fallbackErrorCodes = [
          'auth/popup-blocked',
          'auth/popup-closed-by-user',
          'auth/cancelled-popup-request',
          'auth/operation-not-supported-in-this-environment'
        ];

        if (fallbackErrorCodes.includes(popupErr.code)) {
          console.log('[AUTH] redirect fallback');
          
          // Clear timeout ref before redirecting as page unloads
          if (authTimeoutRef.current) {
            clearTimeout(authTimeoutRef.current);
            authTimeoutRef.current = null;
          }

          await signInWithRedirect(auth, provider);
        } else {
          // Non-fallback errors -> clear timeout ref
          if (authTimeoutRef.current) {
            clearTimeout(authTimeoutRef.current);
            authTimeoutRef.current = null;
          }
          throw popupErr;
        }
      }
    } catch (e) {
      // Clear timeout ref on error
      if (authTimeoutRef.current) {
        clearTimeout(authTimeoutRef.current);
        authTimeoutRef.current = null;
      }

      console.error('[Auth] Google Sign-In Error:', e);
      logTelemetryEvent('login_failed', { reason: 'google_popup_error' });
      logTelemetryError(e, { category: 'auth', isCritical: e.code !== 'auth/popup-closed-by-user' });
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
    
    // Set a 15-second safety timeout in case reCAPTCHA verification hangs
    const safetyTimeout = setTimeout(() => {
      setLoading(false);
      setError('OTP request timed out. Please check your network or try opening in a standard browser (Safari/Chrome).');
      if (window.recaptchaVerifier) {
        try { window.recaptchaVerifier.clear(); } catch (err) {}
        window.recaptchaVerifier = null;
      }
    }, 15000);

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
      
      clearTimeout(safetyTimeout);
      setConfirmResult(result);
      setView('otp');
      setLoading(false);
    } catch (e) {
      clearTimeout(safetyTimeout);
      console.error('[Auth] Send OTP Error:', e);
      logTelemetryEvent('login_failed', { reason: 'otp_send_failed' });
      logTelemetryError(e, { category: 'auth', isCritical: true });
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
    
    // Set a 15-second safety timeout for verification
    const safetyTimeout = setTimeout(() => {
      setLoading(false);
      setError('OTP verification timed out. Please check your connection and try again.');
    }, 15000);

    try {
      await confirmResult.confirm(otp);
      clearTimeout(safetyTimeout);
      const profile = await refreshProfile();
      if (profile) {
        logTelemetryEvent('login_success', { role: profile.role });
        navigateByRole(profile.role);
      } else {
        logTelemetryEvent('login_failed', { reason: 'parent_profile_missing' });
        logTelemetryError(new Error('Parent profile whitelisting missing for verified phone'), { category: 'auth', isCritical: true });
        setError('Account not found. Contact your school admin.');
        await auth.signOut().catch(() => {});
        setLoading(false);
      }
    } catch (e) {
      clearTimeout(safetyTimeout);
      logTelemetryEvent('otp_failed', { code: e.code });
      logTelemetryEvent('login_failed', { reason: 'otp_verification_failed' });
      logTelemetryError(e, { category: 'auth', isCritical: !e.message?.includes('OTP') && !e.code?.includes('code') });
      await auth.signOut().catch(() => {});
      if (e.message?.includes('OTP') || e.code?.includes('code')) {
        setError('Invalid OTP. Please try again.');
      } else {
        setError(e.message || 'Verification failed. Please try again.');
      }
      setLoading(false);
    }
  }

  async function handleTestEmailSignIn(e) {
    if (e) e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      const profile = await refreshProfile();
      if (profile) {
        logTelemetryEvent('login_success', { email, role: profile.role });
        navigateByRole(profile.role);
      } else {
        setError('User profile not found in database.');
        await auth.signOut();
      }
    } catch (err) {
      console.error('[Auth] Test Email Sign-In Error:', err);
      setError(err.message || 'Authentication failed');
    } finally {
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
        <AppLogo variant="login" />
        <span className="login-brand-name">Happy Times</span>
      </div>

      {/* Card */}
      <div className="login-card-wrap">
        <div className="login-card">

          {/* ── TEST EMAIL VIEW ── */}
          {view === 'test_email' && (
            <form onSubmit={handleTestEmailSignIn} className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="login-card-icon">🧪</div>
              <h1 className="login-card-title">Test Sign In</h1>
              <p className="login-card-sub">Email / Password Login (Bypass/Automation)</p>

              <div style={{ textAlign: 'left' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@happytimes.com"
                  className="login-phone-input"
                  style={{ width: '100%', paddingLeft: '16px', boxSizing: 'border-box' }}
                  required
                />
              </div>

              <div style={{ textAlign: 'left' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="login-phone-input"
                  style={{ width: '100%', paddingLeft: '16px', boxSizing: 'border-box' }}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
                style={{ borderRadius: 'var(--radius-md)', height: 52, fontSize: 16, marginTop: '8px' }}
              >
                {loading
                  ? <div className="spinner spinner-sm" style={{ borderTopColor: 'white' }} />
                  : 'Sign In ✓'}
              </button>

              <button
                type="button"
                className="login-back-btn"
                onClick={() => { setView('select'); setError(null); }}
              >
                ← Back
              </button>
            </form>
          )}

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
                {loading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                    <div className="spinner spinner-sm" style={{ borderTopColor: 'white' }} />
                    <span>Sending...</span>
                  </div>
                ) : (
                  'Send OTP →'
                )}
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
                {loading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                    <div className="spinner spinner-sm" style={{ borderTopColor: 'white' }} />
                    <span>Verifying...</span>
                  </div>
                ) : (
                  'Verify OTP ✓'
                )}
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
            <div className="alert-error" style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>⚠</span>
                <span>{error}</span>
              </div>
              {/FBAN|FBAV|Instagram|Twitter|Line|WhatsApp/i.test(navigator.userAgent) && (
                <div style={{ fontSize: '11px', opacity: 0.8, borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '6px', marginTop: '4px', textAlign: 'left', lineHeight: '1.4' }}>
                  💡 <strong>Tip:</strong> In-app browsers (like Instagram or WhatsApp) often block Google sign-in. Tap the menu in the top corner and select <strong>"Open in Browser"</strong> to complete login.
                </div>
              )}
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
