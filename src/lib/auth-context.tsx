import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from './types';
import { authApi, AuthResponse, BackendAuthUser } from './api';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string, role: 'client' | 'driver') => Promise<boolean>;
  signup: (name: string, email: string, phone: string, password: string, role: 'client' | 'driver') => Promise<boolean>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);
const TOKEN_STORAGE_KEY = 'tookride.auth.token';

const mapBackendUserToUi = (
  authPayload: Pick<AuthResponse['data'], 'user' | 'userType'>
): User => {
  const backendUser: BackendAuthUser = authPayload.user;

  let role: User['role'] = 'client';
  if (authPayload.userType === 'driver') {
    role = 'driver';
  } else if (backendUser.role === 'admin') {
    role = 'admin';
  }

  return {
    id: backendUser._id,
    name: backendUser.name,
    email: backendUser.email,
    phone: backendUser.phone,
    role,
    createdAt: new Date().toISOString(),
  };
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      const token = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await authApi.me(token);
        setUser(mapBackendUserToUi(response.data));
      } catch {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);

  const login = async (email: string, password: string, role: 'client' | 'driver'): Promise<boolean> => {
    try {
      const response = role === 'driver'
        ? await authApi.loginDriver({ email, password })
        : await authApi.loginUser({ email, password });
      localStorage.setItem(TOKEN_STORAGE_KEY, response.token);
      setUser(mapBackendUserToUi(response.data));
      return true;
    } catch {
      return false;
    }
  };

  const signup = async (
    name: string,
    email: string,
    phone: string,
    password: string,
    role: 'client' | 'driver'
  ): Promise<boolean> => {
    try {
      const response = role === 'driver'
        ? await authApi.registerDriver({
            name,
            email,
            phone,
            password,
            idNumber: `DRV${Date.now()}`,
            licenseNumber: `LIC${Date.now()}`,
            vehicle: {
              make: 'Bajaj',
              model: 'RE',
              year: new Date().getFullYear(),
              color: 'Green',
              plateNumber: `TMP${Date.now().toString().slice(-6)}`,
              type: 'tuktuk',
              capacity: 3,
            },
          })
        : await authApi.registerUser({ name, email, phone, password });
      localStorage.setItem(TOKEN_STORAGE_KEY, response.token);
      setUser(mapBackendUserToUi(response.data));
      return true;
    } catch {
      return false;
    }
  };

  const logout = async () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setUser(null);
  };


  return (
    <AuthContext.Provider value={{ user, login, signup, logout, isAuthenticated: !!user, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
