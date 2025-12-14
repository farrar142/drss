'use client';

import React, { useState } from 'react';
import { Button, Typography, Container, Box, TextField, Tab, Tabs, Alert } from '@mui/material';
import { useAuth } from './context/AuthContext';
import RSSDashboard from './components/RSSDashboard';

export default function Home() {
  const { user, login, signup, logout, loading } = useAuth();
  const [tab, setTab] = useState(0);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  if (loading) {
    return <Container maxWidth="sm"><Box sx={{ my: 4 }}><Typography>로딩 중...</Typography></Box></Container>;
  }

  if (user) {
    return <RSSDashboard />;
  }

  const handleLogin = async () => {
    try {
      await login(username, password);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.detail || '로그인 실패');
    }
  };

  const handleSignup = async () => {
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
          인증 시스템
        </Typography>
        <Tabs value={tab} onChange={(e, newValue) => setTab(newValue)}>
          <Tab label="로그인" />
          <Tab label="회원가입" />
        </Tabs>
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        {tab === 0 && (
          <Box sx={{ mt: 2 }}>
            <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
              <TextField
                fullWidth
                label="사용자명"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                margin="normal"
              />
              <TextField
                fullWidth
                label="비밀번호"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                margin="normal"
              />
              <Button type="submit" variant="contained" color="primary" sx={{ mt: 2 }}>
                로그인
              </Button>
            </form>
          </Box>
        )}
        {tab === 1 && (
          <Box sx={{ mt: 2 }}>
            <form onSubmit={(e) => { e.preventDefault(); handleSignup(); }}>
              <TextField
                fullWidth
                label="사용자명"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                margin="normal"
              />
              <TextField
                fullWidth
                label="이메일"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                margin="normal"
              />
              <TextField
                fullWidth
                label="비밀번호"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                margin="normal"
              />
              <TextField
                fullWidth
                label="비밀번호 확인"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                margin="normal"
              />
              <Button type="submit" variant="contained" color="primary" sx={{ mt: 2 }}>
                회원가입
              </Button>
            </form>
          </Box>
        )}
      </Box>
    </Container>
  );
}
