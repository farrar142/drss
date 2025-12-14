'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
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
    FormControl,
    Select,
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
    Search as SearchIcon,
    Settings as SettingsIcon,
    Logout as LogoutIcon,
    Category as CategoryIcon,
    RssFeed as RssFeedIcon,
    Favorite as FavoriteIcon,
    BookmarkBorder as BookmarkBorderIcon,
    ViewList as ViewListIcon,
    ViewModule as ViewModuleIcon,
    FilterList as FilterListIcon,
    Menu as MenuIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
const DRAWER_WIDTH = 240;

interface AppLayoutProps {
    children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
    const router = useRouter();
    const pathname = usePathname();
    const { user, logout } = useAuth();

    // UI 상태
    const [drawerOpen, setDrawerOpen] = useState(true);
    const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState<'all' | 'unread' | 'read' | 'favorite'>('all');
    const [viewMode, setViewMode] = useState<'titles' | 'categories'>('categories');
    const [settingsAnchorEl, setSettingsAnchorEl] = useState<null | HTMLElement>(null);

    // 폼 상태

    // URL에서 현재 선택된 카테고리/피드 파악하여 drawer 상태 설정
    useEffect(() => {
        if (pathname.startsWith('/category/')) {
            const categoryId = parseInt(pathname.split('/')[2]);
            if (categoryId) {
                setExpandedCategories(new Set([categoryId]));
            }
        } else {
            setExpandedCategories(new Set());
        }
    }, [pathname]);

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
        router.push('/auth/login');
    };

    const handleSearch = async () => {
        // 검색 기능 구현
        console.log('Search:', searchQuery);
    };

    const handleFilterChange = (event: SelectChangeEvent) => {
        setFilter(event.target.value as 'all' | 'unread' | 'read' | 'favorite');
    };

    const handleViewModeChange = () => {
        setViewMode(viewMode === 'titles' ? 'categories' : 'titles');
    };

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
                        <FormControl size="small" sx={{ minWidth: 100 }}>
                            <Select
                                value={filter}
                                onChange={handleFilterChange}
                                sx={{
                                    color: 'inherit',
                                    '& .MuiOutlinedInput-notchedOutline': {
                                        borderColor: 'rgba(255, 255, 255, 0.23)',
                                    },
                                    '& .MuiSvgIcon-root': {
                                        color: 'inherit',
                                    },
                                }}
                            >
                                <MenuItem value="all">전체</MenuItem>
                                <MenuItem value="unread">읽지 않음</MenuItem>
                                <MenuItem value="read">읽음</MenuItem>
                                <MenuItem value="favorite">즐겨찾기</MenuItem>
                            </Select>
                        </FormControl>
                        <IconButton color="inherit" onClick={handleViewModeChange}>
                            {viewMode === 'titles' ? <ViewModuleIcon /> : <ViewListIcon />}
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
        </Box>
    );
}