import { useState, useCallback, useEffect, useRef } from "react";

type PaginatedResponse<T> = {
  items: T[]
  has_next: boolean;
  next_cursor?: string | null;
}

export type PaginationFilters = {
  is_read?: boolean;
  is_favorite?: boolean;
  search?: string;
}

export const usePagination = <T extends { id: number }>(
  paginationApi: (args: {
    limit: number;
    cursor?: string;
    direction?: 'after' | 'before';
  } & PaginationFilters) => Promise<PaginatedResponse<T>>,
  getCursorField: (item: T) => string,
  key?: string | number,  // key to reset pagination when changed
  filters?: PaginationFilters
) => {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasNext, setHasNext] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [newestCursor, setNewestCursor] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);  // Track if initial load is done

  // Combine key and filters into a single dependency string
  const cacheKey = `${key ?? '__default__'}-${JSON.stringify(filters ?? {})}`;
  const prevKeyRef = useRef(cacheKey);

  // Reset state when key or filters change
  useEffect(() => {
    if (prevKeyRef.current !== cacheKey) {
      setItems([]);
      setHasNext(false);
      setNextCursor(null);
      setNewestCursor(null);
      setInitialized(false);  // Reset initialized flag
      prevKeyRef.current = cacheKey;
    }
  }, [cacheKey]);

  const removeDuplicates = useCallback((items: T[]) => {
    const seen = new Set<number>();
    return items.filter(item => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, []);

  const compareCursors = useCallback((a: string, b: string) => {
    // Try to compare as numbers first
    const numA = Number(a);
    const numB = Number(b);
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }

    // Try to compare as dates
    const dateA = new Date(a);
    const dateB = new Date(b);
    if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
      return dateA.getTime() - dateB.getTime();
    }

    // Fallback to string comparison
    return a.localeCompare(b);
  }, []);

  const loadItems = useCallback(async (cursor?: string | null, direction: 'after' | 'before' = 'before') => {
    if (loading) return;
    setLoading(true);
    try {
      const response = await paginationApi({
        limit: 10,
        cursor: cursor || undefined,
        direction,
        ...filters
      });
      const newItems = response.items;

      setItems(prev => {
        const merged = direction === 'before'
          ? [...prev, ...newItems]  // older items at the end
          : [...newItems, ...prev]; // newer items at the beginning
        return removeDuplicates(merged);
      });

      if (direction === 'before') {
        // Update cursor for loading older items
        setHasNext(response.has_next);
        setNextCursor(response.next_cursor || null);
      }

      // Update newest cursor if we got new items
      if (newItems.length > 0) {
        // For 'before' direction, first item is newest; for 'after', last item is newest
        const newestItem = direction === 'before' ? newItems[0] : newItems[newItems.length - 1];
        const newestItemCursor = getCursorField(newestItem);
        setNewestCursor(prev => {
          if (!prev) return newestItemCursor;
          // Keep the most recent cursor
          return compareCursors(newestItemCursor, prev) > 0 ? newestItemCursor : prev;
        });
      }
    } catch (error) {
      console.error('Failed to load items:', error);
    } finally {
      setLoading(false);
      setInitialized(true);  // Mark as initialized after first load attempt
    }
  }, [loading, paginationApi, removeDuplicates, getCursorField, compareCursors, filters]);

  useEffect(() => {
    if (!initialized && !loading) {
      loadItems(undefined, 'before');  // Initial load - get newest items first
    }
  }, [initialized, loading, loadItems]);

  const handleLoadMore = useCallback(() => {
    // 이전 글 불러오기 (older items)
    if (hasNext && nextCursor) {
      loadItems(nextCursor, 'before');
    }
  }, [hasNext, nextCursor, loadItems]);

  const handleLoadNew = useCallback(() => {
    // 새로 생긴 글 불러오기 (newer items)
    if (newestCursor) {
      loadItems(newestCursor, 'after');
    }
  }, [newestCursor, loadItems]);

  return { items, handleLoadMore, handleLoadNew, hasNext, loading }
}
