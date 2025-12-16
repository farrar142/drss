'use client';

import React, { useMemo } from 'react';
import { FeedViewer } from '@/components/FeedViewer';
import { useRSSStore } from '@/stores/rssStore';
import { RSSItem } from '@/types/rss';
import { feedsRoutersItemListAllItems } from '@/services/api';
import { usePagination, PaginationFilters } from '@/hooks/usePagination';

export default function HomePage() {
  const { filter } = useRSSStore();

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
    feedsRoutersItemListAllItems,
    (item) => item.published_at,
    'home',
    filters
  );

  return (
    <FeedViewer
      items={items}
      onLoadMore={handleLoadMore}
      onLoadNew={handleLoadNew}
      hasNext={hasNext}
      loading={loading}
    />
  );
}
