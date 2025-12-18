'use client';

import React, { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { FeedViewer } from '@/components/FeedViewer';
import { useSettingsStore } from '@/stores/settingsStore';
import { useRSSStore } from '@/stores/rssStore';
import { RSSItem } from '@/types/rss';
import { listItemsByCategory } from '@/services/api';
import { usePagination, PaginationFilters } from '@/hooks/usePagination';

export default function CategoryPage() {
    const params = useParams();
    const categoryId = parseInt(params.id as string);
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
        (args) => listItemsByCategory(categoryId, args),
        (item) => item.published_at,
        `category-${categoryId}`,
        filters
    );

    return <FeedViewer items={items} onLoadMore={handleLoadMore} onLoadNew={handleLoadNew} hasNext={hasNext} loading={loading} />;
}
