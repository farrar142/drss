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
} from '@mui/icons-material';
import { useTheme, useMediaQuery } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { RSSCategory, RSSFeed } from '../types/rss';
import { feedsRouterListCategories, feedsRouterValidateFeed, feedsRouterCreateCategory } from '../services/api';
import { useRSSStore } from '../stores/rssStore';
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

  // Zustand store
  const {
    searchQuery,
    filter,
    viewMode,
    setSearchQuery,
    setFilter,
    setViewMode,
  } = useRSSStore();

  // Local state
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [settingsAnchorEl, setSettingsAnchorEl] = useState<null | HTMLElement>(null);

  const toggleDrawer = () => {
    setDrawerOpen(!drawerOpen);
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
    <Box sx={{ display: 'flex' }}>
      {/* 상단 AppBar */}
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="toggle drawer"
            onClick={toggleDrawer}
            edge="start"
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            DRSS - RSS Reader
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <InputBase
              placeholder="검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              sx={{
                color: 'inherit',
                '& .MuiInputBase-input': {
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  borderRadius: 1,
                  padding: '4px 8px',
                  width: '200px',
                },
              }}
              startAdornment={<SearchIcon sx={{ mr: 1 }} />}
            />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconButton
                color="inherit"
                size="small"
                onClick={() => setFilter('all')}
                sx={{
                  bgcolor: filter === 'all' ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
                  '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' }
                }}
                title="전체"
              >
                <ViewListIcon />
              </IconButton>
              <IconButton
                color="inherit"
                size="small"
                onClick={() => setFilter('unread')}
                sx={{
                  bgcolor: filter === 'unread' ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
                  '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' }
                }}
                title="읽지 않음"
              >
                <BookmarkBorderIcon />
              </IconButton>
              <IconButton
                color="inherit"
                size="small"
                onClick={() => setFilter('read')}
                sx={{
                  bgcolor: filter === 'read' ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
                  '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' }
                }}
                title="읽음"
              >
                <ViewModuleIcon />
              </IconButton>
              <IconButton
                color="inherit"
                size="small"
                onClick={() => setFilter('favorite')}
                sx={{
                  bgcolor: filter === 'favorite' ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
                  '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' }
                }}
                title="즐겨찾기"
              >
                <FavoriteIcon />
              </IconButton>
            </Box>
            <IconButton color="inherit" onClick={handleViewModeChange} title={viewMode}>
              {viewMode === 'board' ? <ViewModuleIcon /> : <ViewListIcon />}
            </IconButton>
            <IconButton color="inherit" onClick={handleSettingsClick}>
              <SettingsIcon />
            </IconButton>
            <Menu
              anchorEl={settingsAnchorEl}
              open={Boolean(settingsAnchorEl)}
              onClose={handleSettingsClose}
            >
              <MenuItem onClick={handleSettingsClose}>설정</MenuItem>
              <MenuItem onClick={handleLogout}>로그아웃</MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>
      <CategoryDrawer open={drawerOpen} pathname={pathname} variant={isSm ? 'temporary' : 'persistent'} onClose={toggleDrawer} />
      <Box component="main" sx={{ flexGrow: 1, p: 3, mt: 8, }}>
        {children}
      </Box>
    </Box>
  );
}
