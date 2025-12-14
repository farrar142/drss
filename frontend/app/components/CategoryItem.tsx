import {
    Add as AddIcon,
    Category as CategoryIcon,
    ExpandMore as ExpandMoreIcon,
    RssFeed as RssFeedIcon,
} from '@mui/icons-material';
import { Accordion, AccordionDetails, AccordionSummary, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, List, ListItem, ListItemButton, ListItemIcon, ListItemText, TextField, Typography } from "@mui/material";
import { useRouter } from "next/navigation";
import { FC, useEffect, useMemo, useState } from "react";
import { feedsRouterCreateFeed, feedsRouterListFeeds, feedsRouterValidateFeed } from "../services/api";
import { RSSCategory, RSSFeed } from "../types/rss";
import { FeedItem } from './FeedItem';
import { useRSSStore } from "../stores/rssStore";

export const CategoryItem: FC<{
    category: RSSCategory,
    pathname: string,
    deleteCategory: (category: RSSCategory) => Promise<void>
    feeds: RSSFeed[]
}> =
    ({ category, pathname, deleteCategory, feeds: _feeds }) => {
        const router = useRouter();
        const { addFeed } = useRSSStore();
        const [expanded, setExpanded] = useState(false);
        const [addFeedOpen, setAddFeedOpen] = useState(false);
        const [newFeedUrl, setNewFeedUrl] = useState('');
        const [newFeedTitle, setNewFeedTitle] = useState('');
        const [newFeedDescription, setNewFeedDescription] = useState('');
        const [newFeedCustomHeaders, setNewFeedCustomHeaders] = useState('');
        const [newFeedRefreshInterval, setNewFeedRefreshInterval] = useState(5);
        const [validationResult, setValidationResult] = useState<{ title: string; description: string; items_count: number; latest_item_date?: string } | null>(null);
        const [validating, setValidating] = useState(false);
        const feeds = useMemo(() => _feeds.filter(f => f.category_id == category.id), [_feeds])
        const categoryIdFromPath = pathname.startsWith('/category/') ? pathname.split('/')[2] : null;

        useEffect(() => {
            if (categoryIdFromPath && parseInt(categoryIdFromPath) === category.id) {
                setExpanded(true);
            } else {
                setExpanded(false);
            }
        }, [pathname, category.id]);


        const handleValidateFeed = async () => {
            if (!newFeedUrl.trim()) {
                alert('URL을 입력하세요.');
                return;
            }
            setValidating(true);
            try {
                let customHeaders = undefined;
                if (newFeedCustomHeaders.trim()) {
                    customHeaders = JSON.parse(newFeedCustomHeaders);
                }
                const result = await feedsRouterValidateFeed({
                    url: newFeedUrl,
                    custom_headers: customHeaders,
                });
                setValidationResult(result);
                // 자동으로 title과 description 채우기
                if (!newFeedTitle && result.title) {
                    setNewFeedTitle(result.title);
                }
                if (!newFeedDescription && result.description) {
                    setNewFeedDescription(result.description);
                }
            } catch (error) {
                console.error(error);
                alert('피드 검증 실패: ' + (error as any)?.message || '알 수 없는 오류');
                setValidationResult(null);
            } finally {
                setValidating(false);
            }
        };

        const handleSummaryClick = () => {
            setExpanded(p => !p);
            router.push(`/category/${category.id}`);
        };

        const handleAddFeed = async () => {
            try {
                let customHeaders = undefined;
                if (newFeedCustomHeaders.trim()) {
                    try {
                        customHeaders = JSON.parse(newFeedCustomHeaders);
                    } catch (e) {
                        alert('Custom Headers는 유효한 JSON 형식이어야 합니다.');
                        return;
                    }
                }

                const newFeed = await feedsRouterCreateFeed({
                    category_id: category.id,
                    url: newFeedUrl,
                    title: newFeedTitle,
                    description: newFeedDescription,
                    custom_headers: customHeaders,
                    refresh_interval: newFeedRefreshInterval,
                });
                addFeed(newFeed);
                setAddFeedOpen(false);
                setNewFeedUrl('');
                setNewFeedTitle('');
                setNewFeedDescription('');
                setNewFeedCustomHeaders('');
                setNewFeedRefreshInterval(5);
                setValidationResult(null);
            } catch (error) {
                console.error(error);
            }
        };

        return (
            <>
                <Accordion expanded={expanded}>
                    <AccordionSummary expandIcon={
                        <div onClick={() => setExpanded(p => !p)}>
                            <ExpandMoreIcon />
                        </div>}
                        sx={{ minHeight: "24px !important" }}
                        slotProps={{ "content": { sx: { margin: "0 !important", padding: 0 } } }}
                    >
                        <Box
                            sx={{ display: 'flex', alignItems: 'center', mr: 1, width: "100%", m: 0, p: 0 }}
                            onClick={handleSummaryClick}
                        >
                            <CategoryIcon sx={{ mr: 1 }} />
                            <Typography >{category.name}</Typography>
                        </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                        <List dense>
                            {feeds.map(feed => <FeedItem feed={feed} key={feed.id} categoryId={category.id} />)}
                        </List>
                        <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setAddFeedOpen(true)} fullWidth sx={{ mt: 1 }}>
                            RSS 피드 추가
                        </Button>
                    </AccordionDetails>
                </Accordion>
                <Dialog open={addFeedOpen} onClose={() => setAddFeedOpen(false)}>
                    <DialogTitle>RSS 피드 추가</DialogTitle>
                    <DialogContent>
                        <TextField
                            autoFocus
                            margin="dense"
                            label="URL"
                            fullWidth
                            variant="standard"
                            value={newFeedUrl}
                            onChange={(e) => setNewFeedUrl(e.target.value)}
                        />
                        <TextField
                            margin="dense"
                            label="Custom Headers (JSON)"
                            fullWidth
                            variant="standard"
                            placeholder='{"User-Agent": "MyApp/1.0"}'
                            value={newFeedCustomHeaders}
                            onChange={(e) => setNewFeedCustomHeaders(e.target.value)}
                        />
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                            <Button variant="outlined" onClick={handleValidateFeed} disabled={validating}>
                                {validating ? '검증 중...' : '피드 검증'}
                            </Button>
                        </Box>
                        {validationResult && (
                            <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                                <Typography variant="subtitle2">검증 결과:</Typography>
                                <Typography variant="body2">제목: {validationResult.title}</Typography>
                                <Typography variant="body2">설명: {validationResult.description}</Typography>
                                <Typography variant="body2">아이템 수: {validationResult.items_count}</Typography>
                                {validationResult.latest_item_date && (
                                    <Typography variant="body2">최신 아이템 날짜: {validationResult.latest_item_date}</Typography>
                                )}
                            </Box>
                        )}
                        <TextField
                            margin="dense"
                            label="제목"
                            fullWidth
                            variant="standard"
                            value={newFeedTitle}
                            onChange={(e) => setNewFeedTitle(e.target.value)}
                        />
                        <TextField
                            margin="dense"
                            label="설명"
                            fullWidth
                            variant="standard"
                            value={newFeedDescription}
                            onChange={(e) => setNewFeedDescription(e.target.value)}
                        />
                        <TextField
                            margin="dense"
                            label="새로고침 간격 (분)"
                            type="number"
                            fullWidth
                            variant="standard"
                            value={newFeedRefreshInterval}
                            onChange={(e) => setNewFeedRefreshInterval(Number(e.target.value))}
                            inputProps={{ min: 1 }}
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setAddFeedOpen(false)}>취소</Button>
                        <Button onClick={handleAddFeed}>추가</Button>
                    </DialogActions>
                </Dialog>
            </>
        );
    }