'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { usersRouterLogin, usersRouterSignup, usersRouterMe } from '../services/api';
import { AxiosError } from 'axios';

interface User {
  id: number;
  username: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  signup: (username: string, password: string, email: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('AuthProvider useEffect');
    const token = localStorage.getItem('token');
    console.log('Token in localStorage:', token);
    if (token) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUser = async () => {
    console.log('fetchUser called');
    try {
      const response = await usersRouterMe();
      console.log('usersRouterMe response:', response);
      setUser(response);
    } catch (error: any) {
      console.error('fetchUser error:', error);
      if (error.response?.status === 401) {
        // 토큰 만료
        localStorage.removeItem('token');
        // 쿠키에서도 제거
        document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        setUser(null);
      } else {
        // 다른 에러
        console.error('사용자 정보 로드 실패:', error);
      }
    } finally {
      console.log('fetchUser finally, setting loading to false');
      setLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    const response = await usersRouterLogin({
      username,
      password,
    });
    const { token, user } = response;
    localStorage.setItem('token', token);
    // 쿠키에도 저장 (middleware에서 사용)
    document.cookie = `token=${token}; path=/; max-age=86400`; // 24시간
    setUser(user);
  };

  const signup = async (username: string, password: string, email: string) => {
    const response = await usersRouterSignup({
      username,
      password,
      email,
    });
    const { token, user } = response;
    localStorage.setItem('token', token);
    // 쿠키에도 저장 (middleware에서 사용)
    document.cookie = `token=${token}; path=/; max-age=86400`; // 24시간
    setUser(user);
  };

  const logout = () => {
    localStorage.removeItem('token');
    // 쿠키에서도 제거
    document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
