'use client';

import React, { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { FeedViewer } from '@/components/FeedViewer';
import { useSettingsStore } from '@/stores/settingsStore';
import { useRSSStore } from '@/stores/rssStore';
import { RSSItem } from '@/types/rss';
import { listItemsByFeed } from '@/services/api';
import { usePagination, PaginationFilters } from '@/hooks/usePagination';

export default function FeedPage() {
    const params = useParams();
    const feedId = parseInt(params.feedId as string);
    const { filter } = useSettingsStore();
    const { searchQuery } = useRSSStore();

    const filters: PaginationFilters = useMemo(() => {
        const base: PaginationFilters = {};
        switch (filter) {
            case 'unread':
                base.is_read = false;
                break;
            case 'read':
                base.is_read = true;
                break;
            case 'favorite':
                base.is_favorite = true;
                break;
        }
        if (searchQuery.trim()) {
            base.search = searchQuery.trim();
        }
        return base;
    }, [filter, searchQuery]);

    const { items, handleLoadMore, handleLoadNew, hasNext, loading } = usePagination<RSSItem>(
        (args) => listItemsByFeed(feedId, args),
        (item) => item.published_at,
        `feed-${feedId}`,
        filters
    );

    return <FeedViewer items={items} onLoadMore={handleLoadMore} onLoadNew={handleLoadNew} hasNext={hasNext} loading={loading} />;
}
