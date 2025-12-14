'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Container, Box, Typography } from '@mui/material';
import { useAuth } from './context/AuthContext';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  console.log('Home component rendered', { loading, user });
  useEffect(() => {
    console.log('useEffect triggered', { loading, user });
    if (!loading) {
      if (user) {
        router.push('/home');
      } else {
        router.push('/auth/signin');
      }
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <Container maxWidth="sm">
        <Box sx={{ my: 4 }}>
          <Typography>로딩 중...</Typography>
        </Box>
      </Container>
    );
  }

  return <></>;
}
