'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Menu,
  Search,
  Settings,
  Sun,
  Moon,
  Monitor,
  ListFilter,
  LayoutGrid,
  LayoutList,
  Bookmark,
  BookmarkCheck,
  Heart,
  LogOut,
  Palette,
} from 'lucide-react';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/ui/dropdown-menu';
import { ToggleGroup, ToggleGroupItem } from '@/ui/toggle-group';
import { Tooltip } from '@/ui/tooltip';
import { useAuth } from '../context/AuthContext';
import { useRSSStore } from '../stores/rssStore';
import { useThemeStore } from '../stores/themeStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useTranslation } from '../stores/languageStore';
import { CategoryDrawer, DRAWER_WIDTH } from './CategoryDrawer';
import { SplitPanelView } from './SplitPanelView';
import { useTabStore } from '../stores/tabStore';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  authChildren?: React.ReactNode;
}

export default function AppLayout({ authChildren }: AppLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { logout } = useAuth();
  const { t } = useTranslation();

  // Zustand stores
  const {
    searchQuery,
    setSearchQuery,
  } = useRSSStore();

  const {
    filter,
    viewMode,
    setFilter,
    setViewMode,
  } = useSettingsStore();

  const { openTab } = useTabStore();

  const { mode: themeMode, setMode: setThemeMode } = useThemeStore();

  // Local state
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // 헤더 가시성 - 패널 1개일 때 스크롤에 따라 변경됨
  const [headerVisible, setHeaderVisible] = useState(true);

  // 디버그용 래퍼
  const handleHeaderVisibilityChange = useCallback((visible: boolean) => {
    console.log('[AppLayout] setHeaderVisible called with:', visible);
    setHeaderVisible(visible);
  }, []);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;

    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1000);
    };

    // Debounced resize handler - only update after resize settles
    const onResize = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        checkMobile();
        timeoutId = null;
      }, 150);
    };

    checkMobile();
    window.addEventListener('resize', onResize, { passive: true });
    return () => {
      window.removeEventListener('resize', onResize);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    setDrawerOpen(!isMobile);
  }, [isMobile]);

  const toggleDrawer = () => {
    setDrawerOpen(!drawerOpen);
  };

  const handleLogout = () => {
    logout();
    router.push('/auth/signin');
  };

  const handleSearch = async () => {
    // TODO: Implement search
  };

  const getThemeIcon = () => {
    switch (themeMode) {
      case 'light':
        return <Sun className="h-4 w-4" />;
      case 'dark':
        return <Moon className="h-4 w-4" />;
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  // Auth pages don't use the layout
  if (pathname?.startsWith('/auth/')) {
    return <>{authChildren}</>;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header
        className={cn(
          "fixed left-0 right-0 z-50 h-14 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
          "transition-all duration-300 ease-in-out",
          headerVisible
            ? "translate-y-0 opacity-100"
            : "-translate-y-full opacity-0 pointer-events-none"
        )}
        style={{ top: 0 }}
      >
        <div className="flex h-full items-center gap-4 px-4">
          <Button variant="ghost" size="icon" onClick={toggleDrawer}>
            <Menu className="h-5 w-5" />
          </Button>

          <h1
            className="text-lg font-semibold cursor-pointer hover:text-primary transition-colors"
            onClick={() => openTab({ type: 'home', title: '메인스트림', path: '/home' })}
          >
            DRSS
          </h1>

          <div className="flex-1" />

          {/* Search */}
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`${t.common.search}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="w-64 pl-9 bg-muted/50"
            />
          </div>

          {/* Filter Buttons */}
          <div className="hidden lg:flex items-center">
            <ToggleGroup type="single" value={filter} onValueChange={(v) => v && setFilter(v as typeof filter)}>
              <Tooltip content={t.filter.all}>
                <ToggleGroupItem value="all" aria-label={t.filter.all}>
                  <ListFilter className="h-4 w-4" />
                </ToggleGroupItem>
              </Tooltip>
              <Tooltip content={t.filter.unread}>
                <ToggleGroupItem value="unread" aria-label={t.filter.unread}>
                  <Bookmark className="h-4 w-4" />
                </ToggleGroupItem>
              </Tooltip>
              <Tooltip content={t.filter.read}>
                <ToggleGroupItem value="read" aria-label={t.filter.read}>
                  <BookmarkCheck className="h-4 w-4" />
                </ToggleGroupItem>
              </Tooltip>
              <Tooltip content={t.filter.favorite}>
                <ToggleGroupItem value="favorite" aria-label={t.filter.favorite}>
                  <Heart className="h-4 w-4" />
                </ToggleGroupItem>
              </Tooltip>
            </ToggleGroup>
          </div>

          {/* View Mode Toggle */}
          <Tooltip content={viewMode === 'board' ? t.view.feedView : t.view.boardView}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setViewMode(viewMode === 'board' ? 'feed' : 'board')}
            >
              {viewMode === 'board' ? (
                <LayoutGrid className="h-4 w-4" />
              ) : (
                <LayoutList className="h-4 w-4" />
              )}
            </Button>
          </Tooltip>

          {/* Theme Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                {getThemeIcon()}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t.theme.title}</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setThemeMode('system')}>
                <Monitor className="mr-2 h-4 w-4" />
                {t.theme.system}
                {themeMode === 'system' && <span className="ml-auto text-primary">✓</span>}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setThemeMode('light')}>
                <Sun className="mr-2 h-4 w-4" />
                {t.theme.light}
                {themeMode === 'light' && <span className="ml-auto text-primary">✓</span>}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setThemeMode('dark')}>
                <Moon className="mr-2 h-4 w-4" />
                {t.theme.dark}
                {themeMode === 'dark' && <span className="ml-auto text-primary">✓</span>}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Settings Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <Settings className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openTab({ type: 'settings', title: '설정', path: '/settings' })}>
                <Palette className="mr-2 h-4 w-4" />
                {t.common.settings}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                {t.common.logout}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Sidebar */}
      <CategoryDrawer
        open={drawerOpen}
        pathname={pathname}
        variant={isMobile ? 'temporary' : 'persistent'}
        onClose={toggleDrawer}
      />

      {/* Main Content with Split Panel View */}
      <main
        className={cn(
          "min-h-screen transition-all duration-300"
        )}
        style={{
          marginLeft: drawerOpen && !isMobile ? DRAWER_WIDTH : 0,
          paddingTop: headerVisible ? '3.5rem' : '0', // 헤더 숨김 시 패딩 제거
        }}
      >
        <SplitPanelView headerVisible={headerVisible} onHeaderVisibilityChange={handleHeaderVisibilityChange} />
      </main>
    </div>
  );
}
