'use client';

import React, { useState, useEffect } from 'react';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip } from '@/components/ui/tooltip';
import { useAuth } from '../context/AuthContext';
import { useRSSStore } from '../stores/rssStore';
import { useThemeStore } from '../stores/themeStore';
import { CategoryDrawer, DRAWER_WIDTH } from './CategoryDrawer';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { logout } = useAuth();

  // Zustand stores
  const {
    searchQuery,
    filter,
    viewMode,
    setSearchQuery,
    setFilter,
    setViewMode,
  } = useRSSStore();

  const { mode: themeMode, setMode: setThemeMode } = useThemeStore();

  // Local state
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

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
    console.log('Search:', searchQuery);
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
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 h-14 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-full items-center gap-4 px-4">
          <Button variant="ghost" size="icon" onClick={toggleDrawer}>
            <Menu className="h-5 w-5" />
          </Button>

          <h1
            className="text-lg font-semibold cursor-pointer hover:text-primary transition-colors"
            onClick={() => router.push('/home')}
          >
            DRSS
          </h1>

          <div className="flex-1" />

          {/* Search */}
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="w-64 pl-9 bg-muted/50"
            />
          </div>

          {/* Filter Buttons */}
          <div className="hidden lg:flex items-center">
            <ToggleGroup type="single" value={filter} onValueChange={(v) => v && setFilter(v as typeof filter)}>
              <Tooltip content="전체">
                <ToggleGroupItem value="all" aria-label="전체">
                  <ListFilter className="h-4 w-4" />
                </ToggleGroupItem>
              </Tooltip>
              <Tooltip content="읽지 않음">
                <ToggleGroupItem value="unread" aria-label="읽지 않음">
                  <Bookmark className="h-4 w-4" />
                </ToggleGroupItem>
              </Tooltip>
              <Tooltip content="읽음">
                <ToggleGroupItem value="read" aria-label="읽음">
                  <BookmarkCheck className="h-4 w-4" />
                </ToggleGroupItem>
              </Tooltip>
              <Tooltip content="즐겨찾기">
                <ToggleGroupItem value="favorite" aria-label="즐겨찾기">
                  <Heart className="h-4 w-4" />
                </ToggleGroupItem>
              </Tooltip>
            </ToggleGroup>
          </div>

          {/* View Mode Toggle */}
          <Tooltip content={viewMode === 'board' ? '피드 보기' : '보드 보기'}>
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
              <DropdownMenuLabel>테마</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setThemeMode('system')}>
                <Monitor className="mr-2 h-4 w-4" />
                시스템
                {themeMode === 'system' && <span className="ml-auto text-primary">✓</span>}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setThemeMode('light')}>
                <Sun className="mr-2 h-4 w-4" />
                라이트
                {themeMode === 'light' && <span className="ml-auto text-primary">✓</span>}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setThemeMode('dark')}>
                <Moon className="mr-2 h-4 w-4" />
                다크
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
              <DropdownMenuItem onClick={() => router.push('/settings')}>
                <Palette className="mr-2 h-4 w-4" />
                설정
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                로그아웃
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

      {/* Main Content */}
      <main
        className={cn(
          "pt-14 min-h-screen transition-all duration-300"
        )}
        style={{
          marginLeft: drawerOpen && !isMobile ? DRAWER_WIDTH : 0,
        }}
      >
        <div className="p-1 sm:p-2 md:p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
