'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { FeedItemViewer } from '../../../../components/FeedItemViewer';
import { RSSItem } from '../../../../types/rss';
import { feedsRoutersItemListItemsByFeed } from '../../../../services/api';
import { usePagination } from '../../../../hooks/usePagination';

export default function FeedPage() {
    const params = useParams();
    const feedId = parseInt(params.feedId as string);

    const { items, handleLoadMore, handleLoadNew, hasNext, loading } = usePagination<RSSItem>(
        (args) => feedsRoutersItemListItemsByFeed(feedId, {
            limit: args.limit,
            cursor: args.cursor,
            direction: args.direction,
        }),
        (item) => item.published_at,
        feedId  // Reset pagination when feed changes
    );

    return <FeedItemViewer items={items} onLoadMore={handleLoadMore} onLoadNew={handleLoadNew} hasNext={hasNext} loading={loading} />;
}
