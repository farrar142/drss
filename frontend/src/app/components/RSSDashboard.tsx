'use client';

import React, { useState } from 'react';
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
    List,
    ListItem,
    ListItemText,
    ListItemSecondaryAction,
    IconButton,
    Card,
    CardContent,
    Chip,
    Tabs,
    Tab,
    Paper,
    Alert,
} from '@mui/material';
import {
    Add as AddIcon,
    Delete as DeleteIcon,
    Edit as EditIcon,
    RssFeed as RssFeedIcon,
    Category as CategoryIcon,
} from '@mui/icons-material';
import { useRSS } from '../context/RSSContext';
import { RSSCategory, RSSFeed } from '../types/rss';

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;

    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`rss-tabpanel-${index}`}
            aria-labelledby={`rss-tab-${index}`}
            {...other}
        >
            {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
        </div>
    );
}

export default function RSSDashboard() {
    const {
        categories,
        feeds,
        selectedCategory,
        selectedFeed,
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
        markItemRead,
        toggleItemFavorite,
    } = useRSS();

    const [tabValue, setTabValue] = useState(0);
    const [categoryDialog, setCategoryDialog] = useState(false);
    const [feedDialog, setFeedDialog] = useState(false);
    const [editingCategory, setEditingCategory] = useState<RSSCategory | null>(null);
    const [categoryName, setCategoryName] = useState('');
    const [categoryDescription, setCategoryDescription] = useState('');
    const [feedUrl, setFeedUrl] = useState('');
    const [feedTitle, setFeedTitle] = useState('');
    const [feedDescription, setFeedDescription] = useState('');
    const [dialogError, setDialogError] = useState('');

    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
    };

    const handleCreateCategory = async () => {
        try {
            await createCategory(categoryName, categoryDescription);
            setCategoryDialog(false);
            setCategoryName('');
            setCategoryDescription('');
            setDialogError('');
        } catch (err: any) {
            setDialogError(err.message);
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
            setDialogError(err.message);
        }
    };

    const handleDeleteCategory = async (id: number) => {
        if (window.confirm('정말로 이 카테고리를 삭제하시겠습니까?')) {
            try {
                await deleteCategory(id);
            } catch (err: any) {
                alert(err.message);
            }
        }
    };

    const handleCreateFeed = async () => {
        if (!selectedCategory) return;
        try {
            await createFeed(selectedCategory.id, feedUrl, feedTitle, feedDescription);
            setFeedDialog(false);
            setFeedUrl('');
            setFeedTitle('');
            setFeedDescription('');
            setDialogError('');
        } catch (err: any) {
            setDialogError(err.message);
        }
    };

    const handleDeleteFeed = async (id: number) => {
        if (window.confirm('정말로 이 피드를 삭제하시겠습니까?')) {
            try {
                await deleteFeed(id);
            } catch (err: any) {
                alert(err.message);
            }
        }
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
    };

    const getFeedsByCategory = (categoryId: number) => {
        return feeds.filter(feed => feed.category_id === categoryId);
    };

    if (loading && categories.length === 0) {
        return <Typography>로딩 중...</Typography>;
    }

    return (
        <Container maxWidth="lg">
            <Box sx={{ my: 4 }}>
                <Typography variant="h4" component="h1" gutterBottom>
                    RSS 리더
                </Typography>

                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                <Paper sx={{ width: '100%', mb: 2 }}>
                    <Tabs value={tabValue} onChange={handleTabChange} aria-label="rss tabs">
                        <Tab label="카테고리 관리" />
                        <Tab label="피드 관리" />
                        <Tab label="뉴스 읽기" />
                    </Tabs>

                    <TabPanel value={tabValue} index={0}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                            <Typography variant="h6">카테고리 목록</Typography>
                            <Button
                                variant="contained"
                                startIcon={<AddIcon />}
                                onClick={() => openCategoryDialog()}
                            >
                                카테고리 추가
                            </Button>
                        </Box>

                        <List>
                            {categories.map((category) => (
                                <ListItem key={category.id}>
                                    <ListItemText
                                        primary={category.name}
                                        secondary={category.description}
                                    />
                                    <ListItemSecondaryAction>
                                        <IconButton
                                            edge="end"
                                            onClick={() => openCategoryDialog(category)}
                                        >
                                            <EditIcon />
                                        </IconButton>
                                        <IconButton
                                            edge="end"
                                            onClick={() => handleDeleteCategory(category.id)}
                                        >
                                            <DeleteIcon />
                                        </IconButton>
                                    </ListItemSecondaryAction>
                                </ListItem>
                            ))}
                        </List>
                    </TabPanel>

                    <TabPanel value={tabValue} index={1}>
                        <Box sx={{ mb: 2 }}>
                            <Typography variant="h6" gutterBottom>카테고리 선택</Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                                {categories.map((category) => (
                                    <Chip
                                        key={category.id}
                                        label={category.name}
                                        clickable
                                        color={selectedCategory?.id === category.id ? 'primary' : 'default'}
                                        onClick={() => selectCategory(category)}
                                        icon={<CategoryIcon />}
                                    />
                                ))}
                            </Box>

                            {selectedCategory && (
                                <>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                                        <Typography variant="h6">{selectedCategory.name}의 피드</Typography>
                                        <Button
                                            variant="contained"
                                            startIcon={<AddIcon />}
                                            onClick={openFeedDialog}
                                        >
                                            피드 추가
                                        </Button>
                                    </Box>

                                    <List>
                                        {getFeedsByCategory(selectedCategory.id).map((feed) => (
                                            <ListItem key={feed.id}>
                                                <ListItemText
                                                    primary={feed.title}
                                                    secondary={`${feed.url} - ${feed.description}`}
                                                />
                                                <ListItemSecondaryAction>
                                                    <IconButton
                                                        edge="end"
                                                        onClick={() => handleDeleteFeed(feed.id)}
                                                    >
                                                        <DeleteIcon />
                                                    </IconButton>
                                                </ListItemSecondaryAction>
                                            </ListItem>
                                        ))}
                                    </List>
                                </>
                            )}
                        </Box>
                    </TabPanel>

                    <TabPanel value={tabValue} index={2}>
                        <Box sx={{ mb: 2 }}>
                            <Typography variant="h6" gutterBottom>피드 선택</Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                                {feeds.map((feed) => (
                                    <Chip
                                        key={feed.id}
                                        label={feed.title}
                                        clickable
                                        color={selectedFeed?.id === feed.id ? 'primary' : 'default'}
                                        onClick={() => selectFeed(feed)}
                                        icon={<RssFeedIcon />}
                                    />
                                ))}
                            </Box>

                            {selectedFeed && (
                                <Box>
                                    <Typography variant="h6" gutterBottom>
                                        {selectedFeed.title}의 뉴스
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" gutterBottom>
                                        총 {feedItems.length}개의 뉴스
                                    </Typography>

                                    {feedItems.map((item) => (
                                        <Card key={item.id} sx={{ mb: 2 }}>
                                            <CardContent>
                                                <Typography variant="h6" component="h2">
                                                    {item.title}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary" gutterBottom>
                                                    {new Date(item.published_at).toLocaleDateString()}
                                                </Typography>
                                                <Typography variant="body1" paragraph>
                                                    {item.description}
                                                </Typography>
                                                <Box sx={{ display: 'flex', gap: 1 }}>
                                                    <Button
                                                        size="small"
                                                        variant={item.is_read ? 'outlined' : 'contained'}
                                                        onClick={() => markItemRead(item.id)}
                                                    >
                                                        {item.is_read ? '읽음' : '읽기'}
                                                    </Button>
                                                    <Button
                                                        size="small"
                                                        variant={item.is_favorite ? 'contained' : 'outlined'}
                                                        color="secondary"
                                                        onClick={() => toggleItemFavorite(item.id)}
                                                    >
                                                        {item.is_favorite ? '즐겨찾기 해제' : '즐겨찾기'}
                                                    </Button>
                                                    <Button
                                                        size="small"
                                                        variant="outlined"
                                                        href={item.link}
                                                        target="_blank"
                                                    >
                                                        원문 보기
                                                    </Button>
                                                </Box>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </Box>
                            )}
                        </Box>
                    </TabPanel>
                </Paper>

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
                <Dialog open={feedDialog} onClose={() => setFeedDialog(false)}>
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
                            />
                            <TextField
                                margin="dense"
                                label="피드 제목"
                                fullWidth
                                value={feedTitle}
                                onChange={(e) => setFeedTitle(e.target.value)}
                            />
                            <TextField
                                margin="dense"
                                label="설명"
                                fullWidth
                                multiline
                                rows={2}
                                value={feedDescription}
                                onChange={(e) => setFeedDescription(e.target.value)}
                            />
                        </form>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setFeedDialog(false)}>취소</Button>
                        <Button type="submit" form="feed-form">추가</Button>
                    </DialogActions>
                </Dialog>
            </Box>
        </Container>
    );
}