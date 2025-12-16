'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../stores/languageStore';

export default function SignUp() {
    const { user, signup, loading } = useAuth();
    const router = useRouter();
    const { t } = useTranslation();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [email, setEmail] = useState('');
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

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError(t.errors.passwordMismatch);
            return;
        }
        try {
            await signup(username, password, email);
            setError('');
        } catch (err: any) {
            setError(err.response?.data?.message || t.errors.unknownError);
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
                    {t.auth.signUp}
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

                <form onSubmit={handleSignup} className="space-y-4">
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
                        <Label htmlFor="email">{t.auth.email}</Label>
                        <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            placeholder={t.auth.email}
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
                    <div className="space-y-2">
                        <Label htmlFor="confirmPassword">{t.auth.confirmPassword}</Label>
                        <Input
                            id="confirmPassword"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            placeholder={t.auth.confirmPassword}
                        />
                    </div>
                    <Button type="submit" className="w-full mt-6">
                        {t.auth.signUp}
                    </Button>
                </form>

                <div className="text-center mt-4">
                    <Link
                        href="/auth/signin"
                        className="text-muted-foreground hover:text-primary transition-colors text-sm"
                    >
                        {t.auth.hasAccount} {t.auth.signIn}
                    </Link>
                </div>
            </div>
        </div>
    );
}
