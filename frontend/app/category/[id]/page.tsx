'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { FeedItemViewer } from '../../components/FeedItemViewer';
import { RSSItem } from '../../types/rss';
import { feedsRoutersItemListItemsByCategory } from '../../services/api';
import { usePagination } from '../../hooks/usePagination';

export default function CategoryPage() {
    const params = useParams();
    const categoryId = parseInt(params.id as string);

    const { items, handleLoadMore, handleLoadNew, hasNext, loading } = usePagination<RSSItem>(
        (args) => feedsRoutersItemListItemsByCategory(categoryId, {
            limit: args.limit,
            cursor: args.cursor,
            direction: args.direction,
        }),
        (item) => item.published_at,
        categoryId  // Reset pagination when category changes
    );

    return <FeedItemViewer items={items} onLoadMore={handleLoadMore} onLoadNew={handleLoadNew} hasNext={hasNext} loading={loading} />;
}
