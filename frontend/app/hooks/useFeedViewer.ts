'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { RSSItem } from "../types/rss";
import { useRSSStore } from "../stores/rssStore";
import { useMediaQuery } from "./useMediaQuery";
import { useMasonryLayout } from "./useMasonryLayout";
import { useMediaModal } from "./useMediaModal";
import { useCruising } from "./useCruising";

export interface UseFeedViewerOptions {
  items: RSSItem[];
  onLoadMore?: () => void;
  onLoadNew?: () => void | Promise<void>;
  hasNext?: boolean;
  loading?: boolean;
  /** 새 글 개수 (외부에서 계산해서 전달) */
  newPostsCount?: number;
  /** 자동 새로고침 간격 (ms), 기본 60초 */
  autoRefreshInterval?: number;
}

export interface UseFeedViewerReturn {
  // Store state
  viewMode: 'board' | 'feed';

  // Column layout
  columns: number;
  columnItems: RSSItem[][];
  useCSSColumns: boolean;
  columnSentinelIndexes: number[];

  // Masonry helpers
  registerHeight: (id: number, height: number) => void;
  getItemHeight: (id: number) => number;

  // Expanded items
  expandedSet: Set<number>;
  handleCollapseChange: (id: number, collapsed: boolean) => void;

  // Media modal
  mediaModal: ReturnType<typeof useMediaModal>;
  handleMediaClick: (src: string, type?: 'image' | 'video', itemId?: number) => void;

  // Cruising
  cruising: ReturnType<typeof useCruising>;

  // Sentinel refs
  setSentinelRef: (index: number) => (el: HTMLDivElement | null) => void;

  // Handlers
  onLoadNew?: () => void | Promise<void>;
  hasNext?: boolean;
  loading?: boolean;
  items: RSSItem[];

  // Auto-refresh
  refreshProgress: number;
  newPostsCount: number;
  isRefreshing: boolean;
  handleLoadNew: () => void;
}

