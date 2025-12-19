'use client';

import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
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
  Ship,
  X,
  Shield,
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
import { useAuth } from '../../context/AuthContext';
import { useAppBar } from '../../context/AppBarContext';
import { useRSSStore } from '../../stores/rssStore';
import { useThemeStore } from '../../stores/themeStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTranslation } from '../../stores/languageStore';
import { useMediaModalStore } from '../../stores/mediaModalStore';
import { CategoryDrawer, DRAWER_WIDTH } from './CategoryDrawer';
import { SplitPanelView } from './SplitPanelView';
import { FloatingAppBarToggle } from './FloatingAppBarToggle';
import { useTabStore } from '../../stores/tabStore';
import { cn } from '@/lib/utils';

// 검색 입력 컴포넌트 - 디바운스 적용으로 불필요한 리렌더링 방지
const SearchInput = memo(({ placeholder }: { placeholder: string }) => {
  const { searchQuery, setSearchQuery } = useRSSStore();
  const [localValue, setLocalValue] = useState(searchQuery);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // searchQuery가 외부에서 변경되면 (예: 초기화) localValue도 동기화
  useEffect(() => {
    setLocalValue(searchQuery);
  }, [searchQuery]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalValue(value);

    // 디바운스 적용 (300ms)
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      setSearchQuery(value);
    }, 300);
  }, [setSearchQuery]);

  const handleClear = useCallback(() => {
    setLocalValue('');
    setSearchQuery('');
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
  }, [setSearchQuery]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      // 즉시 검색 적용
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      setSearchQuery(localValue);
    } else if (e.key === 'Escape') {
      handleClear();
    }
  }, [localValue, setSearchQuery, handleClear]);

  // 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div className="relative hidden md:block">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder={placeholder}
        value={localValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className="w-64 pl-9 pr-8 bg-muted/50"
      />
      {localValue && (
        <button
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted"
        >
          <X className="h-3 w-3 text-muted-foreground" />
        </button>
      )}
    </div>
  );
});
SearchInput.displayName = 'SearchInput';

interface AppLayoutProps {
  authChildren?: React.ReactNode;
}

export default function AppLayout({ authChildren }: AppLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const { t } = useTranslation();

  // Zustand stores
  const {
    filter,
    viewMode,
    showCruisingControls,
    setFilter,
    setViewMode,
    setShowCruisingControls,
  } = useSettingsStore();

  const { openTab } = useTabStore();

  const { mode: themeMode, setMode: setThemeMode } = useThemeStore();

  const { isMediaModalOpen } = useMediaModalStore();

  // AppBar visibility context
  const { isAppBarHidden, toggleAppBar } = useAppBar();

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
      {/* Header - hidden when media modal is open or on mobile when app bar is hidden */}
      <header
        className={cn(
          "fixed left-0 right-0 z-50 h-14 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-transform duration-200",
          (isMediaModalOpen || (isMobile && isAppBarHidden)) && "-translate-y-full"
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
          <SearchInput placeholder={`${t.common.search}...`} />

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

          {/* Cruise Controls Toggle */}
          <Tooltip content={showCruisingControls ? '크루즈 버튼 숨기기' : '크루즈 버튼 보이기'}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowCruisingControls(!showCruisingControls)}
              className={cn(!showCruisingControls && "text-muted-foreground")}
            >
              <Ship className={cn("h-4 w-4", !showCruisingControls && "opacity-50")} />
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
              {user && (user.is_staff || user.is_superuser) && (
                <DropdownMenuItem onClick={() => openTab({ type: 'admin', title: '관리자 설정', path: '/admin' })}>
                  <Shield className="mr-2 h-4 w-4" />
                  관리자 설정
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                {t.common.logout}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Sidebar - hidden when media modal is open */}
      <CategoryDrawer
        open={drawerOpen && !isMediaModalOpen}
        pathname={pathname}
        variant={isMobile ? 'temporary' : 'persistent'}
        onClose={toggleDrawer}
      />

      {/* Main Content with Split Panel View */}
      <main
        className={cn(
          "min-h-screen transition-all duration-200"
        )}
        style={{
          marginLeft: drawerOpen && !isMobile && !isMediaModalOpen ? DRAWER_WIDTH : 0,
          paddingTop: isMediaModalOpen ? 0 : (isMobile && isAppBarHidden) ? 0 : '3.5rem',
        }}
      >
        <SplitPanelView isMediaModalOpen={isMediaModalOpen} />
      </main>

      {/* Floating App Bar Toggle - 모바일에서만 표시 */}
      {isMobile && !isMediaModalOpen && (
        <FloatingAppBarToggle
          isAppBarHidden={isAppBarHidden}
          onToggle={toggleAppBar}
        />
      )}
    </div>
  );
}
