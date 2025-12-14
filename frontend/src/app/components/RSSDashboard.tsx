'use client';

import React, { useState, useEffect } from 'react';
import {
    Container,
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
} from '@mui/icons-material';
import { useRSS } from '../context/RSSContext';
import { useAuth } from '../context/AuthContext';
import { RSSCategory, RSSFeed, RSSItem } from '../types/rss';
import { feedsRouterListAllItems, feedsRouterValidateFeed } from '../services/api';

const DRAWER_WIDTH = 240;

export default function RSSDashboard() {
    const { user, logout } = useAuth();
    const {
        categories,
        feeds,
        feedItems,
        loading,
        error,
        createCategory,
        updateCategory,
        deleteCategory,
        createFeed,
        deleteFeed,
        selectCategory,
        selectFeed,
        loadFeedItems,
        markItemRead,
        toggleItemFavorite,
        refreshData,
    } = useRSS();

    // UI 상태
    const [drawerOpen, setDrawerOpen] = useState(true);
    const [categoryDialog, setCategoryDialog] = useState(false);
    const [feedDialog, setFeedDialog] = useState(false);
    const [editingCategory, setEditingCategory] = useState<RSSCategory | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<RSSCategory | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState<'all' | 'unread' | 'read' | 'favorite'>('all');
    const [viewMode, setViewMode] = useState<'titles' | 'categories'>('categories');
    const [settingsAnchorEl, setSettingsAnchorEl] = useState<null | HTMLElement>(null);

    // 폼 상태
    const [categoryName, setCategoryName] = useState('');
    const [categoryDescription, setCategoryDescription] = useState('');
    const [feedUrl, setFeedUrl] = useState('');
    const [feedTitle, setFeedTitle] = useState('');
    const [feedDescription, setFeedDescription] = useState('');
    const [feedCustomHeaders, setFeedCustomHeaders] = useState('');
    const [feedRefreshInterval, setFeedRefreshInterval] = useState(60);
    const [dialogError, setDialogError] = useState('');
    const [validatingFeed, setValidatingFeed] = useState(false);
    const [feedValidationResult, setFeedValidationResult] = useState<{
        title: string;
        description: string;
        items_count: number;
        latest_item_date?: string;
    } | null>(null);

    // 모든 아이템 상태
    const [allItems, setAllItems] = useState<RSSItem[]>([]);
    const [itemsLoading, setItemsLoading] = useState(false);

    useEffect(() => {
        loadAllItems();
    }, [feeds, filter, searchQuery]);

    const loadAllItems = async () => {
        if (feeds.length === 0) return;

        setItemsLoading(true);
        try {
            const params: any = {};
            if (filter !== 'all') {
                if (filter === 'unread') params.is_read = false;
                else if (filter === 'read') params.is_read = true;
                else if (filter === 'favorite') params.is_favorite = true;
            }
            if (searchQuery) params.search = searchQuery;

            const items = await feedsRouterListAllItems(params);
            setAllItems(items);
        } catch (err) {
            console.error('Failed to load items:', err);
        } finally {
            setItemsLoading(false);
        }
    };

    const handleSettingsClick = (event: React.MouseEvent<HTMLElement>) => {
        setSettingsAnchorEl(event.currentTarget);
    };

    const handleSettingsClose = () => {
        logout();
        setSettingsAnchorEl(null);
    };

    const openCategoryDialog = (category?: RSSCategory) => {
        if (category) {
            setEditingCategory(category);
            setCategoryName(category.name);
            setCategoryDescription(category.description);
        } else {
            setEditingCategory(null);
            setCategoryName('');
            setCategoryDescription('');
        }
        setCategoryDialog(true);
    };

    const openFeedDialog = () => {
        setFeedDialog(true);
        setFeedUrl('');
        setFeedTitle('');
        setFeedDescription('');
        setFeedCustomHeaders('');
        setFeedRefreshInterval(60);
        setFeedValidationResult(null);
        setDialogError('');
    };

    const handleCreateCategory = async () => {
        try {
            await createCategory(categoryName, categoryDescription);
            setCategoryDialog(false);
            setCategoryName('');
            setCategoryDescription('');
            setDialogError('');
        } catch (err: any) {
            setDialogError(err.response?.data?.detail || '카테고리 생성 실패');
        }
    };

    const handleUpdateCategory = async () => {
        if (!editingCategory) return;
        try {
            await updateCategory(editingCategory.id, categoryName, categoryDescription);
            setCategoryDialog(false);
            setEditingCategory(null);
            setCategoryName('');
            setCategoryDescription('');
            setDialogError('');
        } catch (err: any) {
            setDialogError(err.response?.data?.detail || '카테고리 수정 실패');
        }
    };

    const handleDeleteCategory = async (id: number) => {
        try {
            await deleteCategory(id);
        } catch (err: any) {
            console.error('Failed to delete category:', err);
        }
    };

    const handleCreateFeed = async () => {
        if (!selectedCategory) return;
        try {
            // Custom headers 파싱
            let customHeaders = {};
            if (feedCustomHeaders.trim()) {
                try {
                    customHeaders = JSON.parse(feedCustomHeaders);
                } catch (e) {
                    setDialogError('Custom headers 형식이 잘못되었습니다. JSON 형식이어야 합니다.');
                    return;
                }
            }

            await createFeed(
                selectedCategory.id,
                feedUrl,
                feedTitle || (feedValidationResult?.title || ''),
                feedDescription || feedValidationResult?.description || '',
                customHeaders,
                feedRefreshInterval
            );
            setFeedDialog(false);
            setFeedUrl('');
            setFeedTitle('');
            setFeedDescription('');
            setFeedCustomHeaders('');
            setFeedRefreshInterval(60);
            setFeedValidationResult(null);
            setDialogError('');
        } catch (err: any) {
            setDialogError(err.response?.data?.detail || '피드 생성 실패');
        }
    };

    const handleValidateFeed = async () => {
        if (!feedUrl.trim()) {
            setDialogError('URL을 입력해주세요.');
            return;
        }

        setValidatingFeed(true);
        setDialogError('');
        setFeedValidationResult(null);

        try {
            // Custom headers 파싱
            let customHeaders = {};
            if (feedCustomHeaders.trim()) {
                try {
                    customHeaders = JSON.parse(feedCustomHeaders);
                } catch (e) {
                    setDialogError('Custom headers 형식이 잘못되었습니다. JSON 형식이어야 합니다.');
                    setValidatingFeed(false);
                    return;
                }
            }

            const result = await feedsRouterValidateFeed({
                url: feedUrl,
                custom_headers: customHeaders,
            });

            setFeedValidationResult(result);
            if (!feedTitle) {
                setFeedTitle(result.title);
            }
            if (!feedDescription) {
                setFeedDescription(result.description);
            }
        } catch (err: any) {
            setDialogError(err.response?.data?.detail || '피드 검증 실패');
        } finally {
            setValidatingFeed(false);
        }
    };

    const handleDeleteFeed = async (id: number) => {
        try {
            await deleteFeed(id);
        } catch (err: any) {
            console.error('Failed to delete feed:', err);
        }
    };

    const getFeedsByCategory = (categoryId: number) => {
        return feeds.filter(feed => feed.category_id === categoryId);
    };

    const getCategoryStats = (categoryId: number) => {
        const categoryFeeds = getFeedsByCategory(categoryId);
        const categoryItems = allItems.filter(item =>
            categoryFeeds.some(feed => feed.id === item.feed_id)
        );
        return {
            total: categoryItems.length,
            unread: categoryItems.filter(item => !item.is_read).length,
            favorite: categoryItems.filter(item => item.is_favorite).length,
        };
    };

    const renderItemCard = (item: RSSItem) => (
        <Card key={item.id} sx={{ mb: 2 }}>
            <CardContent>
                <Typography variant="h6" component="div">
                    {item.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {item.description}
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" color="text.secondary">
                        {new Date(item.published_at).toLocaleDateString()}
                    </Typography>
                    <Box>
                        <IconButton
                            size="small"
                            onClick={() => markItemRead(item.id)}
                            color={item.is_read ? 'default' : 'primary'}
                        >
                            <BookmarkBorderIcon />
                        </IconButton>
                        <IconButton
                            size="small"
                            onClick={() => toggleItemFavorite(item.id)}
                            color={item.is_favorite ? 'error' : 'default'}
                        >
                            <FavoriteIcon />
                        </IconButton>
                    </Box>
                </Box>
            </CardContent>
        </Card>
    );

    if (loading && categories.length === 0) {
        return <Typography>로딩 중...</Typography>;
    }

    return (
        <Box sx={{ display: 'flex' }}>
            {/* 왼쪽 Drawer - 카테고리 관리 */}
            <Drawer
                variant="persistent"
                anchor="left"
                open={drawerOpen}
                sx={{
                    width: DRAWER_WIDTH,
                    flexShrink: 0,
                    '& .MuiDrawer-paper': {
                        width: DRAWER_WIDTH,
                        boxSizing: 'border-box',
                    },
                }}
            >
                <Box sx={{ p: 2 }}>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                        카테고리 관리
                    </Typography>
                    <Button
                        fullWidth
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => openCategoryDialog()}
                        sx={{ mb: 2 }}
                    >
                        카테고리 추가
                    </Button>
                    <List>
                        {categories.map((category) => {
                            const stats = getCategoryStats(category.id);
                            return (
                                <ListItem key={category.id}>
                                    <ListItemButton onClick={() => setSelectedCategory(category)}>
                                        <ListItemText
                                            primary={category.name}
                                            secondary={`${stats.total}개 (${stats.unread} 읽지 않음)`}
                                        />
                                    </ListItemButton>
                                    <ListItemSecondaryAction>
                                        <IconButton edge="end" onClick={() => openCategoryDialog(category)}>
                                            <EditIcon />
                                        </IconButton>
                                        <IconButton edge="end" onClick={() => handleDeleteCategory(category.id)}>
                                            <DeleteIcon />
                                        </IconButton>
                                    </ListItemSecondaryAction>
                                </ListItem>
                            );
                        })}
                    </List>
                </Box>
            </Drawer>

            {/* 메인 콘텐츠 */}
            <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
                {/* 상단 AppBar */}
                <AppBar position="static" sx={{ mb: 3 }}>
                    <Toolbar>
                        <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
                            {/* 검색 박스 */}
                            <Box sx={{ position: 'relative', flexGrow: 1, maxWidth: 400 }}>
                                <SearchIcon sx={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)' }} />
                                <InputBase
                                    placeholder="검색..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    sx={{
                                        pl: 4,
                                        width: '100%',
                                        bgcolor: 'rgba(255, 255, 255, 0.15)',
                                        borderRadius: 1,
                                        px: 2,
                                        py: 1,
                                    }}
                                />
                            </Box>

                            {/* 필터 */}
                            <FormControl size="small">
                                <Select
                                    value={filter}
                                    onChange={(e: SelectChangeEvent) => setFilter(e.target.value as any)}
                                    startAdornment={<FilterListIcon />}
                                >
                                    <MenuItem value="all">모두 표시</MenuItem>
                                    <MenuItem value="unread">읽지 않은 것만</MenuItem>
                                    <MenuItem value="read">읽은 것만</MenuItem>
                                    <MenuItem value="favorite">즐겨찾기만</MenuItem>
                                </Select>
                            </FormControl>

                            {/* 뷰 모드 */}
                            <Box sx={{ display: 'flex', gap: 1 }}>
                                <IconButton
                                    color={viewMode === 'titles' ? 'primary' : 'default'}
                                    onClick={() => setViewMode('titles')}
                                >
                                    <ViewListIcon />
                                </IconButton>
                                <IconButton
                                    color={viewMode === 'categories' ? 'primary' : 'default'}
                                    onClick={() => setViewMode('categories')}
                                >
                                    <ViewModuleIcon />
                                </IconButton>
                            </Box>
                        </Box>

                        {/* 설정 버튼 */}
                        <IconButton color="inherit" onClick={handleSettingsClick}>
                            <SettingsIcon />
                        </IconButton>
                        <Menu
                            anchorEl={settingsAnchorEl}
                            open={Boolean(settingsAnchorEl)}
                            onClose={handleSettingsClose}
                        >
                            <MenuItem onClick={handleSettingsClose}>일반 설정</MenuItem>
                            <MenuItem onClick={handleSettingsClose}>관리자 설정</MenuItem>
                            <MenuItem onClick={handleSettingsClose}>
                                <LogoutIcon sx={{ mr: 1 }} />
                                로그아웃
                            </MenuItem>
                        </Menu>
                    </Toolbar>
                </AppBar>

                {/* 에러 표시 */}
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                {/* 콘텐츠 영역 */}
                {viewMode === 'titles' ? (
                    // 제목만 보기 모드
                    <Box>
                        <Typography variant="h6" sx={{ mb: 2 }}>
                            모든 피드 제목 ({allItems.length}개)
                        </Typography>
                        <List>
                            {allItems.map((item) => (
                                <ListItem key={item.id} divider>
                                    <ListItemText
                                        primary={item.title}
                                        secondary={`${item.description.substring(0, 100)}...`}
                                    />
                                    <ListItemSecondaryAction>
                                        <IconButton onClick={() => markItemRead(item.id)}>
                                            <BookmarkBorderIcon color={item.is_read ? 'disabled' : 'primary'} />
                                        </IconButton>
                                        <IconButton onClick={() => toggleItemFavorite(item.id)}>
                                            <FavoriteIcon color={item.is_favorite ? 'error' : 'disabled'} />
                                        </IconButton>
                                    </ListItemSecondaryAction>
                                </ListItem>
                            ))}
                        </List>
                    </Box>
                ) : (
                    // 카테고리별 보기 모드
                    <Box>
                        {selectedCategory ? (
                            <>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                    <Typography variant="h6">
                                        {selectedCategory.name}의 피드
                                    </Typography>
                                    <Button
                                        variant="contained"
                                        startIcon={<AddIcon />}
                                        onClick={openFeedDialog}
                                    >
                                        피드 추가
                                    </Button>
                                </Box>

                                {/* 피드 목록 */}
                                <Box sx={{ mb: 3 }}>
                                    <Typography variant="subtitle1" sx={{ mb: 1 }}>피드 목록</Typography>
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                        {getFeedsByCategory(selectedCategory.id).map((feed) => (
                                            <Chip
                                                key={feed.id}
                                                label={feed.title}
                                                onDelete={() => handleDeleteFeed(feed.id)}
                                                avatar={feed.favicon_url ? <Avatar src={feed.favicon_url} sx={{ width: 20, height: 20 }} /> : <RssFeedIcon />}
                                                sx={{
                                                    '& .MuiChip-avatar': { width: 20, height: 20 },
                                                }}
                                            />
                                        ))}
                                    </Box>
                                </Box>

                                {/* 아이템 목록 */}
                                <Typography variant="subtitle1" sx={{ mb: 2 }}>
                                    뉴스 ({allItems.filter(item => getFeedsByCategory(selectedCategory.id).some(feed => feed.id === item.feed_id)).length}개)
                                </Typography>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                                    {allItems
                                        .filter(item => getFeedsByCategory(selectedCategory.id).some(feed => feed.id === item.feed_id))
                                        .map((item) => (
                                            <Box key={item.id} sx={{ flex: '1 1 300px', maxWidth: '400px' }}>
                                                {renderItemCard(item)}
                                            </Box>
                                        ))}
                                </Box>
                            </>
                        ) : (
                            <Typography variant="h6" sx={{ textAlign: 'center', mt: 4 }}>
                                왼쪽에서 카테고리를 선택하세요
                            </Typography>
                        )}
                    </Box>
                )}
            </Box>

            {/* 카테고리 다이얼로그 */}
            <Dialog open={categoryDialog} onClose={() => setCategoryDialog(false)}>
                <DialogTitle>
                    {editingCategory ? '카테고리 수정' : '카테고리 추가'}
                </DialogTitle>
                <DialogContent>
                    {dialogError && <Alert severity="error" sx={{ mb: 2 }}>{dialogError}</Alert>}
                    <form id="category-form" onSubmit={(e) => { e.preventDefault(); editingCategory ? handleUpdateCategory() : handleCreateCategory(); }}>
                        <TextField
                            autoFocus
                            margin="dense"
                            label="카테고리 이름"
                            fullWidth
                            value={categoryName}
                            onChange={(e) => setCategoryName(e.target.value)}
                        />
                        <TextField
                            margin="dense"
                            label="설명"
                            fullWidth
                            multiline
                            rows={3}
                            value={categoryDescription}
                            onChange={(e) => setCategoryDescription(e.target.value)}
                        />
                    </form>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCategoryDialog(false)}>취소</Button>
                    <Button type="submit" form="category-form">
                        {editingCategory ? '수정' : '추가'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* 피드 다이얼로그 */}
            <Dialog open={feedDialog} onClose={() => setFeedDialog(false)} maxWidth="md" fullWidth>
                <DialogTitle>피드 추가</DialogTitle>
                <DialogContent>
                    {dialogError && <Alert severity="error" sx={{ mb: 2 }}>{dialogError}</Alert>}
                    <form id="feed-form" onSubmit={(e) => { e.preventDefault(); handleCreateFeed(); }}>
                        <TextField
                            autoFocus
                            margin="dense"
                            label="RSS URL"
                            fullWidth
                            value={feedUrl}
                            onChange={(e) => setFeedUrl(e.target.value)}
                            sx={{ mb: 2 }}
                        />
                        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                            <TextField
                                label="Custom Headers (JSON)"
                                fullWidth
                                multiline
                                rows={2}
                                value={feedCustomHeaders}
                                onChange={(e) => setFeedCustomHeaders(e.target.value)}
                                placeholder='{"Authorization": "Bearer token", "User-Agent": "Custom"}'
                            />
                            <Button
                                variant="outlined"
                                onClick={handleValidateFeed}
                                disabled={validatingFeed || !feedUrl.trim()}
                                sx={{ minWidth: 120 }}
                            >
                                {validatingFeed ? '검증 중...' : '검증'}
                            </Button>
                        </Box>

                        {feedValidationResult && (
                            <Alert severity="success" sx={{ mb: 2 }}>
                                <Typography variant="subtitle2">검증 결과:</Typography>
                                <Typography>제목: {feedValidationResult.title}</Typography>
                                <Typography>아이템 수: {feedValidationResult.items_count}</Typography>
                                {feedValidationResult.latest_item_date && (
                                    <Typography>최신 아이템: {new Date(feedValidationResult.latest_item_date).toLocaleString()}</Typography>
                                )}
                            </Alert>
                        )}

                        <TextField
                            margin="dense"
                            label="피드 제목 (선택사항)"
                            fullWidth
                            value={feedTitle}
                            onChange={(e) => setFeedTitle(e.target.value)}
                            helperText="입력하지 않으면 RSS 피드에서 자동으로 가져옵니다"
                            sx={{ mb: 2 }}
                        />
                        <TextField
                            margin="dense"
                            label="설명"
                            fullWidth
                            multiline
                            rows={2}
                            value={feedDescription}
                            onChange={(e) => setFeedDescription(e.target.value)}
                            sx={{ mb: 2 }}
                        />
                        <TextField
                            margin="dense"
                            label="새로고침 주기 (분)"
                            type="number"
                            fullWidth
                            value={feedRefreshInterval}
                            onChange={(e) => setFeedRefreshInterval(Number(e.target.value))}
                            inputProps={{ min: 1, max: 1440 }}
                            helperText="1분에서 1440분 (24시간) 사이"
                        />
                    </form>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setFeedDialog(false)}>취소</Button>
                    <Button type="submit" form="feed-form">추가</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}