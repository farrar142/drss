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

const usePagination = <T extends { id: number }>(paginationApi: (args: {
  limit: number;
  cursor?: string;
  direction?: 'after' | 'before';
}) => Promise<PaginatedResponse<T>>) => {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasNext, setHasNext] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const removeDuplicates = useCallback((items: T[]) => {
    const seen = new Set<number>();
    return items.filter(item => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, []);

  const loadItems = useCallback(async (cursor?: string | null, direction: 'after' | 'before' = 'after') => {
    if (loading) return;
    setLoading(true);
    try {
      const response = await paginationApi({
        limit: 10,
        cursor: cursor || undefined,
        direction
      });
      const newItems = response.items
      setItems(prev => removeDuplicates(direction === 'before' ? [...prev, ...newItems] : [...newItems, ...prev]));
      setHasNext(response.has_next);
      setNextCursor(response.next_cursor || null);
    } catch (error) {
      console.error('Failed to load items:', error);
    } finally {
      setLoading(false);
    }
  }, [loading, removeDuplicates]);

  useEffect(() => {
    if (items.length === 0) {
      loadItems();
    }
  }, [loadItems, items.length]);

  const handleLoadMore = useCallback(() => {
    //이전 글 불러오기
    if (hasNext && nextCursor) {
      loadItems(nextCursor, 'before');
    }
  }, [hasNext, nextCursor, loadItems]);

  const handleLoadNew = useCallback(() => {
    //새로 생긴 글 불러오기
    loadItems(null, 'after');
  }, [loadItems]);

  return { items, handleLoadMore, handleLoadNew, hasNext }
}

export default function HomePage() {
  const { } = useRSSStore();
  const { items, handleLoadMore, handleLoadNew, hasNext } = usePagination<RSSItem>(feedsRoutersItemListAllItems);


  return <FeedItemViewer items={items} onLoadMore={handleLoadMore} onLoadNew={handleLoadNew} hasNext={hasNext} />;
}
