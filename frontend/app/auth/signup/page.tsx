'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '../../context/AuthContext';

export default function SignUp() {
    const { user, signup, loading } = useAuth();
    const router = useRouter();
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
                <p className="text-muted-foreground">로딩 중...</p>
            </div>
        );
    }

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError('비밀번호가 일치하지 않습니다.');
            return;
        }
        try {
            await signup(username, password, email);
            setError('');
        } catch (err: any) {
            setError(err.response?.data?.message || '회원가입 실패');
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
                    회원가입
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
                        <Label htmlFor="email">이메일</Label>
                        <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            placeholder="이메일을 입력하세요"
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
                    <div className="space-y-2">
                        <Label htmlFor="confirmPassword">비밀번호 확인</Label>
                        <Input
                            id="confirmPassword"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            placeholder="비밀번호를 다시 입력하세요"
                        />
                    </div>
                    <Button type="submit" className="w-full mt-6">
                        회원가입
                    </Button>
                </form>

                <div className="text-center mt-4">
                    <Link
                        href="/auth/signin"
                        className="text-muted-foreground hover:text-primary transition-colors text-sm"
                    >
                        이미 계정이 있으신가요? 로그인
                    </Link>
                </div>
            </div>
        </div>
    );
}
