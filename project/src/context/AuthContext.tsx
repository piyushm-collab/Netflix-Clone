import React, { createContext, useState, useEffect, useContext } from 'react';
import apiClient from '../lib/apiClient';

interface NetflixUser {
  id: string;
  email: string;
  fullName: string;
  subscription: { planName: string; amountPaise: number; activatedAt: string; transactionId: string } | null;
  createdAt?: string;
}

interface AuthContextType {
  user: NetflixUser | null;
  loading: boolean;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<NetflixUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('netflix_token');
    if (!token) {
      setLoading(false);
      return;
    }
    apiClient
      .get('/auth/me')
      .then((res) => setUser(res.data))
      .catch(() => {
        localStorage.removeItem('netflix_token');
        localStorage.removeItem('netflix_user');
      })
      .finally(() => setLoading(false));
  }, []);

  const signOut = () => {
    localStorage.removeItem('netflix_token');
    localStorage.removeItem('netflix_user');
    setUser(null);
    window.location.href = '/';
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
