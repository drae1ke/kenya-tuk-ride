import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from './types';
import { authApi, AuthResponse, BackendAuthUser, getTabSessionId } from './api';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (name: string, email: string, phone: string, password: string, role: 'client' | 'driver') => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  sessions: Array<{ sessionId: string; createdAt: string; lastSeenAt: string; userAgent?: string }>;
  refreshSessions: () => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
  isSubmitting: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);
const TOKEN_KEY = 'tookride.auth.token';

const mapBackendUser = (payload: Pick<AuthResponse['data'], 'user' | 'userType'>): User => {
  const u: BackendAuthUser = payload.user;
  let role: User['role'] = 'client';
  if (payload.userType === 'driver') role = 'driver';
  else if (u.role === 'admin') role = 'admin';
  return {
    id: u._id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role,
    profilePhoto: u.profilePhoto,
    emergencyContact: u.emergencyContact,
    createdAt: new Date().toISOString()
  };
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<Array<{ sessionId: string; createdAt: string; lastSeenAt: string; userAgent?: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const refreshSessions = async () => {
    try {
      const res = await authApi.getSessions();
      setSessions(res.data.sessions || []);
    } catch {
      setSessions([]);
    }
  };

  useEffect(() => {
    getTabSessionId();
    const restore = async () => {
      const token = sessionStorage.getItem(TOKEN_KEY);
      if (!token) { setIsLoading(false); return; }
      try {
        const res = await authApi.me(token);
        setUser(mapBackendUser(res.data));
        await refreshSessions();
      } catch {
        sessionStorage.removeItem(TOKEN_KEY);
      } finally {
        setIsLoading(false);
      }
    };
    restore();
  }, []);

  const login = async (email: string, password: string) => {
    setIsSubmitting(true);
    try {
      const res = await authApi.login({ email, password });
      sessionStorage.setItem(TOKEN_KEY, res.token);
      setUser(mapBackendUser(res.data));
      await refreshSessions();
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || 'Invalid credentials' };
    } finally {
      setIsSubmitting(false);
    }
  };

  const signup = async (name: string, email: string, phone: string, password: string, role: 'client' | 'driver') => {
    setIsSubmitting(true);
    try {
      const res = role === 'driver'
        ? await authApi.registerDriver({
            name, email, phone, password,
            idNumber: `DRV${Date.now()}`,
            licenseNumber: `LIC${Date.now()}`,
            vehicle: { make: 'Bajaj', model: 'RE', year: new Date().getFullYear(), color: 'Green', plateNumber: `TMP${Date.now().toString().slice(-6)}`, type: 'tuktuk', capacity: 3 },
          })
        : await authApi.registerUser({ name, email, phone, password });
      sessionStorage.setItem(TOKEN_KEY, res.token);
      setUser(mapBackendUser(res.data));
      await refreshSessions();
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || 'Registration failed' };
    } finally {
      setIsSubmitting(false);
    }
  };

  const logout = async () => {
    try { await authApi.logoutSession(getTabSessionId()); } catch {}
    sessionStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setSessions([]);
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, sessions, refreshSessions, isAuthenticated: !!user, isLoading, isSubmitting }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