export function useFeedViewer({
  items,
  onLoadMore,
  onLoadNew,
  hasNext,
  loading,
  newPostsCount: externalNewPostsCount = 0,
  autoRefreshInterval = 60000,
}: UseFeedViewerOptions): UseFeedViewerReturn {
  const { viewMode } = useRSSStore();
  const isMd = useMediaQuery('(max-width: 768px)');
  const isXl = useMediaQuery('(min-width: 1280px)');

  // Calculate columns based on screen size
  let columns = 1;
  if (isXl) columns = 3;
  else if (!isMd) columns = 2;

  const { columnItems, registerHeight, getItemHeight } = useMasonryLayout(items, columns);

  // Use extracted hooks
  const mediaModal = useMediaModal({ items });
  // 지수 함수 속도: 0%→10px/s, 100%→300px/s
  const cruising = useCruising({ minSpeed: 10, maxSpeed: 300, defaultSpeed: 10 });

  // Use fast, CSS-based masonry when possible
  const useCSSColumns = true;

  // For CSS columns mode, compute sentinel positions
  const columnSentinelIndexes = useMemo(() => {
    if (!useCSSColumns) return [] as number[];
    const n = items.length;
    if (n === 0) return [] as number[];
    const idxs: number[] = [];
    for (let c = 1; c <= columns; c++) {
      const pos = Math.max(0, Math.min(n - 1, Math.ceil((c * n) / columns) - 1));
      idxs.push(pos);
    }
    return idxs;
  }, [items.length, columns, useCSSColumns]);

  // Multiple sentinel refs for each column
  const sentinelRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Use ref to always have access to latest callback
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;
  const onLoadNewRef = useRef(onLoadNew);
  onLoadNewRef.current = onLoadNew;

  // Callback ref setter for sentinel elements
  const setSentinelRef = useCallback((index: number) => (el: HTMLDivElement | null) => {
    sentinelRefs.current[index] = el;
  }, []);

  // Intersection observer for infinite scroll
  useEffect(() => {
    if (!hasNext || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const isAnyIntersecting = entries.some(entry => entry.isIntersecting);
        if (isAnyIntersecting && onLoadMoreRef.current) {
          onLoadMoreRef.current();
          console.log("Loading more items...");
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    sentinelRefs.current.forEach(ref => {
      if (ref) observer.observe(ref);
    });

    // Fallback scroll handler
    let rafId: number | null = null;
    let resizeTimeoutId: NodeJS.Timeout | null = null;

    const checkNearBottom = () => {
      if (!hasNext || loading) return;
      const scrollY = window.scrollY || window.pageYOffset;
      const vh = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;
      const threshold = 300;
      if (scrollY + vh + threshold >= docHeight) {
        if (onLoadMoreRef.current) {
          onLoadMoreRef.current();
          console.log('Loading more items (near-bottom fallback)...');
        }
      }
    };

    const onScroll = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        checkNearBottom();
        rafId = null;
      });
    };

    // Debounced resize handler - only trigger after resize settles
    const onResize = () => {
      if (resizeTimeoutId) clearTimeout(resizeTimeoutId);
      resizeTimeoutId = setTimeout(() => {
        checkNearBottom();
        resizeTimeoutId = null;
      }, 150);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    checkNearBottom();

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (resizeTimeoutId) clearTimeout(resizeTimeoutId);
    };
  }, [hasNext, loading, columns]);

  // Auto-refresh state
  const [refreshProgress, setRefreshProgress] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [newPostsCount, setNewPostsCount] = useState(externalNewPostsCount);

  // Update newPostsCount when external value changes
  useEffect(() => {
    setNewPostsCount(externalNewPostsCount);
  }, [externalNewPostsCount]);

  // Auto-refresh with progress
  useEffect(() => {
    if (!onLoadNew || autoRefreshInterval <= 0) return;

    const startTime = Date.now();
    let animationId: number;

    const updateProgress = () => {
      if (typeof document !== 'undefined' && document.hidden) {
        // 탭이 숨겨져 있으면 진행률 유지
        animationId = requestAnimationFrame(updateProgress);
        return;
      }

      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / autoRefreshInterval) * 100, 100);
      setRefreshProgress(progress);

      if (progress < 100) {
        animationId = requestAnimationFrame(updateProgress);
      }
    };

    animationId = requestAnimationFrame(updateProgress);

    // 자동 새로고침 실행
    const intervalId = setInterval(async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      if (isRefreshing) return;

      try {
        setIsRefreshing(true);
        const cb = onLoadNewRef.current;
        if (cb) {
          const res = cb();
          if (res && typeof (res as any).then === 'function') {
            await res;
          }
        }
      } finally {
        setIsRefreshing(false);
        setRefreshProgress(0);
      }
    }, autoRefreshInterval);

    const visibilityHandler = () => {
      if (!document.hidden) {
        // 탭이 다시 보이면 진행률 리셋
        setRefreshProgress(0);
      }
    };
    document.addEventListener('visibilitychange', visibilityHandler);

    return () => {
      cancelAnimationFrame(animationId);
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', visibilityHandler);
    };
  }, [onLoadNew, autoRefreshInterval, isRefreshing]);

  // Handle manual load new
  const handleLoadNew = useCallback(async () => {
    if (isRefreshing) return;

    try {
      setIsRefreshing(true);
      const cb = onLoadNewRef.current;
      if (cb) {
        const res = cb();
        if (res && typeof (res as any).then === 'function') {
          await res;
        }
      }
      setNewPostsCount(0);
    } finally {
      setIsRefreshing(false);
      setRefreshProgress(0);
    }
  }, [isRefreshing]);

  // Track expanded items
  const [expandedSet, setExpandedSet] = useState<Set<number>>(new Set());
  const handleCollapseChange = useCallback((id: number, collapsed: boolean) => {
    setExpandedSet(prev => {
      const next = new Set(prev);
      if (!collapsed) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  // Handle media click - use ref to stabilize callback
  const mediaModalRef = useRef(mediaModal);
  mediaModalRef.current = mediaModal;

  const handleMediaClick = useCallback((src: string, type: 'image' | 'video' = 'image', itemId?: number) => {
    mediaModalRef.current.openMedia(src, type, itemId);
  }, []);

  return {
    viewMode,
    columns,
    columnItems,
    useCSSColumns,
    columnSentinelIndexes,
    registerHeight,
    getItemHeight,
    expandedSet,
    handleCollapseChange,
    mediaModal,
    handleMediaClick,
    cruising,
    setSentinelRef,
    onLoadNew,
    hasNext,
    loading,
    items,
    refreshProgress,
    newPostsCount,
    isRefreshing,
    handleLoadNew,
  };
}
