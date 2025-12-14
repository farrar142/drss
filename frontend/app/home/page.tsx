'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { FeedItemViewer } from '../components/FeedItemViewer';
import { useRSSStore } from '../stores/rssStore';
import { RSSItem } from '../types/rss';
import { feedsRoutersItemListAllItems, PaginatedResponseItemSchema } from '../services/api';
import { usePagination } from '../hooks/usePagination';


export default function HomePage() {
  const { } = useRSSStore();
  const { items, handleLoadMore, handleLoadNew, hasNext, loading } = usePagination<RSSItem>(
    feedsRoutersItemListAllItems,
    (item) => item.published_at
  );


  return <FeedItemViewer items={items} onLoadMore={handleLoadMore} onLoadNew={handleLoadNew} hasNext={hasNext} loading={loading} />;
}
