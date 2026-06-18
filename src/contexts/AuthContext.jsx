import { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../config/firebase.js';
import { onAuthStateChanged } from 'firebase/auth';
import { fetchProfile, fetchMaintenanceSettings } from '../services/profileService.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);                  // Firebase user
  const [profile, setProfile] = useState(null);             // Firestore user profile
  const [authState, setAuthState] = useState('BOOTING');    // BOOTING | UNAUTHENTICATED | AUTHENTICATING | PROFILE_LOADING | AUTHENTICATED | PROFILE_ERROR
  const [maintenanceSettings, setMaintenanceSettings] = useState({
    enabled: false,
    message: 'System maintenance in progress',
    estimatedReturn: '',
    contactNumber: ''
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        setAuthState('PROFILE_LOADING');
        try {
          // Fetch global maintenance settings
          const maint = await fetchMaintenanceSettings();
          setMaintenanceSettings(maint);

          // Fetch profile using profileService
          const profileData = await fetchProfile(firebaseUser.uid, firebaseUser);
          setProfile(profileData);
          
          if (profileData) {
            setAuthState('AUTHENTICATED');
          } else {
            setAuthState('PROFILE_ERROR');
          }
        } catch (e) {
          console.error('[AuthContext] Auth listener profile load failed:', e);
          setProfile(null);
          setAuthState('PROFILE_ERROR');
        }
      } else {
        setUser(null);
        setProfile(null);
        setAuthState('UNAUTHENTICATED');
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user && profile && authState === 'AUTHENTICATED') {
      import('../services/notifications.js')
        .then(({ initNotifications }) => initNotifications())
        .catch(err => console.error('[AuthContext] Failed to initialize notifications:', err));
    }
  }, [user, profile, authState]);

  useEffect(() => {
    if (!user || !profile || authState !== 'AUTHENTICATED') return;

    // session inactivity timeouts
    let timeoutMs = 0;
    if (profile.role === 'superadmin') {
      timeoutMs = 20 * 60 * 1000; // 20 mins
    } else if (profile.role === 'branchadmin') {
      timeoutMs = 30 * 60 * 1000; // 30 mins
    } else {
      return; // parents session remains persistent
    }

    let inactivityTimer = null;

    const resetTimer = () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        console.warn(`[Security] Admin session expired due to inactivity (${profile.role}). Logging out.`);
        import('../services/authService.js').then(({ logout }) => {
          logout().then(() => {
            window.location.href = '/';
          });
        });
      }, timeoutMs);
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, resetTimer));

    resetTimer();

    return () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [user, profile, authState]);

  const retryProfileLoad = async () => {
    if (!auth.currentUser) {
      setAuthState('UNAUTHENTICATED');
      return null;
    }
    setAuthState('PROFILE_LOADING');
    try {
      const maint = await fetchMaintenanceSettings();
      setMaintenanceSettings(maint);

      const profileData = await fetchProfile(auth.currentUser.uid, auth.currentUser);
      setProfile(profileData);
      if (profileData) {
        setAuthState('AUTHENTICATED');
      } else {
        setAuthState('PROFILE_ERROR');
      }
      return profileData;
    } catch (e) {
      console.error('[AuthContext] retryProfileLoad failed:', e);
      setProfile(null);
      setAuthState('PROFILE_ERROR');
      return null;
    }
  };

  const refreshProfile = async () => {
    return await retryProfileLoad();
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      authState, 
      setAuthState, 
      maintenanceSettings, 
      setMaintenanceSettings,
      refreshProfile, 
      retryProfileLoad 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

