'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '../../context/AuthContext';

export default function SignIn() {
  const { user, login, loading } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      router.push('/home');
    }
  }, [user, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">로딩 중...</p>
      </div>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(username, password);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.detail || '로그인 실패');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className={cn(
        "w-full max-w-md p-8 rounded-2xl",
        "bg-card/80 backdrop-blur-xl",
        "border border-border shadow-2xl"
      )}>
        <h1 className={cn(
          "text-3xl font-bold text-center mb-6",
          "bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent"
        )}>
          로그인
        </h1>

        {error && (
          <div className={cn(
            "mb-4 p-3 rounded-lg",
            "bg-destructive/15 border border-destructive/30",
            "text-destructive text-sm"
          )}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">사용자명</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="사용자명을 입력하세요"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">비밀번호</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="비밀번호를 입력하세요"
            />
          </div>
          <Button type="submit" className="w-full mt-6">
            로그인
          </Button>
        </form>

        <div className="text-center mt-4">
          <Link
            href="/auth/signup"
            className="text-muted-foreground hover:text-primary transition-colors text-sm"
          >
            계정이 없으신가요? 회원가입
          </Link>
        </div>
      </div>
    </div>
  );
}
