import { useState, useCallback, useEffect, useRef } from "react";

type PaginatedResponse<T> = {
  items: T[]
  has_next?: boolean;
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
  key?: string | number,
  filters?: PaginationFilters,
  enabled: boolean = true
) => {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasNext, setHasNext] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [newestCursor, setNewestCursor] = useState<string | null>(null);

  const cacheKey = `${key ?? '__default__'}-${JSON.stringify(filters ?? {})}`;

  // refs for stable callbacks
  const apiRef = useRef(paginationApi);
  const getCursorRef = useRef(getCursorField);
  const filtersRef = useRef(filters);
  const loadingRef = useRef(false);
  const initialLoadDoneRef = useRef(false);
  const prevCacheKeyRef = useRef(cacheKey);
  const enabledRef = useRef(enabled);

  // 매 렌더마다 최신 값으로 업데이트
  apiRef.current = paginationApi;
  getCursorRef.current = getCursorField;
  filtersRef.current = filters;
  enabledRef.current = enabled;

  // cacheKey 변경 감지 및 리셋
  if (prevCacheKeyRef.current !== cacheKey) {
    prevCacheKeyRef.current = cacheKey;
    initialLoadDoneRef.current = false;
    loadingRef.current = false;
  }

  const loadItems = useCallback(async (cursor?: string | null, direction: 'after' | 'before' = 'before') => {
    // enabled가 false면 로딩하지 않음
    if (!enabledRef.current) {
      return;
    }


    if (loadingRef.current) {
      return;
    }

    loadingRef.current = true;
    setLoading(true);

    try {
      console.log(`[usePagination:${key}] calling API...`);
      const response = await apiRef.current({
        limit: 10,
        cursor: cursor || undefined,
        direction,
        ...filtersRef.current
      });


      const newItems = response.items;

      setItems(prev => {
        const merged = direction === 'before'
          ? [...prev, ...newItems]
          : [...newItems, ...prev];
        const seen = new Set<number>();
        return merged.filter(item => {
          if (seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        });
      });

      if (direction === 'before') {
        setHasNext(response.has_next ?? false);
        setNextCursor(response.next_cursor || null);
      }

      if (newItems.length > 0) {
        const newestItem = direction === 'before' ? newItems[0] : newItems[newItems.length - 1];
        const newestItemCursor = getCursorRef.current(newestItem);
        setNewestCursor(prev => {
          if (!prev) return newestItemCursor;
          const dateA = new Date(newestItemCursor);
          const dateB = new Date(prev);
          if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
            return dateA > dateB ? newestItemCursor : prev;
          }
          return newestItemCursor > prev ? newestItemCursor : prev;
        });
      }

      initialLoadDoneRef.current = true;
    } catch (error) {
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [key]);

  // 초기 로드
  useEffect(() => {

    if (!enabled) {
      return;
    }

    if (initialLoadDoneRef.current) {
      return;
    }

    if (loadingRef.current) {
      return;
    }

    loadItems(undefined, 'before');
  }, [enabled, cacheKey, loadItems, key]);
  // cacheKey 변경 시 상태 리셋
  useEffect(() => {
    if (items.length === 0) return;
    setItems([])
    return () => {
      // cleanup: 다음 마운트를 위해 리셋하지 않음 (Strict Mode 대응)
    };
  }, [cacheKey]);

  const handleLoadMore = useCallback(() => {
    if (hasNext && nextCursor) {
      loadItems(nextCursor, 'before');
    }
  }, [hasNext, nextCursor, loadItems]);

  const handleLoadNew = useCallback(() => {
    if (newestCursor) {
      loadItems(newestCursor, 'after');
    } else {
      loadItems(undefined, 'before');
    }
  }, [newestCursor, loadItems]);

  return { items, handleLoadMore, handleLoadNew, hasNext, loading };
}
