'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Container,
    Box,
    Typography,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Alert,
} from '@mui/material';
import { useRSS } from '../context/RSSContext';
import { useAuth } from '../context/AuthContext';
import { RSSItem } from '../types/rss';

export default function RSSDashboard() {
    const router = useRouter();
    const { user } = useAuth();
    const {
        categories,
        feeds,
        feedItems,
        loading,
        error,
        loadFeedItems,
        markItemRead,
        toggleItemFavorite,
        refreshData,
    } = useRSS();

    const [filter, setFilter] = useState<'all' | 'unread' | 'read' | 'favorite'>('all');

    useEffect(() => {
        // 초기 데이터 로드
        refreshData();
    }, []);

    const filteredItems = feedItems.filter(item => {
        switch (filter) {
            case 'unread':
                return !item.is_read;
            case 'read':
                return item.is_read;
            case 'favorite':
                return item.is_favorite;
            default:
                return true;
        }
    });

    const handleMarkRead = async (item: RSSItem) => {
        try {
            await markItemRead(item.id);
        } catch (err) {
            console.error('Failed to mark item as read:', err);
        }
    };

    const handleToggleFavorite = async (item: RSSItem) => {
        try {
            await toggleItemFavorite(item.id);
        } catch (err) {
            console.error('Failed to toggle favorite:', err);
        }
    };

    const handleOpenLink = (url: string) => {
        window.open(url, '_blank');
    };

    const handleRefresh = () => {
        refreshData();
    };

    if (loading && categories.length === 0) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Container maxWidth="lg" sx={{ mt: 4 }}>
                <Alert severity="error">{error}</Alert>
            </Container>
        );
    }

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            {/* 카테고리별 피드 목록 */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                {categories.map((category) => {
                    const categoryFeeds = feeds.filter(feed => feed.category_id === category.id);

                    return (
                        <Card key={category.id} sx={{ minWidth: 250, cursor: 'pointer' }} onClick={() => router.push(`/category/${category.id}`)}>
                            <CardContent>
                                <Typography variant="h6" gutterBottom>
                                    {category.name}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" paragraph>
                                    {category.description}
                                </Typography>
                                <Chip label={`${categoryFeeds.length}개 피드`} size="small" />
                            </CardContent>
                        </Card>
                    );
                })}
            </Box>
        </Container>
    );
}