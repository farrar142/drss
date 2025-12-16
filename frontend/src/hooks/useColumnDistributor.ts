'use client';

import { useState, useCallback, useRef, useEffect } from "react";

interface UseColumnDistributorOptions<T> {
  items: T[];
  columns: number;
  onLoadMore?: () => void;
  hasNext?: boolean;
  loading?: boolean;
  /** 대기열이 이 개수 이하가 되면 다음 페이지 로드 */
  queueThreshold?: number;
  /** 초기 로딩 시 각 컬럼에 배분할 때 딜레이 (ms) */
  initialDelay?: number;
  /** 활성화 여부 (비활성 시 IntersectionObserver 비활성화) */
  enabled?: boolean;
}

interface UseColumnDistributorReturn<T> {
  /** 각 컬럼에 배분된 아이템 */
  columnItems: T[][];
  /** 각 컬럼의 sentinel ref setter */
  setSentinelRef: (columnIndex: number) => (el: HTMLDivElement | null) => void;
  /** 대기열에 남은 아이템 수 */
  queueLength: number;
  /** 초기화 (새 피드 로드 시) */
  reset: () => void;
}

export function useColumnDistributor<T extends { id: number }>({
  items,
  columns,
  onLoadMore,
  hasNext = false,
  loading = false,
  queueThreshold = 5,
  initialDelay = 50,
  enabled = true,
}: UseColumnDistributorOptions<T>): UseColumnDistributorReturn<T> {
  // 각 컬럼에 배분된 아이템
  const [columnItems, setColumnItems] = useState<T[][]>(() =>
    Array.from({ length: columns }, () => [])
  );

  // 대기열 (아직 컬럼에 배분되지 않은 아이템)
  const queueRef = useRef<T[]>([]);
  const [queueLength, setQueueLength] = useState(0);

  // 이미 배분된 아이템 ID 추적
  const distributedIdsRef = useRef<Set<number>>(new Set());

  // sentinel refs
  const sentinelRefs = useRef<(HTMLDivElement | null)[]>([]);

  // 초기 배분 진행 중 여부
  const isInitialDistributingRef = useRef(false);

  // 컬럼 수 변경 감지
  const prevColumnsRef = useRef(columns);

  // 현재 뷰포트에 보이는 sentinel 추적
  const visibleSentinelsRef = useRef<Set<number>>(new Set());

  // onLoadMore ref
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;

  // hasNext, loading refs
  const hasNextRef = useRef(hasNext);
  hasNextRef.current = hasNext;
  const loadingRef = useRef(loading);
  loadingRef.current = loading;

  // 컬럼에 아이템 추가
  const addItemToColumn = useCallback((columnIndex: number): boolean => {
    if (queueRef.current.length === 0) return false;

    const item = queueRef.current.shift()!;
    setColumnItems(prev => {
      const next = prev.map(col => [...col]);
      next[columnIndex] = [...next[columnIndex], item];
      return next;
    });
    setQueueLength(queueRef.current.length);

    // 대기열이 임계값 이하면 다음 페이지 로드
    if (queueRef.current.length <= queueThreshold && hasNextRef.current && !loadingRef.current) {
      onLoadMoreRef.current?.();
    }

    return true;
  }, [queueThreshold]);

  // 뷰포트에 보이는 sentinel들에 아이템 추가 (반복 호출용)
  const fillVisibleSentinels = useCallback(() => {
    if (queueRef.current.length === 0) return;
    if (isInitialDistributingRef.current) return;

    // 각 sentinel을 체크해서 뷰포트에 있으면 아이템 추가
    let addedAny = false;

    for (let i = 0; i < columns; i++) {
      const sentinel = sentinelRefs.current[i];
      if (!sentinel) continue;

      const rect = sentinel.getBoundingClientRect();
      const isInViewport = rect.top < window.innerHeight + 300 && rect.bottom > -300;

      if (isInViewport && queueRef.current.length > 0) {
        addItemToColumn(i);
        addedAny = true;
      }
    }

    // 아이템이 추가되었고 아직 대기열에 남아있으면, 다음 프레임에 다시 체크
    if (addedAny && queueRef.current.length > 0) {
      requestAnimationFrame(() => {
        setTimeout(fillVisibleSentinels, 16);
      });
    }
  }, [columns, addItemToColumn]);

  // 초기 배분: 각 컬럼에 하나씩 순차적으로
  const distributeInitial = useCallback(() => {
    if (isInitialDistributingRef.current) return;
    if (queueRef.current.length === 0) return;

    isInitialDistributingRef.current = true;

    let currentColumn = 0;

    const distributeOne = () => {
      if (queueRef.current.length === 0 || currentColumn >= columns) {
        isInitialDistributingRef.current = false;
        // 초기 배분 완료 후 보이는 sentinel 채우기
        setTimeout(fillVisibleSentinels, 100);
        return;
      }

      addItemToColumn(currentColumn);
      currentColumn++;

      if (currentColumn < columns && queueRef.current.length > 0) {
        setTimeout(distributeOne, initialDelay);
      } else {
        isInitialDistributingRef.current = false;
        // 초기 배분 완료 후 보이는 sentinel 채우기
        setTimeout(fillVisibleSentinels, 100);
      }
    };

    distributeOne();
  }, [columns, addItemToColumn, initialDelay, fillVisibleSentinels]);

  // 새 아이템이 들어오면 대기열에 추가
  useEffect(() => {
    // items가 비어있으면 모든 것을 초기화 (필터 변경 등)
    if (items.length === 0) {
      // 이미 비어있으면 다시 초기화하지 않음 (무한 루프 방지)
      if (distributedIdsRef.current.size === 0 && queueRef.current.length === 0) {
        return;
      }
      queueRef.current = [];
      distributedIdsRef.current.clear();
      setColumnItems(Array.from({ length: columns }, () => []));
      setQueueLength(0);
      return;
    }

    const newItems = items.filter(item => !distributedIdsRef.current.has(item.id));

    if (newItems.length > 0) {
      // 새 아이템 ID 기록
      newItems.forEach(item => distributedIdsRef.current.add(item.id));

      // 대기열에 추가
      queueRef.current.push(...newItems);
      setQueueLength(queueRef.current.length);

      // 컬럼이 비어있으면 초기 배분 시작 (ref로 체크)
      if (distributedIdsRef.current.size === newItems.length) {
        // 새로 추가된 아이템만 있다 = 컬럼이 비어있었다
        distributeInitial();
      } else {
        // 이미 컬럼에 아이템이 있으면 바로 보이는 sentinel 채우기
        setTimeout(fillVisibleSentinels, 50);
      }
    }
  }, [items, distributeInitial, fillVisibleSentinels, columns]);

  // 컬럼 수 변경 시 리셋
  useEffect(() => {
    if (prevColumnsRef.current !== columns) {
      prevColumnsRef.current = columns;

      // 모든 아이템을 다시 대기열에 (items 기준으로)
      queueRef.current = [...items];
      distributedIdsRef.current.clear();
      items.forEach(item => distributedIdsRef.current.add(item.id));

      setColumnItems(Array.from({ length: columns }, () => []));
      setQueueLength(queueRef.current.length);

      // 재배분
      setTimeout(() => distributeInitial(), 50);
    }
  }, [columns, items, distributeInitial]);

  // IntersectionObserver로 sentinel 감지
  useEffect(() => {
    // 비활성 탭이면 observer 설정 안함
    if (!enabled) return;
    // 초기 배분 중이면 observer 설정 안함
    if (isInitialDistributingRef.current) return;

    const observers: IntersectionObserver[] = [];

    for (let columnIndex = 0; columnIndex < columns; columnIndex++) {
      const sentinel = sentinelRefs.current[columnIndex];
      if (!sentinel) continue;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              visibleSentinelsRef.current.add(columnIndex);
              // 아이템 추가 후 계속 체크
              if (queueRef.current.length > 0 && !isInitialDistributingRef.current) {
                addItemToColumn(columnIndex);
                // 추가 후에도 보이면 더 채우기
                setTimeout(fillVisibleSentinels, 50);
              }
            } else {
              visibleSentinelsRef.current.delete(columnIndex);
            }
          });
        },
        {
          threshold: 0,
          rootMargin: '300px 0px' // 300px 여유를 두고 미리 감지
        }
      );

      observer.observe(sentinel);
      observers.push(observer);
    }

    return () => {
      observers.forEach(obs => obs.disconnect());
    };
  }, [enabled, addItemToColumn, columns, fillVisibleSentinels]);

  // 스크롤 이벤트로 보충 (observer가 놓칠 수 있는 경우 대비)
  useEffect(() => {
    let rafId: number | null = null;

    const onScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (queueRef.current.length > 0 && !isInitialDistributingRef.current) {
          fillVisibleSentinels();
        }
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [fillVisibleSentinels]);

  // sentinel ref setter
  const setSentinelRef = useCallback((columnIndex: number) => (el: HTMLDivElement | null) => {
    sentinelRefs.current[columnIndex] = el;
  }, []);

  // 리셋 함수
  const reset = useCallback(() => {
    queueRef.current = [];
    distributedIdsRef.current.clear();
    visibleSentinelsRef.current.clear();
    setColumnItems(Array.from({ length: columns }, () => []));
    setQueueLength(0);
  }, [columns]);

  return {
    columnItems,
    setSentinelRef,
    queueLength,
    reset,
  };
}
