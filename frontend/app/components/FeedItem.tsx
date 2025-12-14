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
} from "@mui/material";
import { useRouter } from "next/navigation";
import { RSSFeed } from "../types/rss";
import { feedsRouterUpdateFeed, feedsRouterRefreshFeed, feedsRouterDeleteFeed, feedsRouterMarkAllFeedItemsRead, FeedSchema } from "../services/api";
import { useRSSStore } from "../stores/rssStore";

interface FeedItemProps {
    feed: FeedSchema;
    categoryId: number;
}

export const FeedItem: React.FC<FeedItemProps> = ({ feed, categoryId }) => {
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
            const updatedFeed = await feedsRouterUpdateFeed(feed.id, {
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
            await feedsRouterRefreshFeed(feed.id);
            alert('피드 새로고침이 예약되었습니다.');
        } catch (error) {
            console.error(error);
        }
        setAnchorEl(null);
    };

    const handleDelete = async () => {
        if (confirm('정말로 이 피드를 삭제하시겠습니까?')) {
            try {
                await feedsRouterDeleteFeed(feed.id);
                removeFeed(feed.id);
            } catch (error) {
                console.error(error);
            }
        }
        setAnchorEl(null);
    };

    const handleMarkAllRead = async () => {
        try {
            await feedsRouterMarkAllFeedItemsRead(feed.id);
            alert('모든 아이템을 읽음으로 표시했습니다.');
        } catch (error) {
            console.error(error);
        }
        setAnchorEl(null);
    };

    return (
        <>
            <ListItem key={feed.id} disablePadding>
                <ListItemButton onClick={() => router.push(`/category/${categoryId}/feed/${feed.id}`)}>
                    <ListItemIcon>
                        {feed.favicon_url ? (
                            <Avatar src={feed.favicon_url} sx={{ width: 24, height: 24 }} />
                        ) : (
                            <RssFeedIcon />
                        )}
                    </ListItemIcon>
                    <ListItemText primary={feed.title} secondary={feed.item_count} />
                </ListItemButton>
                <IconButton onClick={handleMenuClick}>
                    <MoreVertIcon />
                </IconButton>
            </ListItem>

            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
            >
                <MenuItem onClick={handleEdit}>
                    <EditIcon sx={{ mr: 1 }} />
                    수정
                </MenuItem>
                <MenuItem onClick={handleRefresh}>
                    <RefreshIcon sx={{ mr: 1 }} />
                    새로고침
                </MenuItem>
                <MenuItem onClick={handleMarkAllRead}>
                    <CheckCircleIcon sx={{ mr: 1 }} />
                    전체 읽음 처리
                </MenuItem>
                <MenuItem onClick={handleDelete}>
                    <DeleteIcon sx={{ mr: 1 }} />
                    삭제
                </MenuItem>
            </Menu>

            <Dialog open={editOpen} onClose={() => setEditOpen(false)}>
                <DialogTitle>피드 수정</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="제목"
                        fullWidth
                        variant="standard"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                    />
                    <TextField
                        margin="dense"
                        label="설명"
                        fullWidth
                        variant="standard"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                    />
                    <TextField
                        margin="dense"
                        label="URL"
                        fullWidth
                        variant="standard"
                        value={editUrl}
                        onChange={(e) => setEditUrl(e.target.value)}
                    />
                    <TextField
                        margin="dense"
                        label="새로고침 간격 (분)"
                        type="number"
                        fullWidth
                        variant="standard"
                        value={editRefreshInterval}
                        onChange={(e) => setEditRefreshInterval(Number(e.target.value))}
                        inputProps={{ min: 1 }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditOpen(false)}>취소</Button>
                    <Button onClick={handleEditSave}>저장</Button>
                </DialogActions>
            </Dialog>
        </>
    );
};