'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { FeedItemViewer } from '../components/FeedItemViewer';
import { useRSSStore } from '../stores/rssStore';
import { RSSItem } from '../types/rss';
import { feedsRoutersItemListAllItems, PaginatedResponseItemSchema } from '../services/api';

type PaginatedResponse<T> = {
  items: T[]
  has_next: boolean;
  next_cursor?: string | null;
}

const usePagination = <T = unknown>(paginationApi: (args: {
  limit: number;
  cursor?: string;
  direction?: 'after' | 'before';
}) => Promise<PaginatedResponse<T>>) => {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasNext, setHasNext] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const loadItems = useCallback(async (cursor?: string | null, direction: 'after' | 'before' = 'after') => {
    if (loading) return;
    setLoading(true);
    try {
      const response = await paginationApi({
        limit: 5,
        cursor: cursor || undefined,
        direction
      });
      const newItems = response.items
      if (direction === 'after') {
        setItems(prev => [...prev, ...newItems]);
      } else {
        setItems(prev => [...newItems, ...prev]);
      }
      setHasNext(response.has_next);
      setNextCursor(response.next_cursor || null);
    } catch (error) {
      console.error('Failed to load items:', error);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  useEffect(() => {
    if (items.length === 0) {
      loadItems();
    }
  }, [loadItems, items.length]);

  const handleLoadMore = useCallback(() => {
    if (hasNext && nextCursor) {
      loadItems(nextCursor, 'after');
    }
  }, [hasNext, nextCursor, loadItems]);
  return { items, handleLoadMore, hasNext }
}

export default function HomePage() {
  const { } = useRSSStore();
  const { items, handleLoadMore, hasNext } = usePagination<RSSItem>(feedsRoutersItemListAllItems);


  return <FeedItemViewer items={items} onLoadMore={handleLoadMore} hasNext={hasNext} />;
}
