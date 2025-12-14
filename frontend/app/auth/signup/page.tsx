'use client';

import React, { useState, useEffect } from 'react';
import { Button, Typography, Container, Box, TextField, Alert, Link } from '@mui/material';
import { useRouter } from 'next/navigation';
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
            <Container maxWidth="sm">
                <Box sx={{ my: 4 }}>
                    <Typography>로딩 중...</Typography>
                </Box>
            </Container>
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
        <Container maxWidth="sm">
            <Box sx={{ my: 4 }}>
                <Typography variant="h4" component="h1" gutterBottom>
                    회원가입
                </Typography>

                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                <form onSubmit={handleSignup}>
                    <TextField
                        fullWidth
                        margin="normal"
                        label="사용자명"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                    />
                    <TextField
                        fullWidth
                        margin="normal"
                        label="이메일"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                    <TextField
                        fullWidth
                        margin="normal"
                        label="비밀번호"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                    <TextField
                        fullWidth
                        margin="normal"
                        label="비밀번호 확인"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                    />
                    <Button
                        type="submit"
                        fullWidth
                        variant="contained"
                        sx={{ mt: 3, mb: 2 }}
                    >
                        회원가입
                    </Button>
                </form>

                <Box sx={{ textAlign: 'center' }}>
                    <Link href="/auth/signin" variant="body2">
                        이미 계정이 있으신가요? 로그인
                    </Link>
                </Box>
            </Box>
        </Container>
    );
}