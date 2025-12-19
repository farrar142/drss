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
  key?: string | number,  // key to reset pagination when changed
  filters?: PaginationFilters,
  enabled: boolean = true  // 활성화 여부 - false이면 데이터 로딩하지 않음
) => {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasNext, setHasNext] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [newestCursor, setNewestCursor] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Combine key and filters into a single dependency string
  const cacheKey = `${key ?? '__default__'}-${JSON.stringify(filters ?? {})}`;
  const prevKeyRef = useRef<string | null>(null);
  const isFirstRender = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Reset state when key or filters change
  useEffect(() => {
    // 첫 렌더 시에는 prevKeyRef를 설정만 하고 리셋하지 않음
    if (isFirstRender.current) {
      isFirstRender.current = false;
      prevKeyRef.current = cacheKey;
      return;
    }

    if (prevKeyRef.current !== cacheKey) {
      // 진행 중인 요청 취소
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      setItems([]);
      setHasNext(false);
      setNextCursor(null);
      setNewestCursor(null);
      setInitialized(false);
      setLoading(false);
      prevKeyRef.current = cacheKey;
    }
  }, [cacheKey]);

  // 컴포넌트 언마운트 시 요청 취소
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

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
    // 비활성 탭에서는 API 요청 차단
    if (!enabled) return;

    if (loading) return;

    // 이전 요청 취소 마킹
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // 새 AbortController 생성 (signal.aborted로 취소 여부 체크)
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setLoading(true);
    try {
      const response = await paginationApi({
        limit: 10,
        cursor: cursor || undefined,
        direction,
        ...filters
      });

      // 응답이 왔을 때 취소되었으면 무시
      if (abortController.signal.aborted) return;

      const newItems = response.items;

      setItems(prev => {
        const merged = direction === 'before'
          ? [...prev, ...newItems]  // older items at the end
          : [...newItems, ...prev]; // newer items at the beginning
        return removeDuplicates(merged);
      });

      if (direction === 'before') {
        // Update cursor for loading older items
        setHasNext(response.has_next ?? false);
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
      // 취소된 요청은 무시
      if (abortController.signal.aborted) return;
      console.error('Failed to load items:', error);
    } finally {
      // 취소되지 않은 요청만 상태 업데이트
      if (!abortController.signal.aborted) {
        setLoading(false);
        setInitialized(true);
      }
    }
  }, [enabled, key, loading, paginationApi, removeDuplicates, getCursorField, compareCursors, filters]);

  useEffect(() => {
    // enabled가 false이면 로딩하지 않음
    if (!enabled) return;

    if (!initialized && !loading) {
      loadItems(undefined, 'before');  // Initial load - get newest items first
    }
  }, [enabled, initialized, loading, loadItems, cacheKey]);  // enabled, cacheKey 추가하여 필터 변경 시 재fetch

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
    } else {
      // 빈 화면에서는 초기 로드 수행
      loadItems(undefined, 'before');
    }
  }, [newestCursor, loadItems]);

  return { items, handleLoadMore, handleLoadNew, hasNext, loading }
}
