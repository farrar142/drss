'use client';

import React, { useState, useEffect } from 'react';
import { Button, Typography, Container, Box, TextField, Alert, Link } from '@mui/material';
import { useRouter } from 'next/navigation';
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
            <Container maxWidth="sm">
                <Box sx={{ my: 4 }}>
                    <Typography>로딩 중...</Typography>
                </Box>
            </Container>
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
        <Container maxWidth="sm">
            <Box sx={{ my: 4 }}>
                <Typography variant="h4" component="h1" gutterBottom>
                    로그인
                </Typography>

                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                <form onSubmit={handleLogin}>
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
                        label="비밀번호"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                    <Button
                        type="submit"
                        fullWidth
                        variant="contained"
                        sx={{ mt: 3, mb: 2 }}
                    >
                        로그인
                    </Button>
                </form>

                <Box sx={{ textAlign: 'center' }}>
                    <Link href="/auth/signup" variant="body2">
                        계정이 없으신가요? 회원가입
                    </Link>
                </Box>
            </Box>
        </Container>
    );
}