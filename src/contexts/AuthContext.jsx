import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import api from '../lib/api';
import { seedLocalDatabase, clearLocalDatabase } from '../lib/db';
import { notifySync } from '../lib/syncState';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('core_gym_user');
    return saved ? JSON.parse(saved) : null;
  });

  const login = useCallback(async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const data = response.data;
      
      if (data.success) {
        await clearLocalDatabase();
        const gymUser = { 
          email, 
          role: data.role, 
          name: data.role === 'admin' ? 'Super Admin' : data.gym.owner_name, 
          gym_id: data.gym?.id,
          token: data.token
        };
        localStorage.setItem('core_gym_user', JSON.stringify(gymUser));
        setUser(gymUser);
        
        // Seed the database after login (only when online)
        if (gymUser.role === 'gym_owner' && navigator.onLine) {
          seedLocalDatabase();
        }
        
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
    // 1. Signal busy immediately to prevent dashboard "zero flicker"
    notifySync(true); 
    
    await clearLocalDatabase();
    const gymUser = { 
      email: data.gym.email, 
      role: data.role, 
      name: data.gym.owner_name, 
      gym_id: data.gym.id,
      token: data.token
    };
    localStorage.setItem('core_gym_user', JSON.stringify(gymUser));
    setUser(gymUser);
    
    // 2. Start the seeding process (it will call notifySync(false) when done)
    if (navigator.onLine) {
      seedLocalDatabase();
    }
  }, []);

  // ── Database Safeguard: Seed if empty on mount ──
  useEffect(() => {
    async function checkAndSeed() {
      if (user?.role === 'gym_owner' && navigator.onLine) {
        try {
          const { db } = await import('../lib/db');
          const count = await db.members.count();
          if (count === 0) {
            console.log('[Auth] Local DB is empty, triggering initial seed...');
            seedLocalDatabase();
          }
        } catch (err) {
          console.error('[Auth] Initial seed check failed', err);
        }
      }
    }
    checkAndSeed();
  }, [user?.role]);

  const logout = useCallback(async () => {
    localStorage.removeItem('core_gym_user');
    setUser(null);
    await clearLocalDatabase();
  }, []);

  // NOTE: seedLocalDatabase is no longer called on every page load.
  // It is called only on fresh login (above) and after sync completes (in useSync.js).
  // This prevents wiping offline data when the page reloads while online.

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
