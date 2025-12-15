'use client';

import { AuthProvider } from './context/AuthContext';
import AppLayout from './components/AppLayout';
import { useThemeStore, applyThemeColors } from './stores/themeStore';
import { useEffect, useMemo } from 'react';

type ThemeMode = 'system' | 'light' | 'dark';

interface InitialTheme {
  mode: ThemeMode;
  colors: { primary: string; secondary: string };
}

export function ClientLayout({
  children,
  initialTheme,
}: {
  children: React.ReactNode;
  initialTheme?: InitialTheme | null;
}) {
  const { mode, colors } = useThemeStore();

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

  // Apply theme class and custom colors to document
  useEffect(() => {
    const root = document.documentElement;

    // Apply dark/light class
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // Apply custom colors
    applyThemeColors(colors);
  }, [isDark, colors]);

  // Listen for system theme changes
  useEffect(() => {
    if (mode !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      // Re-apply colors when system theme changes (for sidebar border etc)
      applyThemeColors(colors);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [mode, colors]);

  return (
    <AuthProvider>
      <AppLayout>
        {children}
      </AppLayout>
    </AuthProvider>
  );
}
