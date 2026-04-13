'use client';

import React, { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { FeedViewer } from '@/components/feed/FeedViewer';
import { useSettingsStore } from '@/stores/settingsStore';
import { useRSSStore } from '@/stores/rssStore';
import { RSSItem } from '@/types/rss';
import { listItemsByCategory } from '@/services/api';
import { usePagination, PaginationFilters } from '@/hooks/feed/usePagination';

export default function CategoryPage() {
  const params = useParams();
  const categoryId = Number(params.id);
  const { filter, columns } = useSettingsStore();
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

  const { items, handleLoadMore, handleLoadNew, hasNext, loading, updateItem, removeItem } = usePagination<RSSItem>(
    (args) => listItemsByCategory(categoryId, args),
    (item) => item.published_at,
    `category-${categoryId}`,
    filters
  );

  return (
    <FeedViewer
      items={items}
      onLoadMore={handleLoadMore}
      onLoadNew={handleLoadNew}
      hasNext={hasNext}
      loading={loading}
      maxColumns={columns}
      onItemUpdate={updateItem}
      onItemDelete={removeItem}
    />
  );
}
