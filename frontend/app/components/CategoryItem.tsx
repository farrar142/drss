import {
  Add as AddIcon,
  Category as CategoryIcon,
  ExpandMore as ExpandMoreIcon,
  RssFeed as RssFeedIcon,
} from '@mui/icons-material';
import { Accordion, AccordionDetails, AccordionSummary, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, List, ListItem, ListItemButton, ListItemIcon, ListItemText, TextField, Typography } from "@mui/material";
import { useRouter } from "next/navigation";
import { FC, useEffect, useMemo, useState } from "react";
import { RSSCategory, RSSFeed } from "../types/rss";
import { RSSFeedListItem } from './RSSFeedListItem';
import { useRSSStore } from "../stores/rssStore";
import { feedsRoutersFeedCreateFeed, feedsRoutersFeedValidateFeed } from '../services/api';

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
        const result = await feedsRoutersFeedValidateFeed({
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

        const newFeed = await feedsRoutersFeedCreateFeed({
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
        <Accordion
          expanded={expanded}
          sx={{
            background: 'transparent',
            boxShadow: 'none',
            '&:before': { display: 'none' },
            '& .MuiAccordionSummary-root': {
              minHeight: '40px',
              mx: 1,
              borderRadius: 2,
              '&:hover': {
                background: 'rgba(255, 255, 255, 0.1)',
              },
            },
            '& .MuiAccordionDetails-root': {
              px: 1,
              pt: 0,
            },
          }}
        >
          <AccordionSummary
            expandIcon={
              <div onClick={() => setExpanded(p => !p)}>
                <ExpandMoreIcon sx={{ color: 'rgba(255, 255, 255, 0.7)' }} />
              </div>
            }
            sx={{ minHeight: "24px !important" }}
            slotProps={{
              "content": { sx: { margin: "0 !important", padding: 0 } },
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                mr: 1,
                width: "100%",
                m: 0,
                p: 0
              }}
              onClick={handleSummaryClick}
            >
              <CategoryIcon sx={{ mr: 1, color: 'var(--accent-solid)' }} />
              <Typography sx={{ fontWeight: 500, color: 'var(--text-primary)' }}>{category.name}</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <List dense sx={{ py: 0 }}>
              {feeds.map(feed => <RSSFeedListItem feed={feed} key={feed.id} categoryId={category.id} />)}
            </List>
            <Button 
              variant="outlined" 
              startIcon={<AddIcon />} 
              onClick={() => setAddFeedOpen(true)} 
              fullWidth 
              sx={{ 
                mt: 1,
                borderColor: 'var(--border-color)',
                color: 'var(--text-secondary)',
                borderRadius: 2,
                textTransform: 'none',
                '&:hover': {
                  borderColor: 'var(--accent-solid)',
                  background: 'var(--accent-color)',
                },
              }}
            >
              RSS 피드 추가
            </Button>
          </AccordionDetails>
        </Accordion>
        <Dialog 
          open={addFeedOpen} 
          onClose={() => setAddFeedOpen(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              background: 'var(--dialog-bg)',
              backdropFilter: 'blur(20px)',
              border: '1px solid var(--border-color)',
              borderRadius: 3,
              boxShadow: '0 8px 32px var(--shadow-color)',
            },
          }}
        >
          <DialogTitle sx={{ color: 'var(--text-primary)', fontWeight: 600 }}>RSS 피드 추가</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="URL"
              fullWidth
              variant="outlined"
              value={newFeedUrl}
              onChange={(e) => setNewFeedUrl(e.target.value)}
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: 'var(--text-primary)',
                  '& fieldset': { borderColor: 'var(--border-color)' },
                  '&:hover fieldset': { borderColor: 'var(--text-secondary)' },
                  '&.Mui-focused fieldset': { borderColor: 'var(--accent-solid)' },
                },
                '& .MuiInputLabel-root': { color: 'var(--text-secondary)' },
              }}
            />
            <TextField
              margin="dense"
              label="Custom Headers (JSON)"
              fullWidth
              variant="outlined"
              placeholder='{"User-Agent": "MyApp/1.0"}'
              value={newFeedCustomHeaders}
              onChange={(e) => setNewFeedCustomHeaders(e.target.value)}
              sx={{
                mt: 2,
                '& .MuiOutlinedInput-root': {
                  color: 'var(--text-primary)',
                  '& fieldset': { borderColor: 'var(--border-color)' },
                  '&:hover fieldset': { borderColor: 'var(--text-secondary)' },
                  '&.Mui-focused fieldset': { borderColor: 'var(--accent-solid)' },
                },
                '& .MuiInputLabel-root': { color: 'var(--text-secondary)' },
              }}
            />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
              <Button
                variant="outlined"
                onClick={handleValidateFeed}
                disabled={validating}
                sx={{
                  borderColor: '#667eea',
                  color: '#667eea',
                  '&:hover': {
                    borderColor: '#764ba2',
                    background: 'rgba(102, 126, 234, 0.1)',
                  },
                }}
              >
                {validating ? '검증 중...' : '피드 검증'}
              </Button>
            </Box>
            {validationResult && (
              <Box sx={{
                mt: 2,
                p: 2,
                background: 'var(--accent-color)',
                borderRadius: 2,
                border: '1px solid var(--border-color)',
              }}>
                <Typography variant="subtitle2" sx={{ color: 'var(--text-primary)', fontWeight: 600 }}>검증 결과:</Typography>
                <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>제목: {validationResult.title}</Typography>
                <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>설명: {validationResult.description}</Typography>
                <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>아이템 수: {validationResult.items_count}</Typography>
                {validationResult.latest_item_date && (
                  <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>최신 아이템 날짜: {validationResult.latest_item_date}</Typography>
                )}
              </Box>
            )}
            <TextField
              margin="dense"
              label="제목"
              fullWidth
              variant="outlined"
              value={newFeedTitle}
              onChange={(e) => setNewFeedTitle(e.target.value)}
              sx={{
                mt: 2,
                '& .MuiOutlinedInput-root': {
                  color: 'var(--text-primary)',
                  '& fieldset': { borderColor: 'var(--border-color)' },
                  '&:hover fieldset': { borderColor: 'var(--text-secondary)' },
                  '&.Mui-focused fieldset': { borderColor: 'var(--accent-solid)' },
                },
                '& .MuiInputLabel-root': { color: 'var(--text-secondary)' },
              }}
            />
            <TextField
              margin="dense"
              label="설명"
              fullWidth
              variant="outlined"
              value={newFeedDescription}
              onChange={(e) => setNewFeedDescription(e.target.value)}
              sx={{
                mt: 2,
                '& .MuiOutlinedInput-root': {
                  color: 'var(--text-primary)',
                  '& fieldset': { borderColor: 'var(--border-color)' },
                  '&:hover fieldset': { borderColor: 'var(--text-secondary)' },
                  '&.Mui-focused fieldset': { borderColor: 'var(--accent-solid)' },
                },
                '& .MuiInputLabel-root': { color: 'var(--text-secondary)' },
              }}
            />
            <TextField
              margin="dense"
              label="새로고침 간격 (분)"
              type="number"
              fullWidth
              variant="outlined"
              value={newFeedRefreshInterval}
              onChange={(e) => setNewFeedRefreshInterval(Number(e.target.value))}
              inputProps={{ min: 1 }}
              sx={{
                mt: 2,
                '& .MuiOutlinedInput-root': {
                  color: 'var(--text-primary)',
                  '& fieldset': { borderColor: 'var(--border-color)' },
                  '&:hover fieldset': { borderColor: 'var(--text-secondary)' },
                  '&.Mui-focused fieldset': { borderColor: 'var(--accent-solid)' },
                },
                '& .MuiInputLabel-root': { color: 'var(--text-secondary)' },
              }}
            />
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button 
              onClick={() => setAddFeedOpen(false)}
              sx={{ color: 'var(--text-secondary)' }}
            >
              취소
            </Button>
            <Button 
              onClick={handleAddFeed}
              variant="contained"
              sx={{
                background: 'var(--button-gradient)',
                '&:hover': {
                  background: 'var(--button-gradient-hover)',
                },
              }}
            >
              추가
            </Button>
          </DialogActions>
        </Dialog>
      </>
    );
  }
