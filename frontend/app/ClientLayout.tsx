'use client';

import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { createTheme } from '@mui/material/styles';
import { AuthProvider } from './context/AuthContext';
import AppLayout from './components/AppLayout';

const theme = createTheme({
  breakpoints: {
    values: {
      xs: 0,
      sm: 800,
      md: 1000,
      lg: 1200,
      xl: 1536,
    }
  }
});

export function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <AppLayout>
          {children}
        </AppLayout>
      </AuthProvider>
    </ThemeProvider>
  );
}
