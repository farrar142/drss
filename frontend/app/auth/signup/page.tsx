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
import { usersRouterGetSignupStatus } from '@/services/api';
import { UserX } from 'lucide-react';

export default function SignUp() {
    const { user, signup, loading } = useAuth();
    const router = useRouter();
    const { t } = useTranslation();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [signupAllowed, setSignupAllowed] = useState<boolean | null>(null);
    const [checkingStatus, setCheckingStatus] = useState(true);

    // 회원가입 허용 상태 확인
    useEffect(() => {
        const checkSignupStatus = async () => {
            try {
                const status = await usersRouterGetSignupStatus();
                setSignupAllowed(status.allow_signup);
            } catch {
                // 에러 시 기본적으로 허용
                setSignupAllowed(true);
            } finally {
                setCheckingStatus(false);
            }
        };
        checkSignupStatus();
    }, []);

    useEffect(() => {
        if (user) {
            router.push('/home');
        }
    }, [user, router]);

    if (loading || checkingStatus) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="text-muted-foreground">{t.common.loading}</p>
            </div>
        );
    }

    // 회원가입이 비활성화된 경우
    if (signupAllowed === false) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <div className={cn(
                    "w-full max-w-md p-8 rounded-2xl",
                    "bg-card/80 backdrop-blur-xl",
                    "border border-border shadow-2xl text-center"
                )}>
                    <UserX className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                    <h1 className="text-2xl font-bold mb-2">
                        {t.auth.signupDisabled || '회원가입 비활성화'}
                    </h1>
                    <p className="text-muted-foreground mb-6">
                        {t.auth.signupDisabledMessage || '현재 새로운 회원가입이 비활성화되어 있습니다. 관리자에게 문의하세요.'}
                    </p>
                    <Link href="/auth/signin">
                        <Button variant="outline">
                            {t.auth.signIn}
                        </Button>
                    </Link>
                </div>
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
