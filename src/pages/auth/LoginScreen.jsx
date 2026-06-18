import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../../config/firebase.js';
import { getRedirectResult } from 'firebase/auth';
import { checkStaffWhitelist, createOrUpdateUser } from '../../services/firestore.js';
import {
  loginWithGoogle,
  loginWithEmail,
  sendOtp,
  verifyOtp,
  logout
} from '../../services/authService.js';
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
  const { authState, setAuthState, profile, maintenanceSettings, refreshProfile } = useAuth();

  const isAuthenticating = authState === 'AUTHENTICATING' || loading;
  const showMaintenance = maintenanceSettings?.enabled && profile?.role === 'parent';

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
          setAuthState('AUTHENTICATING');
          const email = result.user.email;
          const whitelistEntry = await checkStaffWhitelist(email);
          console.log('[AUTH] whitelist verified');
          
          if (!whitelistEntry) {
            logTelemetryEvent('login_failed', { email, reason: 'not_whitelisted' });
            logTelemetryError(new Error(`Staff email ${email} is not in whitelist`), { category: 'auth', isCritical: true });
            await logout();
            setUnauthorizedEmail(email);
            setView('unauthorized');
            setLoading(false);
            setAuthState('UNAUTHENTICATED');
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
        setAuthState('UNAUTHENTICATED');
      })
      .finally(() => {
        setLoading(false);
      });
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
    setAuthState('AUTHENTICATING');

    try {
      const result = await loginWithGoogle();
      if (!result) {
        // Redirect initiated
        return;
      }

      console.log('[AUTH] popup success');
      const email = result.user.email;

      const whitelistEntry = await checkStaffWhitelist(email);
      console.log('[AUTH] whitelist verified');
      
      if (!whitelistEntry) {
        logTelemetryEvent('login_failed', { email, reason: 'not_whitelisted' });
        logTelemetryError(new Error(`Staff email ${email} is not in whitelist`), { category: 'auth', isCritical: true });
        await logout();
        setUnauthorizedEmail(email);
        setView('unauthorized');
        setLoading(false);
        setAuthState('UNAUTHENTICATED');
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
    } catch (e) {
      console.error('[Auth] Google Sign-In Error:', e);
      logTelemetryEvent('login_failed', { reason: 'google_popup_error' });
      logTelemetryError(e, { category: 'auth', isCritical: e.message !== 'Login popup was closed. Please try again.' });
      await logout().catch(() => {});
      setError(e.message || 'Sign-in failed. Please try again.');
      setLoading(false);
      setAuthState('UNAUTHENTICATED');
    }
  }

  async function handleSendOtp() {
    if (phone.length < 10) { setError('Enter a valid 10-digit mobile number'); return; }
    setLoading(true);
    setError(null);
    setAuthState('AUTHENTICATING');

    try {
      const result = await sendOtp(phone, 'recaptcha-container');
      setConfirmResult(result);
      setView('otp');
      setLoading(false);
      setAuthState('UNAUTHENTICATED');
    } catch (e) {
      console.error('[Auth] Send OTP Error:', e);
      logTelemetryEvent('login_failed', { reason: 'otp_send_failed' });
      logTelemetryError(e, { category: 'auth', isCritical: true });
      setError(e.message || 'Failed to send OTP. Please try again.');
      setLoading(false);
      setAuthState('UNAUTHENTICATED');
    }
  }

  async function handleVerifyOtp() {
    if (otp.length !== 6) { setError('Enter the 6-digit OTP'); return; }
    setLoading(true);
    setError(null);
    setAuthState('AUTHENTICATING');

    try {
      await verifyOtp(confirmResult, otp);

      // Wait for the profile to load
      let profile = null;
      const MAX_RETRIES = 4;
      const RETRY_DELAY_MS = 800;
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        profile = await refreshProfile();
        if (profile) break;
        console.log(`[Auth] Profile not ready yet, retrying (${attempt}/${MAX_RETRIES})...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      }

      if (profile) {
        logTelemetryEvent('login_success', { role: profile.role });
        navigateByRole(profile.role);
      } else {
        logTelemetryEvent('login_failed', { reason: 'parent_profile_missing' });
        logTelemetryError(new Error('Parent profile missing for verified phone'), { category: 'auth', isCritical: true });
        setError('Your account was not found in our system. Please contact your school admin and ask them to register your phone number in the portal.');
        await logout().catch(() => {});
        setAuthState('UNAUTHENTICATED');
        setLoading(false);
      }
    } catch (e) {
      console.error('[Auth] OTP Verification Error:', e);
      logTelemetryEvent('login_failed', { reason: 'otp_verification_failed' });
      setError(e.message || 'Verification failed. Please try again.');
      await logout().catch(() => {});
      setAuthState('UNAUTHENTICATED');
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
    setAuthState('AUTHENTICATING');
    try {
      await loginWithEmail(email, password);
      const profile = await refreshProfile();
      if (profile) {
        logTelemetryEvent('login_success', { email, role: profile.role });
        navigateByRole(profile.role);
      } else {
        setError('User profile not found in database.');
        await logout();
        setAuthState('UNAUTHENTICATED');
      }
    } catch (err) {
      console.error('[Auth] Test Email Sign-In Error:', err);
      setError(err.message || 'Authentication failed');
      setAuthState('UNAUTHENTICATED');
    } finally {
      setLoading(false);
    }
  }

  if (showMaintenance) {
    return (
      <div className="login-shell">
        <div className="login-bg">
          <div className="login-bg-blob login-bg-blob-1" />
          <div className="login-bg-blob login-bg-blob-2" />
        </div>
        <div className="login-brand-strip">
          <AppLogo variant="login" />
          <span className="login-brand-name">Happy Times</span>
        </div>
        <div className="login-card-wrap">
          <div className="login-card fade-in" style={{ textAlign: 'center', padding: '40px 24px' }}>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>🛠️</div>
            <h1 className="login-card-title" style={{ fontSize: '24px', marginBottom: '12px' }}>Parent Portal Under Maintenance</h1>
            <p className="login-card-sub" style={{ fontSize: '15px', color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '24px' }}>
              {maintenanceSettings.message || "We're currently performing scheduled updates to improve your experience. Please check back shortly."}
            </p>
            
            {(maintenanceSettings.estimatedReturn || maintenanceSettings.contactNumber) && (
              <div style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '28px',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                {maintenanceSettings.estimatedReturn && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '18px' }}>🕒</span>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Estimated Return</div>
                      <div style={{ fontSize: '14px', fontWeight: '600' }}>{maintenanceSettings.estimatedReturn}</div>
                    </div>
                  </div>
                )}
                {maintenanceSettings.contactNumber && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '18px' }}>📞</span>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Support Contact</div>
                      <div style={{ fontSize: '14px', fontWeight: '600' }}>
                        <a href={`tel:${maintenanceSettings.contactNumber}`} style={{ color: 'var(--primary-color)', textDecoration: 'none' }}>
                          {maintenanceSettings.contactNumber}
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            <button
              className="btn btn-outline w-full"
              style={{ height: 50, borderRadius: 'var(--radius-md)' }}
              onClick={async () => {
                setLoading(true);
                try {
                  await logout();
                  window.location.href = '/';
                } catch (err) {
                  console.error('Logout failed:', err);
                  setLoading(false);
                }
              }}
              disabled={loading}
            >
              {loading ? <div className="spinner spinner-sm" /> : 'Logout / Switch Account'}
            </button>
          </div>
        </div>
        <p className="login-footer-text">
          Secure &amp; private · Happy Times Preschool
        </p>
      </div>
    );
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
                  disabled={isAuthenticating}
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
                  disabled={isAuthenticating}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={isAuthenticating}
                style={{ borderRadius: 'var(--radius-md)', height: 52, fontSize: 16, marginTop: '8px' }}
              >
                {isAuthenticating
                  ? <div className="spinner spinner-sm" style={{ borderTopColor: 'white' }} />
                  : 'Sign In ✓'}
              </button>

              <button
                type="button"
                className="login-back-btn"
                onClick={() => { setView('select'); setError(null); }}
                disabled={isAuthenticating}
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
                disabled={isAuthenticating}
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
                  disabled={isAuthenticating}
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
                  onClick={isAuthenticating ? undefined : handleGoogleSignIn}
                  disabled={isAuthenticating}
                >
                  <div className="login-role-icon login-role-icon--staff">
                    {isAuthenticating ? (
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
                  disabled={isAuthenticating}
                />
              </div>

              <div style={{ height: 16 }} />

              <button
                id="send-otp-btn"
                className="btn btn-primary"
                onClick={handleSendOtp}
                disabled={isAuthenticating}
                style={{ borderRadius: 'var(--radius-md)', height: 52, fontSize: 16 }}
              >
                {isAuthenticating ? (
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
                disabled={isAuthenticating}
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
                disabled={isAuthenticating}
              />

              <div style={{ height: 16 }} />

              <button
                id="verify-otp-btn"
                className="btn btn-primary"
                onClick={handleVerifyOtp}
                disabled={isAuthenticating}
                style={{ borderRadius: 'var(--radius-md)', height: 52, fontSize: 16 }}
              >
                {isAuthenticating ? (
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
                  disabled={isAuthenticating}
                >
                  ← Change number
                </button>
                <button
                  className="login-resend-btn"
                  onClick={handleSendOtp}
                  disabled={isAuthenticating}
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
              {/FBAN|FBAV|Instagram|Twitter|Line|WhatsApp|wv\)|GSA\//i.test(navigator.userAgent) && (
                <div style={{ fontSize: '11px', opacity: 0.8, borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '6px', marginTop: '4px', textAlign: 'left', lineHeight: '1.4' }}>
                  💡 <strong>Tip:</strong> You appear to be using an in-app browser (WhatsApp/Instagram). For the best experience, tap the ⋮ menu and select <strong>"Open in Chrome"</strong> or <strong>"Open in Safari"</strong>.
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
