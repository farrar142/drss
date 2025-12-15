'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { RSSItem } from "../types/rss";
import { useRSSStore } from "../stores/rssStore";
import { useMediaQuery } from "./useMediaQuery";
import { useMasonryLayout } from "./useMasonryLayout";
import { useMediaModal } from "./useMediaModal";
import { useCruising } from "./useCruising";

export interface UseFeedItemViewerOptions {
  items: RSSItem[];
  onLoadMore?: () => void;
  onLoadNew?: () => void;
  hasNext?: boolean;
  loading?: boolean;
}

export interface UseFeedItemViewerReturn {
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
  onLoadNew?: () => void;
  hasNext?: boolean;
  loading?: boolean;
  items: RSSItem[];
}

export function useFeedItemViewer({
  items,
  onLoadMore,
  onLoadNew,
  hasNext,
  loading,
}: UseFeedItemViewerOptions): UseFeedItemViewerReturn {
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

  // Auto-refresh every 60 seconds
  useEffect(() => {
    if (!onLoadNew) return;

    let inFlight = false;

    const doTick = async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      if (inFlight) return;
      const cb = onLoadNewRef.current;
      if (!cb) return;
      try {
        inFlight = true;
        const res = cb();
        const p = res as any;
        if (p && typeof p.then === 'function') await p;
      } catch (e) {
        // ignore
      } finally {
        inFlight = false;
      }
    };

    const intervalId = window.setInterval(doTick, 60 * 1000);

    const visibilityHandler = () => {
      if (!document.hidden) doTick();
    };
    document.addEventListener('visibilitychange', visibilityHandler);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', visibilityHandler);
    };
  }, [onLoadNew]);

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
  };
}
