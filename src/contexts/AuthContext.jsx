import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import api from '../lib/api';
import { STORAGE_KEYS, PRESERVED_KEYS } from '../lib/storageKeys';

/**
 * Wipe every localStorage entry except the viewer's display preferences.
 *
 * This was three inlined copies of the same loop, each with
 * `keysToKeep = ['core_gym_theme']` — a key the theme system never writes. The
 * real keys are the accent preset and light/dark mode, so signing in or out
 * silently reset the user's theme every time.
 */
function clearSessionStorage() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && !PRESERVED_KEYS.includes(key)) localStorage.removeItem(key);
    }
  } catch {
    // Storage unavailable (private mode); nothing to clear.
  }
}


const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.user);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null; // corrupt or unreadable — treat as signed out
    }
  });

  const login = useCallback(async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const data = response.data;

      if (data.success) {
        clearSessionStorage();

        const gymUser = {
          email,
          role: data.role,
          name: data.role === 'admin' ? 'Super Admin' : data.gym.owner_name,
          gym_id: data.gym?.id,
          gym_name: data.gym?.gym_name,
          // Locale settings drive useMoney() and every date boundary. Without
          // them here, every gym would fall back to PKR / Asia/Karachi.
          currency: data.gym?.currency || 'PKR',
          locale: data.gym?.locale || undefined,
          timezone: data.gym?.timezone || undefined,
          plan_type: data.gym?.plan_type,
          billing_status: data.gym?.billing_status,
          trial_ends_at: data.gym?.trial_ends_at,
          subscription_ends_at: data.gym?.subscription_ends_at,
          token: data.token
        };
        localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(gymUser));
        setUser(gymUser);



        return { success: true, role: data.role };
      }
      return { success: false, error: 'Login failed' };
    } catch (err) {
      if (err.response && err.response.data && err.response.data.message) {
        return { success: false, error: err.response.data.message };
      }
      return { success: false, error: 'Network error or backend is not running.' };
    }
  }, []);

  const switchSession = useCallback(async (data) => {

    clearSessionStorage();

    const gymUser = {
      email: data.gym.email,
      role: data.role,
      name: data.gym.owner_name,
      gym_id: data.gym.id,
      gym_name: data.gym.gym_name,
      currency: data.gym.currency || 'PKR',
      locale: data.gym.locale || undefined,
      timezone: data.gym.timezone || undefined,
      plan_type: data.gym.plan_type,
      billing_status: data.gym.billing_status,
      trial_ends_at: data.gym.trial_ends_at,
      subscription_ends_at: data.gym.subscription_ends_at,
      token: data.token
    };
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(gymUser));
    setUser(gymUser);


  }, []);


  const logout = useCallback(async () => {

    clearSessionStorage();
    setUser(null);

  }, []);



  // Active session polling for suspension check
  useEffect(() => {
    if (!user || user.role !== 'gym_owner') return;

    const interval = setInterval(async () => {
      try {
        await api.get('/auth/verify');
      } catch (err) {
        // Global interceptor handles the logout automatically
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [user]);

  // ── Session Verification: Check suspension on mount/refresh ──
  // Deliberately runs once at mount. useRef's initialiser captures the session
  // restored from localStorage, which is exactly what this check needs — later
  // sign-ins are covered by the 30s polling effect above.
  const userRef = useRef(user);
  useEffect(() => {
    const current = userRef.current;
    if (current && current.role === 'gym_owner' && navigator.onLine) {
      api.get('/auth/verify').catch(() => {
        // Interceptor handles logout if suspended
      });
    }
  }, []);

  const isAdmin = user?.role === 'admin';
  const isGymOwner = user?.role === 'gym_owner';

  return (
    <AuthContext.Provider value={{ user, login, logout, switchSession, isAdmin, isGymOwner, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
