'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from '@/stores/languageStore';

export default function SignIn() {
  const { user, login, loading } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
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
        <p className="text-muted-foreground">{t.common.loading}</p>
      </div>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(username, password);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.detail || t.errors.unknownError);
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
          {t.auth.signIn}
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
            <Label htmlFor="username">{t.auth.username}</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder={t.auth.username}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t.auth.password}</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder={t.auth.password}
            />
          </div>
          <Button type="submit" className="w-full mt-6">
            {t.auth.signIn}
          </Button>
        </form>

        <div className="text-center mt-4">
          <Link
            href="/auth/signup"
            className="text-muted-foreground hover:text-primary transition-colors text-sm"
          >
            {t.auth.noAccount} {t.auth.signUp}
          </Link>
        </div>
      </div>
    </div>
  );
}
