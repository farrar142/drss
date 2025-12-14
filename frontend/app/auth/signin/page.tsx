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

    const textFieldSx = {
        '& .MuiOutlinedInput-root': {
            color: '#fff',
            '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
            '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.5)' },
            '&.Mui-focused fieldset': { borderColor: '#667eea' },
        },
        '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.7)' },
    };

    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                p: 2,
            }}
        >
            <Box
                sx={{
                    width: '100%',
                    maxWidth: 420,
                    p: 4,
                    background: 'rgba(255, 255, 255, 0.1)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: 4,
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
                }}
            >
                <Typography
                    variant="h4"
                    component="h1"
                    gutterBottom
                    sx={{
                        textAlign: 'center',
                        fontWeight: 700,
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        mb: 3,
                    }}
                >
                    로그인
                </Typography>

                {error && (
                    <Alert
                        severity="error"
                        sx={{
                            mb: 2,
                            background: 'rgba(244, 67, 54, 0.15)',
                            border: '1px solid rgba(244, 67, 54, 0.3)',
                            color: '#ff6b6b',
                        }}
                    >
                        {error}
                    </Alert>
                )}

                <form onSubmit={handleLogin}>
                    <TextField
                        fullWidth
                        margin="normal"
                        label="사용자명"
                        variant="outlined"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        sx={textFieldSx}
                    />
                    <TextField
                        fullWidth
                        margin="normal"
                        label="비밀번호"
                        type="password"
                        variant="outlined"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        sx={textFieldSx}
                    />
                    <Button
                        type="submit"
                        fullWidth
                        variant="contained"
                        sx={{
                            mt: 3,
                            mb: 2,
                            py: 1.5,
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            borderRadius: 2,
                            textTransform: 'none',
                            fontWeight: 600,
                            fontSize: '1rem',
                            boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
                            '&:hover': {
                                background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)',
                                boxShadow: '0 6px 20px rgba(102, 126, 234, 0.5)',
                            },
                        }}
                    >
                        로그인
                    </Button>
                </form>

                <Box sx={{ textAlign: 'center', mt: 2 }}>
                    <Link
                        href="/auth/signup"
                        sx={{
                            color: 'rgba(255, 255, 255, 0.7)',
                            textDecoration: 'none',
                            '&:hover': {
                                color: '#667eea',
                            },
                        }}
                    >
                        계정이 없으신가요? 회원가입
                    </Link>
                </Box>
            </Box>
        </Box>
    );
}
