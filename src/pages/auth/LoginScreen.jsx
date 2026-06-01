import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../../config/firebase.js';
import {
  signInWithPopup,
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
      const result = await signInWithPopup(auth, provider);
      const email = result.user.email;

      // Check whitelist
      const whitelistEntry = await checkStaffWhitelist(email);
      if (!whitelistEntry) {
        await auth.signOut();
        setUnauthorizedEmail(email);
        setView('unauthorized');
        setLoading(false);
        return;
      }

      // Create or update user profile in Firestore
      await createOrUpdateUser(result.user.uid, {
        email,
        name: result.user.displayName || email,
        role: whitelistEntry.role,
        branchId: whitelistEntry.branchId || null,
        lastLogin: new Date(),
      });

      const profile = await refreshProfile();
      if (profile) {
        navigateByRole(profile.role);
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
    if (phone.length < 10) { setError('Enter a valid phone number'); return; }
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
    <div className="page-shell">
      <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: '40px' }} />

        {/* Logo */}
        <div style={{
          width: 64, height: 64,
          background: 'linear-gradient(135deg, #E8451A, #F5A623)',
          borderRadius: 'var(--radius-lg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(232,69,26,0.3)',
        }}>
          <span style={{ color: 'white', fontWeight: 800, fontSize: 18, letterSpacing: -0.5 }}>HT</span>
        </div>

        <div style={{ height: '24px' }} />

        {/* ── UNAUTHORIZED VIEW ── */}
        {view === 'unauthorized' && (
          <div className="fade-in">
            <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-dark)' }}>
              Unauthorized
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 6 }}>
              The account <strong>{unauthorizedEmail}</strong> is not registered as staff at Happy Times Preschool.
            </p>
            <div style={{ height: '24px' }} />
            <div className="alert-error">
              <span>🔒</span>
              <span>Please contact the Super Admin to get your account whitelisted.</span>
            </div>
            <div style={{ height: '24px' }} />
            <button
              className="btn btn-outline w-full"
              onClick={() => { setView('select'); setError(null); }}
            >← Back to login</button>
          </div>
        )}

        {view !== 'unauthorized' && (
          <>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-dark)' }}>
              {view === 'otp' ? 'Enter OTP' : view === 'phone' ? 'Parent Login' : 'Welcome!'}
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 6 }}>
              {view === 'otp'
                ? `Sent to +91 ${phone}`
                : view === 'phone'
                ? 'Enter your registered mobile number'
                : 'Happy Times Preschool & Montessori'}
            </p>

            <div style={{ height: '40px' }} />

            {/* ── SELECT VIEW ── */}
            {view === 'select' && (
              <div className="flex flex-col gap-12 fade-in">
                <button
                  id="login-parent"
                  className="card card-interactive"
                  onClick={() => setView('phone')}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', textAlign: 'left' }}
                >
                  <div style={{
                    width: 46, height: 46, borderRadius: 12,
                    background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--primary)', fontSize: 22,
                  }}>📱</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-dark)' }}>I'm a Parent</div>
                    <div style={{ fontSize: 12, color: 'var(--text-hint)', marginTop: 2 }}>Sign in with mobile number + OTP</div>
                  </div>
                  <span style={{ color: 'var(--primary)', fontSize: 18 }}>›</span>
                </button>

                <button
                  id="login-staff"
                  className="card card-interactive"
                  onClick={loading ? undefined : handleGoogleSignIn}
                  disabled={loading}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', textAlign: 'left', opacity: loading ? 0.6 : 1 }}
                >
                  <div style={{
                    width: 46, height: 46, borderRadius: 12,
                    background: 'var(--info-light)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--info)', fontSize: 22,
                  }}>👤</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-dark)' }}>I'm Staff</div>
                    <div style={{ fontSize: 12, color: 'var(--text-hint)', marginTop: 2 }}>Admins — sign in with Google</div>
                  </div>
                  {loading ? <div className="spinner spinner-sm" /> : <span style={{ color: 'var(--info)', fontSize: 18 }}>›</span>}
                </button>
              </div>
            )}

            {/* ── PHONE VIEW ── */}
            {view === 'phone' && (
              <div className="flex flex-col gap-20 fade-in">
                <div style={{
                  display: 'flex', border: '1px solid rgba(26,35,64,0.12)',
                  borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'white',
                }}>
                  <div style={{
                    padding: '14px', borderRight: '1px solid rgba(26,35,64,0.12)',
                    fontWeight: 600, fontSize: 15, color: 'var(--primary)',
                  }}>+91</div>
                  <input
                    id="phone-input"
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="Mobile number"
                    style={{
                      flex: 1, border: 'none', padding: '14px', fontSize: 16,
                      color: 'var(--text-dark)', outline: 'none', background: 'transparent',
                      fontFamily: 'var(--font)',
                    }}
                  />
                </div>
                <button
                  id="send-otp-btn"
                  className="btn btn-primary"
                  onClick={handleSendOtp}
                  disabled={loading}
                >
                  {loading ? <div className="spinner spinner-sm" style={{ borderTopColor: 'white' }} /> : 'Send OTP'}
                </button>
                <button
                  onClick={() => { setView('select'); setError(null); }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 14 }}
                >← Back</button>
              </div>
            )}

            {/* ── OTP VIEW ── */}
            {view === 'otp' && (
              <div className="flex flex-col gap-20 fade-in">
                <input
                  id="otp-input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="------"
                  style={{
                    textAlign: 'center', fontSize: 28, fontWeight: 700,
                    letterSpacing: 12, padding: '14px', border: '1px solid rgba(26,35,64,0.12)',
                    borderRadius: 'var(--radius-md)', color: 'var(--text-dark)',
                    outline: 'none', background: 'white', fontFamily: 'var(--font)',
                  }}
                />
                <button
                  id="verify-otp-btn"
                  className="btn btn-primary"
                  onClick={handleVerifyOtp}
                  disabled={loading}
                >
                  {loading ? <div className="spinner spinner-sm" style={{ borderTopColor: 'white' }} /> : 'Verify OTP'}
                </button>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <button
                    onClick={() => { setView('phone'); setOtp(''); setError(null); }}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 14 }}
                  >← Change number</button>
                  <button
                    onClick={handleSendOtp}
                    disabled={loading}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 14 }}
                  >Resend OTP</button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Error */}
        {error && (
          <div className="alert-error mt-16">
            <span>⚠</span>
            <span>{error}</span>
          </div>
        )}

        <div id="recaptcha-container" />
      </div>
    </div>
  );
}
