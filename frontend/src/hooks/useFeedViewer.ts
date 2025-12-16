'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { RSSItem } from "../types/rss";
import { useRSSStore } from "../stores/rssStore";
import { useMediaQuery } from "./useMediaQuery";
import { useColumnDistributor } from "./useColumnDistributor";
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

  // Expanded items
  expandedSet: Set<number>;
  handleCollapseChange: (id: number, collapsed: boolean) => void;

  // Media modal
  mediaModal: ReturnType<typeof useMediaModal>;
  handleMediaClick: (src: string, type?: 'image' | 'video', itemId?: number) => void;

  // Cruising
  cruising: ReturnType<typeof useCruising>;

  // Sentinel refs (for column distributor)
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

  // Queue info
  queueLength: number;
  resetDistributor: () => void;
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

  // Use column distributor instead of masonry layout
  const {
    columnItems,
    setSentinelRef,
    queueLength,
    reset: resetDistributor
  } = useColumnDistributor({
    items,
    columns,
    onLoadMore,
    hasNext,
    loading,
    queueThreshold: 5,
    initialDelay: 80,
  });

  // Use extracted hooks
  const mediaModal = useMediaModal({ items });
  // 지수 함수 속도: 0%→10px/s, 100%→300px/s (기본 속도는 settingsStore에서 관리)
  const cruising = useCruising({ minSpeed: 10, maxSpeed: 300 });

  // Use ref to always have access to latest callback
  const onLoadNewRef = useRef(onLoadNew);
  onLoadNewRef.current = onLoadNew;

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
    queueLength,
    resetDistributor,
  };
}
