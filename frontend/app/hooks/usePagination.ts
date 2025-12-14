import { useState, useCallback, useEffect, useRef } from "react";

type PaginatedResponse<T> = {
  items: T[]
  has_next: boolean;
  next_cursor?: string | null;
}

type PaginationState<T> = {
  items: T[];
  hasNext: boolean;
  nextCursor: string | null;
  newestCursor: string | null;
}

// Global cache to persist state across key changes
const paginationCache = new Map<string | number, PaginationState<any>>();

export const usePagination = <T extends { id: number }>(
  paginationApi: (args: {
    limit: number;
    cursor?: string;
    direction?: 'after' | 'before';
  }) => Promise<PaginatedResponse<T>>,
  getCursorField: (item: T) => string,
  key?: string | number  // key to cache and restore pagination state
) => {
  const cacheKey = key ?? '__default__';

  // Initialize state from cache or defaults
  const getInitialState = (): PaginationState<T> => {
    const cached = paginationCache.get(cacheKey);
    if (cached) return cached;
    return { items: [], hasNext: false, nextCursor: null, newestCursor: null };
  };

  const [state, setState] = useState<PaginationState<T>>(getInitialState);
  const [loading, setLoading] = useState(false);
  const prevKeyRef = useRef(cacheKey);

  // Restore state from cache when key changes
  useEffect(() => {
    if (prevKeyRef.current !== cacheKey) {
      const cached = paginationCache.get(cacheKey);
      if (cached) {
        setState(cached);
      } else {
        setState({ items: [], hasNext: false, nextCursor: null, newestCursor: null });
      }
      prevKeyRef.current = cacheKey;
    }
  }, [cacheKey]);

  // Save state to cache whenever it changes
  useEffect(() => {
    paginationCache.set(cacheKey, state);
  }, [cacheKey, state]);

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
        direction
      });
      const newItems = response.items;

      setState(prev => {
        const mergedItems = direction === 'before'
          ? [...prev.items, ...newItems]  // older items at the end
          : [...newItems, ...prev.items]; // newer items at the beginning
        const uniqueItems = removeDuplicates(mergedItems);

        let newNewestCursor = prev.newestCursor;
        if (newItems.length > 0) {
          const newestItem = direction === 'before' ? newItems[0] : newItems[newItems.length - 1];
          const newestItemCursor = getCursorField(newestItem);
          if (!newNewestCursor || compareCursors(newestItemCursor, newNewestCursor) > 0) {
            newNewestCursor = newestItemCursor;
          }
        }

        return {
          items: uniqueItems,
          hasNext: direction === 'before' ? response.has_next : prev.hasNext,
          nextCursor: direction === 'before' ? (response.next_cursor || null) : prev.nextCursor,
          newestCursor: newNewestCursor,
        };
      });
    } catch (error) {
      console.error('Failed to load items:', error);
    } finally {
      setLoading(false);
    }
  }, [loading, paginationApi, removeDuplicates, getCursorField, compareCursors]);

  useEffect(() => {
    if (state.items.length === 0 && !loading) {
      loadItems(undefined, 'before');  // Initial load - get newest items first
    }
  }, [state.items.length, loading, loadItems]);

  const handleLoadMore = useCallback(() => {
    // 이전 글 불러오기 (older items)
    if (state.hasNext && state.nextCursor) {
      loadItems(state.nextCursor, 'before');
    }
  }, [state.hasNext, state.nextCursor, loadItems]);

  const handleLoadNew = useCallback(() => {
    // 새로 생긴 글 불러오기 (newer items)
    if (state.newestCursor) {
      loadItems(state.newestCursor, 'after');
    }
  }, [state.newestCursor, loadItems]);

  const clearCache = useCallback(() => {
    paginationCache.delete(cacheKey);
    setState({ items: [], hasNext: false, nextCursor: null, newestCursor: null });
  }, [cacheKey]);

  return {
    items: state.items,
    handleLoadMore,
    handleLoadNew,
    hasNext: state.hasNext,
    loading,
    clearCache  // Expose method to manually clear cache if needed
  }
}

// Utility to clear all pagination cache
export const clearAllPaginationCache = () => {
  paginationCache.clear();
}
