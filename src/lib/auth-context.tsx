import React, { createContext, useContext, useState, ReactNode } from 'react';
import { User, UserRole } from './types';
import { mockClient, mockDrivers, mockAdmin } from './mock-data';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => boolean;
  signup: (name: string, email: string, phone: string, password: string, role: 'client' | 'driver') => boolean;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);

  const login = (email: string, _password: string): boolean => {
    // Mock login - check against test data
    if (email === mockAdmin.email) {
      setUser(mockAdmin);
      return true;
    }
    if (email === mockClient.email) {
      setUser(mockClient);
      return true;
    }
    const driver = mockDrivers.find(d => d.email === email);
    if (driver) {
      setUser(driver);
      return true;
    }
    // Allow any email to login as client for demo
    setUser({
      id: 'demo-' + Date.now(),
      name: email.split('@')[0],
      email,
      phone: '+254700000000',
      role: 'client',
      createdAt: new Date().toISOString(),
    });
    return true;
  };

  const signup = (name: string, email: string, phone: string, _password: string, role: 'client' | 'driver'): boolean => {
    setUser({
      id: 'new-' + Date.now(),
      name,
      email,
      phone,
      role,
      createdAt: new Date().toISOString(),
    });
    return true;
  };

  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
