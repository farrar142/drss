'use client';

import React, { useState, useEffect, FC } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemSecondaryAction,
  ListItemIcon,
  IconButton,
  AppBar,
  Toolbar,
  InputBase,
  Menu,
  MenuItem,
  SelectChangeEvent,
  Card,
  CardContent,
  CardActions,
  Chip,
  Alert,
  Fab,
  Avatar,
  Container,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Logout as LogoutIcon,
  Category as CategoryIcon,
  RssFeed as RssFeedIcon,
  FilterList as FilterListIcon,
  Search as SearchIcon,
  Settings as SettingsIcon,
  Favorite as FavoriteIcon,
  BookmarkBorder as BookmarkBorderIcon,
  ViewList as ViewListIcon,
  ViewModule as ViewModuleIcon,
  Menu as MenuIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  SettingsBrightness as SettingsBrightnessIcon,
} from '@mui/icons-material';
import { useTheme, useMediaQuery } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { useRSSStore } from '../stores/rssStore';
import { useThemeStore } from '../stores/themeStore';
import { CategoryDrawer, DRAWER_WIDTH } from './CategoryDrawer';


interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter();
  const pathname = usePathname()
  const { user, logout } = useAuth();
  const theme = useTheme();
  const isSm = useMediaQuery(theme.breakpoints.down('md'));

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
  const [settingsAnchorEl, setSettingsAnchorEl] = useState<null | HTMLElement>(null);
  const [themeAnchorEl, setThemeAnchorEl] = useState<null | HTMLElement>(null);

  const toggleDrawer = () => {
    setDrawerOpen(!drawerOpen);
  };

  const handleThemeClick = (event: React.MouseEvent<HTMLElement>) => {
    setThemeAnchorEl(event.currentTarget);
  };

  const handleThemeClose = () => {
    setThemeAnchorEl(null);
  };

  const handleThemeChange = (newMode: 'system' | 'light' | 'dark') => {
    setThemeMode(newMode);
    handleThemeClose();
  };

  const getThemeIcon = () => {
    switch (themeMode) {
      case 'light':
        return <LightModeIcon />;
      case 'dark':
        return <DarkModeIcon />;
      default:
        return <SettingsBrightnessIcon />;
    }
  };

  const handleSettingsClick = (event: React.MouseEvent<HTMLElement>) => {
    setSettingsAnchorEl(event.currentTarget);
  };

  const handleSettingsClose = () => {
    setSettingsAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    router.push('/auth/signin');
  };

  const handleSearch = async () => {
    // 검색 기능 구현
    console.log('Search:', searchQuery);
  };

  const handleViewModeChange = () => {
    setViewMode(viewMode === 'board' ? 'feed' : 'board');
  };

  useEffect(() => {
    setDrawerOpen(!isSm);
  }, [isSm])
  // 로그인/회원가입 페이지에서는 레이아웃을 적용하지 않음
  if (pathname?.startsWith('/auth/')) {
    return <>{children}</>;
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* 상단 AppBar - Glassmorphism */}
      <AppBar
        position="fixed"
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          background: 'var(--appbar-bg)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--glass-border)',
          boxShadow: 'var(--glass-shadow)',
          color: 'var(--text-primary)',
        }}
      >
        <Toolbar>
          <IconButton
            aria-label="toggle drawer"
            onClick={toggleDrawer}
            edge="start"
            sx={{
              mr: 2,
              color: 'var(--text-primary)',
              '&:hover': {
                background: 'var(--glass-bg)',
              }
            }}
          >
            <MenuIcon />
          </IconButton>
          <Typography
            variant="h6"
            noWrap
            component="div"
            sx={{
              flexGrow: 1,
              cursor: 'pointer',
              fontWeight: 600,
              letterSpacing: '0.5px',
              color: 'var(--text-primary)',
            }}
            onClick={() => router.push("/home")}
          >
            DRSS - RSS Reader
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <InputBase
              placeholder="검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              sx={{
                color: 'var(--text-primary)',
                '& .MuiInputBase-input': {
                  background: 'var(--input-bg)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: 2,
                  padding: '8px 12px',
                  width: '200px',
                  border: '1px solid var(--glass-border)',
                  transition: 'all 0.2s ease',
                  color: 'var(--text-primary)',
                  '&:focus': {
                    background: 'var(--glass-bg-hover)',
                    borderColor: 'var(--accent-color)',
                  },
                  '&::placeholder': {
                    color: 'var(--text-muted)',
                  },
                },
              }}
              startAdornment={<SearchIcon sx={{ mr: 1, color: 'var(--text-muted)' }} />}
            />
            <Box
              sx={{
                display: { xs: 'none', md: 'flex' },
                alignItems: 'center',
                gap: 0.5,
                background: 'var(--glass-bg)',
                borderRadius: 2,
                padding: '4px',
              }}
            >
              <IconButton
                size="small"
                onClick={() => setFilter('all')}
                sx={{
                  color: 'var(--text-primary)',
                  bgcolor: filter === 'all' ? 'var(--accent-light)' : 'transparent',
                  borderRadius: 1.5,
                  '&:hover': { bgcolor: 'var(--glass-bg-hover)' }
                }}
                title="전체"
              >
                <ViewListIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => setFilter('unread')}
                sx={{
                  color: 'var(--text-primary)',
                  bgcolor: filter === 'unread' ? 'var(--accent-light)' : 'transparent',
                  borderRadius: 1.5,
                  '&:hover': { bgcolor: 'var(--glass-bg-hover)' }
                }}
                title="읽지 않음"
              >
                <BookmarkBorderIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => setFilter('read')}
                sx={{
                  color: 'var(--text-primary)',
                  bgcolor: filter === 'read' ? 'var(--accent-light)' : 'transparent',
                  borderRadius: 1.5,
                  '&:hover': { bgcolor: 'var(--glass-bg-hover)' }
                }}
                title="읽음"
              >
                <ViewModuleIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => setFilter('favorite')}
                sx={{
                  color: 'var(--text-primary)',
                  bgcolor: filter === 'favorite' ? 'var(--accent-light)' : 'transparent',
                  borderRadius: 1.5,
                  '&:hover': { bgcolor: 'var(--glass-bg-hover)' }
                }}
                title="즐겨찾기"
              >
                <FavoriteIcon fontSize="small" />
              </IconButton>
            </Box>
            <IconButton
              onClick={handleViewModeChange}
              title={viewMode}
              sx={{
                color: 'var(--text-primary)',
                background: 'var(--glass-bg)',
                '&:hover': { background: 'var(--glass-bg-hover)' }
              }}
            >
              {viewMode === 'board' ? <ViewModuleIcon /> : <ViewListIcon />}
            </IconButton>
            {/* Theme Switcher */}
            <IconButton
              onClick={handleThemeClick}
              title="테마 변경"
              sx={{
                color: 'var(--text-primary)',
                background: 'var(--glass-bg)',
                '&:hover': { background: 'var(--glass-bg-hover)' }
              }}
            >
              {getThemeIcon()}
            </IconButton>
            <Menu
              anchorEl={themeAnchorEl}
              open={Boolean(themeAnchorEl)}
              onClose={handleThemeClose}
              PaperProps={{
                sx: {
                  background: 'var(--dialog-bg)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: 2,
                  boxShadow: 'var(--glass-shadow)',
                  '& .MuiMenuItem-root': {
                    color: 'var(--text-primary)',
                    gap: 1.5,
                    '&:hover': {
                      background: 'var(--glass-bg)',
                    },
                  },
                },
              }}
            >
              <MenuItem onClick={() => handleThemeChange('system')}>
                <SettingsBrightnessIcon fontSize="small" />
                시스템 설정
                {themeMode === 'system' && <Box component="span" sx={{ ml: 'auto', color: 'var(--accent-color)' }}>✓</Box>}
              </MenuItem>
              <MenuItem onClick={() => handleThemeChange('light')}>
                <LightModeIcon fontSize="small" />
                라이트 모드
                {themeMode === 'light' && <Box component="span" sx={{ ml: 'auto', color: 'var(--accent-color)' }}>✓</Box>}
              </MenuItem>
              <MenuItem onClick={() => handleThemeChange('dark')}>
                <DarkModeIcon fontSize="small" />
                다크 모드
                {themeMode === 'dark' && <Box component="span" sx={{ ml: 'auto', color: 'var(--accent-color)' }}>✓</Box>}
              </MenuItem>
            </Menu>
            <IconButton
              onClick={handleSettingsClick}
              sx={{
                color: 'var(--text-primary)',
                background: 'var(--glass-bg)',
                '&:hover': { background: 'var(--glass-bg-hover)' }
              }}
            >
              <SettingsIcon />
            </IconButton>
            <Menu
              anchorEl={settingsAnchorEl}
              open={Boolean(settingsAnchorEl)}
              onClose={handleSettingsClose}
              PaperProps={{
                sx: {
                  background: 'var(--dialog-bg)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: 2,
                  boxShadow: 'var(--glass-shadow)',
                  '& .MuiMenuItem-root': {
                    color: 'var(--text-primary)',
                    '&:hover': {
                      background: 'var(--glass-bg)',
                    },
                  },
                },
              }}
            >
              <MenuItem onClick={handleSettingsClose}>설정</MenuItem>
              <MenuItem onClick={handleLogout}>로그아웃</MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>
      <CategoryDrawer open={drawerOpen} pathname={pathname} variant={isSm ? 'temporary' : 'persistent'} onClose={toggleDrawer} />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          mt: 8,
          minHeight: 'calc(100vh - 64px)',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
