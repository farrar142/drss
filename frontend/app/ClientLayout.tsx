'use client';

import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { createTheme } from '@mui/material/styles';
import { AuthProvider } from './context/AuthContext';
import AppLayout from './components/AppLayout';
import { useThemeStore } from './stores/themeStore';
import { useEffect, useMemo } from 'react';

export function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { mode } = useThemeStore();

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;

    if (mode === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', mode);
    }
  }, [mode]);

  // Determine actual theme based on mode and system preference
  const isDark = useMemo(() => {
    if (mode === 'system') {
      if (typeof window !== 'undefined') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
      return true;
    }
    return mode === 'dark';
  }, [mode]);

  const theme = useMemo(() => createTheme({
    palette: {
      mode: isDark ? 'dark' : 'light',
      primary: {
        main: isDark ? '#6366f1' : '#4f46e5',
      },
      background: {
        default: isDark ? '#0a0a0a' : '#f8fafc',
        paper: isDark ? 'rgba(20, 20, 20, 0.9)' : 'rgba(255, 255, 255, 0.9)',
      },
    },
    breakpoints: {
      values: {
        xs: 0,
        sm: 800,
        md: 1000,
        lg: 1200,
        xl: 1536,
      }
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: 'transparent',
          },
        },
      },
    },
  }), [isDark]);

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
