'use client';

import React, { createContext, useContext, useState, useEffect, useLayoutEffect, ReactNode } from 'react';
import { usersRouterLogin, usersRouterSignup, usersRouterMe } from '@/services/api';
import { AxiosError } from 'axios';
import { useTabStore } from '@/stores/tabStore';

export interface User {
  id: number;
  username: string;
  email: string;
  is_staff: boolean;
  is_superuser: boolean;
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
  initialUser?: User | null;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children, initialUser }) => {
  // 서버에서 초기 사용자 정보가 전달되면 바로 설정 (플래시 방지)
  const [user, setUser] = useState<User | null>(initialUser ?? null);
  // initialUser가 있으면 로딩 상태 false로 시작
  const [loading, setLoading] = useState(!initialUser);
  const { initializeForUser, clearForLogout } = useTabStore();

  useEffect(() => {
    // 서버에서 이미 사용자 정보를 받았으면 추가 fetch 불필요
    if (initialUser) {
      return;
    }

    const token = localStorage.getItem('token');
    if (token) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [initialUser]);

  // 유저가 변경되면 탭스토어 초기화 (useLayoutEffect로 플래시 방지)
  useLayoutEffect(() => {
    if (user) {
      initializeForUser(user.id);
    }
  }, [user, initializeForUser]);

  const fetchUser = async () => {
    try {
      const response = await usersRouterMe();
      setUser(response);
    } catch (error: any) {
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
    document.cookie = `token=${token}; path=/; max-age=30585600`; // 24시간
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
    // 탭스토어 초기화
    clearForLogout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
