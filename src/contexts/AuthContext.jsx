import { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../config/firebase.js';
import { onAuthStateChanged } from 'firebase/auth';
import { getUserProfile } from '../services/firestore.js';
import { activateParentProfile } from '../services/activateParentProfile.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);        // Firebase user
  const [profile, setProfile] = useState(null);   // Firestore user profile
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          let data = await getUserProfile(firebaseUser.uid);
          if (!data && firebaseUser.phoneNumber) {
            console.log('[AuthContext] No user profile found for parent login. Attempting auto-activation...');
            const activatedProfile = await activateParentProfile(firebaseUser);
            if (activatedProfile) {
              data = activatedProfile;
            }
          }
          setProfile(data);
        } catch (e) {
          console.error('Profile fetch/activation failed:', e);
          setProfile(null);
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user && profile) {
      import('../services/notifications.js')
        .then(({ initNotifications }) => initNotifications())
        .catch(err => console.error('[AuthContext] Failed to initialize notifications:', err));
    }
  }, [user, profile]);

  useEffect(() => {
    if (!user || !profile) return;

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
        auth.signOut().then(() => {
          window.location.href = '/login';
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
  }, [user, profile]);

  const refreshProfile = async () => {
    if (!auth.currentUser) return null;
    const data = await getUserProfile(auth.currentUser.uid);
    setProfile(data);
    return data;
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, setProfile, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
