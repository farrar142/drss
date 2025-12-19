'use client';

import { AuthProvider, useAuth } from './context/AuthContext';
import { AppBarProvider } from './context/AppBarContext';
import AppLayout from './components/layout/AppLayout';
import { NotificationProvider } from './components/common/NotificationProvider';
import { useThemeStore, applyThemeColors } from './stores/themeStore';
import { useTabStore } from './stores/tabStore';
import { useSiteStore } from './stores/siteStore';
import { useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { SignupStatusSchema } from './services/api';

type ThemeMode = 'system' | 'light' | 'dark';

interface InitialTheme {
  mode: ThemeMode;
  colors: { primary: string; secondary: string };
}

export function ClientLayout({
  children,
  initialTheme,
  initialSiteSettings,
}: {
  children: React.ReactNode;
  initialTheme?: InitialTheme | null;
  initialSiteSettings?: SignupStatusSchema | null;
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
      <AppBarProvider>
        <NotificationProvider>
          <SiteSettingsLoader initialSiteSettings={initialSiteSettings} />
          <URLParamHandler />
          <TabHistoryManager />
          <AppLayout authChildren={children} />
        </NotificationProvider>
      </AppBarProvider>
    </AuthProvider>
  );
}

// 사이트 설정을 로드하는 컴포넌트
function SiteSettingsLoader({ initialSiteSettings }: { initialSiteSettings?: SignupStatusSchema | null }) {
  const { loadSiteSettings, initializeSiteSettings } = useSiteStore();

  useEffect(() => {
    // 서버에서 받은 초기 설정이 있으면 즉시 적용
    if (initialSiteSettings) {
      initializeSiteSettings(initialSiteSettings);
    } else {
      // 초기 설정이 없으면 클라이언트에서 불러오기
      loadSiteSettings();
    }
  }, [initialSiteSettings, initializeSiteSettings, loadSiteSettings]);

  return null;
}

// URL 파라미터를 읽어서 탭을 여는 컴포넌트
function URLParamHandler() {
  const searchParams = useSearchParams();
  const { openTab } = useTabStore();
  const hasProcessed = useRef(false);

  useEffect(() => {
    // 한 번만 처리
    if (hasProcessed.current) return;

    const openCategory = searchParams.get('openCategory');
    const openFeed = searchParams.get('openFeed');
    const categoryId = searchParams.get('categoryId');
    const openSettings = searchParams.get('openSettings');

    if (openCategory) {
      hasProcessed.current = true;
      openTab({
        type: 'category',
        title: `카테고리`,
        path: `/category/${openCategory}`,
        resourceId: parseInt(openCategory),
      });
      // URL에서 파라미터 제거
      window.history.replaceState({}, '', '/home');
    } else if (openFeed && categoryId) {
      hasProcessed.current = true;
      openTab({
        type: 'feed',
        title: `피드`,
        path: `/category/${categoryId}/feed/${openFeed}`,
        resourceId: parseInt(openFeed),
      });
      window.history.replaceState({}, '', '/home');
    } else if (openSettings) {
      hasProcessed.current = true;
      openTab({
        type: 'settings',
        title: '설정',
        path: '/settings',
      });
      window.history.replaceState({}, '', '/home');
    }
  }, [searchParams, openTab]);

  return null;
}

// 브라우저 히스토리와 탭 히스토리 동기화
function TabHistoryManager() {
  const { panels, activePanelId, goBackTab } = useTabStore();
  const prevTabRef = useRef<string | null>(null);

  // 브라우저 뒤로가기 시 탭 히스토리 사용
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();

      // 탭 히스토리에서 이전 탭으로 이동
      const wentBack = goBackTab(activePanelId);

      // 탭 히스토리가 없으면 현재 상태 유지
      if (!wentBack) {
        window.history.pushState({ tab: true }, '', '/home');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activePanelId, goBackTab]);

  // 탭 변경 시 브라우저 히스토리에 상태 추가
  useEffect(() => {
    const activePanel = panels.find(p => p.id === activePanelId);
    const currentTabId = activePanel?.activeTabId;

    if (currentTabId && currentTabId !== prevTabRef.current) {
      // 첫 로드가 아닌 경우에만 히스토리 추가
      if (prevTabRef.current !== null) {
        window.history.pushState({ tab: true, tabId: currentTabId }, '', '/home');
      }
      prevTabRef.current = currentTabId;
    }
  }, [panels, activePanelId]);

  return null;
}
