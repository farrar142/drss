import React, { useState } from "react";
import {
  RssFeed as RssFeedIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import {
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Avatar,
  Box,
  Button,
  Typography,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { RSSFeed } from "../types/rss";
import { useRSSStore } from "../stores/rssStore";
import { FeedSchema, feedsRoutersFeedDeleteFeed, feedsRoutersFeedMarkAllFeedItemsRead, feedsRoutersFeedRefreshFeed, feedsRoutersFeedUpdateFeed } from "../services/api";

interface RSSFeedListItemProps {
  feed: FeedSchema;
  categoryId: number;
}

export const RSSFeedListItem: React.FC<RSSFeedListItemProps> = ({ feed, categoryId }) => {
  const router = useRouter();
  const { updateFeed, removeFeed } = useRSSStore();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(feed.title);
  const [editDescription, setEditDescription] = useState(feed.description);
  const [editUrl, setEditUrl] = useState(feed.url);
  const [editRefreshInterval, setEditRefreshInterval] = useState(feed.refresh_interval);
  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleEdit = () => {
    setEditOpen(true);
    setAnchorEl(null);
  };

  const handleEditSave = async () => {
    try {
      const updatedFeed = await feedsRoutersFeedUpdateFeed(feed.id, {
        title: editTitle,
        description: editDescription,
        url: editUrl,
        refresh_interval: editRefreshInterval,
      });
      updateFeed(updatedFeed);
      setEditOpen(false);
    } catch (error) {
      console.error(error);
    }
  };

  const handleRefresh = async () => {
    try {
      await feedsRoutersFeedRefreshFeed(feed.id);
      alert('피드 새로고침이 예약되었습니다.');
    } catch (error) {
      console.error(error);
    }
    setAnchorEl(null);
  };

  const handleDelete = async () => {
    if (confirm('정말로 이 피드를 삭제하시겠습니까?')) {
      try {
        await feedsRoutersFeedDeleteFeed(feed.id);
        removeFeed(feed.id);
      } catch (error) {
        console.error(error);
      }
    }
    setAnchorEl(null);
  };

  const handleMarkAllRead = async () => {
    try {
      await feedsRoutersFeedMarkAllFeedItemsRead(feed.id);
      alert('모든 아이템을 읽음으로 표시했습니다.');
    } catch (error) {
      console.error(error);
    }
    setAnchorEl(null);
  };

  return (
    <>
      <ListItem key={feed.id} disablePadding>
        <ListItemButton
          onClick={() => router.push(`/category/${categoryId}/feed/${feed.id}`)}
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            p: 1,
            m: 0,
            borderRadius: 1.5,
            '&:hover': {
              background: 'var(--hover-bg)',
            },
          }}
        >
          {feed.favicon_url ? (
            <Avatar src={feed.favicon_url} sx={{ width: 20, height: 20 }} />
          ) : (
            <RssFeedIcon fontSize="small" sx={{ color: 'var(--accent-solid)' }} />
          )}
          <Typography
            fontSize="0.75rem"
            sx={{
              flexGrow: 1,
              mx: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: 'var(--text-primary)',
            }}
          >
            {feed.title}
          </Typography>
          <Typography
            fontSize="0.7rem"
            sx={{
              background: 'var(--accent-color)',
              px: 1,
              py: 0.25,
              borderRadius: 1,
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            {feed.item_count}
          </Typography>
        </ListItemButton>
        <IconButton
          sx={{
            p: 0.5,
            m: 0,
            '&:hover': {
              background: 'var(--hover-bg)',
            },
          }}
          onClick={handleMenuClick}
          size="small"
        >
          <MoreVertIcon fontSize="small" sx={{ color: 'var(--text-secondary)' }} />
        </IconButton>
      </ListItem>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: {
            background: 'var(--dialog-bg)',
            backdropFilter: 'blur(20px)',
            border: '1px solid var(--border-color)',
            borderRadius: 2,
            boxShadow: '0 8px 32px var(--shadow-color)',
            '& .MuiMenuItem-root': {
              color: 'var(--text-primary)',
              '&:hover': {
                background: 'var(--hover-bg)',
              },
            },
          },
        }}
      >
        <MenuItem onClick={handleEdit}>
          <EditIcon sx={{ mr: 1, color: 'var(--accent-solid)' }} />
          수정
        </MenuItem>
        <MenuItem onClick={handleRefresh}>
          <RefreshIcon sx={{ mr: 1, color: '#4caf50' }} />
          새로고침
        </MenuItem>
        <MenuItem onClick={handleMarkAllRead}>
          <CheckCircleIcon sx={{ mr: 1, color: '#2196f3' }} />
          전체 읽음 처리
        </MenuItem>
        <MenuItem onClick={handleDelete}>
          <DeleteIcon sx={{ mr: 1, color: '#f44336' }} />
          삭제
        </MenuItem>
      </Menu>

      <Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
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
        <DialogTitle sx={{ color: 'var(--text-primary)', fontWeight: 600 }}>피드 수정</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="제목"
            fullWidth
            variant="outlined"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
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
            label="설명"
            fullWidth
            variant="outlined"
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
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
            label="URL"
            fullWidth
            variant="outlined"
            value={editUrl}
            onChange={(e) => setEditUrl(e.target.value)}
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
            value={editRefreshInterval}
            onChange={(e) => setEditRefreshInterval(Number(e.target.value))}
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
            onClick={() => setEditOpen(false)}
            sx={{ color: 'var(--text-secondary)' }}
          >
            취소
          </Button>
          <Button
            onClick={handleEditSave}
            variant="contained"
            sx={{
              background: 'var(--button-gradient)',
              '&:hover': {
                background: 'var(--button-gradient-hover)',
              },
            }}
          >
            저장
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
