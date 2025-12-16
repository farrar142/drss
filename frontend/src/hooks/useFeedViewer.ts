'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { RSSItem } from "../types/rss";
import { useSettingsStore } from "../stores/settingsStore";
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
  /** 탭 활성화 여부 (비활성 시 IntersectionObserver 비활성화) */
  isActive?: boolean;
}

export interface UseFeedViewerReturn {
  // Store state
  viewMode: 'board' | 'feed';

  // Column layout
  columns: number;
  columnItems: RSSItem[][];

  // Collapse handler
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
  isActive = true,
}: UseFeedViewerOptions): UseFeedViewerReturn {
  const { viewMode } = useSettingsStore();
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
    enabled: isActive,
  });

  // Use extracted hooks
  const mediaModal = useMediaModal({ items });
  // 지수 함수 속도: 0%→10px/s, 100%→300px/s (기본 속도는 settingsStore에서 관리)
  const cruising = useCruising({ minSpeed: 10, maxSpeed: 300 });

  // Use ref to always have access to latest callback
  const onLoadNewRef = useRef(onLoadNew);
  onLoadNewRef.current = onLoadNew;

  // Auto-refresh state
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isRefreshingRef = useRef(false);
  const [newPostsCount, setNewPostsCount] = useState(externalNewPostsCount);

  // Update newPostsCount when external value changes
  useEffect(() => {
    setNewPostsCount(externalNewPostsCount);
  }, [externalNewPostsCount]);

  // Auto-refresh
  useEffect(() => {
    if (!onLoadNew || autoRefreshInterval <= 0) return;

    // 자동 새로고침 실행
    const intervalId = setInterval(async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      if (isRefreshingRef.current) return;

      try {
        isRefreshingRef.current = true;
        setIsRefreshing(true);
        const cb = onLoadNewRef.current;
        if (cb) {
          const res = cb();
          if (res && typeof (res as any).then === 'function') {
            await res;
          }
        }
      } finally {
        isRefreshingRef.current = false;
        setIsRefreshing(false);
      }
    }, autoRefreshInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [onLoadNew, autoRefreshInterval]);

  // Handle manual load new
  const handleLoadNew = useCallback(async () => {
    if (isRefreshingRef.current) return;

    try {
      isRefreshingRef.current = true;
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
      isRefreshingRef.current = false;
      setIsRefreshing(false);
    }
  }, []);

  // Collapse change handler (currently unused but kept for potential future use)
  const handleCollapseChange = useCallback((_id: number, _collapsed: boolean) => {
    // Currently no-op, can be used for tracking collapsed state if needed
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
    handleCollapseChange,
    mediaModal,
    handleMediaClick,
    cruising,
    setSentinelRef,
    onLoadNew,
    hasNext,
    loading,
    items,
    newPostsCount,
    isRefreshing,
    handleLoadNew,
    queueLength,
    resetDistributor,
  };
}
