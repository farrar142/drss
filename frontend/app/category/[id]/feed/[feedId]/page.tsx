'use client';

import React, { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { FeedViewer } from '@/components/FeedViewer';
import { useSettingsStore } from '@/stores/settingsStore';
import { RSSItem } from '@/types/rss';
import { feedsRouterListItemsByFeed } from '@/services/api';
import { usePagination, PaginationFilters } from '@/hooks/usePagination';

export default function FeedPage() {
    const params = useParams();
    const feedId = parseInt(params.feedId as string);
    const { filter } = useSettingsStore();

    const filters: PaginationFilters = useMemo(() => {
        switch (filter) {
            case 'unread':
                return { is_read: false };
            case 'read':
                return { is_read: true };
            case 'favorite':
                return { is_favorite: true };
            default:
                return {};
        }
    }, [filter]);

    const { items, handleLoadMore, handleLoadNew, hasNext, loading } = usePagination<RSSItem>(
        (args) => feedsRouterListItemsByFeed(feedId, args),
        (item) => item.published_at,
        `feed-${feedId}`,
        filters
    );

    return <FeedViewer items={items} onLoadMore={handleLoadMore} onLoadNew={handleLoadNew} hasNext={hasNext} loading={loading} />;
}
