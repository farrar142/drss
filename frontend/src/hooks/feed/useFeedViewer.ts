'use client';

import { useState, useCallback, useMemo, useRef, useEffect, RefObject } from "react";
import { RSSItem } from "@/types/rss";
import { useSettingsStore } from "@/stores/settingsStore";
import { useMediaQuery } from "../common/useMediaQuery";
import { useColumnDistributor } from "./useColumnDistributor";
import { useMediaModal } from "../media/useMediaModal";
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
  /** 최대 컴럼 수 (탭별 설정, 기본 3) */
  maxColumns?: number;
  /** 스크롤 컨테이너 ref (개별 패널 스크롤용) */
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
  /** 아이템 업데이트 콜백 */
  onItemUpdate?: (itemId: number, updatedData: Partial<RSSItem>) => void;
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

  // 스크롤 컨테이너 (PullToRefresh에서 사용)
  scrollContainerRef?: RefObject<HTMLDivElement | null>;

  // 아이템 새로고침 핸들러
  onItemRefreshed: (itemId: number, updatedData: Partial<RSSItem>) => void;
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
  maxColumns = 3,
  scrollContainerRef,
  onItemUpdate,
}: UseFeedViewerOptions): UseFeedViewerReturn {
  const { viewMode } = useSettingsStore();
  // 극도로 작은 화면 (480px 이하): 무조건 1열
  const isXs = useMediaQuery('(max-width: 480px)');
  // 작은 화면 (768px 이하): 최대 2열
  const isSm = useMediaQuery('(max-width: 768px)');
  // 중간 화면 (1024px 이하): 최대 3열
  const isMd = useMediaQuery('(max-width: 1024px)');

  // maxColumns 범위 제한 (1-5)
  const clampedMax = Math.max(1, Math.min(5, maxColumns));

  // 화면 크기에 따른 최대 컬럼 수 제한 (사용자 설정보다 우선)
  let screenMaxColumns = 5;
  if (isXs) screenMaxColumns = 1;
  else if (isSm) screenMaxColumns = 2;
  else if (isMd) screenMaxColumns = 3;

  // 화면 제한과 사용자 설정 중 작은 값 사용
  const columns = Math.min(clampedMax, screenMaxColumns);

  // Use column distributor instead of masonry layout
  const {
    columnItems,
    setSentinelRef,
    queueLength,
    reset: resetDistributor,
    updateItem: updateColumnItem,
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
  // 개별 스크롤 컨테이너 전달
  const cruising = useCruising({ minSpeed: 10, maxSpeed: 300, scrollContainerRef });

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

  // 아이템 새로고침 핸들러 - columnItems와 외부 onItemUpdate 둘 다 업데이트
  const onItemUpdateRef = useRef(onItemUpdate);
  onItemUpdateRef.current = onItemUpdate;

  const onItemRefreshed = useCallback((itemId: number, updatedData: Partial<RSSItem>) => {
    // columnItems 업데이트 (화면에 바로 반영)
    updateColumnItem(itemId, updatedData);
    // 외부 콜백도 호출 (usePagination의 items 업데이트)
    onItemUpdateRef.current?.(itemId, updatedData);
  }, [updateColumnItem]);

  // 반환 객체를 useMemo로 안정화 - 실제 값이 변경될 때만 새 객체 생성
  return useMemo(() => ({
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
    scrollContainerRef,
    onItemRefreshed,
  }), [
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
    scrollContainerRef,
    onItemRefreshed,
  ]);
}
