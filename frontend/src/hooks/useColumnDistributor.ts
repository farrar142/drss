'use client';

import { useState, useCallback, useRef, useEffect } from "react";

// 리사이즈 후 대기 중인 fillVisibleSentinels 호출이 있는지
let pendingFillAfterResize = false;

// 리사이즈 중인지 감지하는 전역 플래그
let isResizing = false;
let resizeTimeoutId: ReturnType<typeof setTimeout> | null = null;

// 리사이즈 완료 후 콜백 등록
let onResizeEndCallbacks: (() => void)[] = [];

if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => {
    isResizing = true;
    if (resizeTimeoutId) clearTimeout(resizeTimeoutId);
    resizeTimeoutId = setTimeout(() => {
      isResizing = false;
      resizeTimeoutId = null;
      // 리사이즈 종료 후 대기 중인 콜백 실행
      const callbacks = onResizeEndCallbacks;
      onResizeEndCallbacks = [];
      callbacks.forEach(cb => cb());
    }, 200);
  }, { passive: true });
}

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

  // 현재 컬럼 수 ref (최신 값 유지)
  const columnsRef = useRef(columns);
  columnsRef.current = columns;

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

  // 컴럼에 아이템 추가
  const addItemToColumn = useCallback((columnIndex: number): boolean => {
    if (queueRef.current.length === 0) return false;

    const item = queueRef.current.shift()!;
    const currentColumns = columnsRef.current;

    setColumnItems(prev => {
      // 컬럼 인덱스가 범위를 벗어나면 무시
      if (columnIndex >= currentColumns) {
        // 아이템을 다시 대기열에 넣음
        queueRef.current.unshift(item);
        return prev;
      }

      // 컬럼 배열 크기가 현재 컬럼 수와 다르면 새 배열 생성
      if (prev.length !== currentColumns) {
        const next = Array.from({ length: currentColumns }, (_, i) =>
          i < prev.length ? [...prev[i]] : []
        );
        next[columnIndex] = [...next[columnIndex], item];
        return next;
      }

      // 해당 컬럼만 새 배열로 교체 (다른 컬럼은 그대로 참조)
      const next = [...prev];
      next[columnIndex] = [...prev[columnIndex], item];
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
    // 리사이즈 중에는 처리 건너뛰기 (레이아웃 스래싱 방지)
    if (isResizing) {
      // 이미 대기 중이면 추가 등록 안함
      if (!pendingFillAfterResize) {
        pendingFillAfterResize = true;
        onResizeEndCallbacks.push(() => {
          pendingFillAfterResize = false;
          fillVisibleSentinels();
        });
      }
      return;
    }
    
    if (queueRef.current.length === 0) return;
    if (isInitialDistributingRef.current) return;

    const currentColumns = columnsRef.current;

    // 각 sentinel을 체크해서 뷰포트에 있으면 아이템 추가
    let addedAny = false;

    for (let i = 0; i < currentColumns; i++) {
      const sentinel = sentinelRefs.current[i];
      if (!sentinel) continue;

      const rect = sentinel.getBoundingClientRect();
      // sentinel이 뷰포트 근처에 있을 때만 (300px 여유)
      const isInViewport = rect.top < window.innerHeight + 300 && rect.bottom > -300;

      if (isInViewport && queueRef.current.length > 0) {
        addItemToColumn(i);
        addedAny = true;
      }
    }

    // 아이템이 추가되었고 아직 대기열에 남아있으면, 일정 시간 후 다시 체크
    // (단, sentinel이 여전히 보이는 경우에만 계속)
    if (addedAny && queueRef.current.length > 0) {
      // 재귀 호출 대신 단순 setTimeout (50ms 딜레이로 부하 감소)
      setTimeout(fillVisibleSentinels, 50);
    }
    // queue가 남아있어도 sentinel이 안 보이면 대기 (스크롤할 때까지)
  }, [addItemToColumn]);

  // 초기 배분: 각 컬럼에 하나씩 순차적으로 (애니메이션 효과)
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

  // 배치 배분: 모든 아이템을 한 번에 컴럼에 배분 (리사이즈 후 사용)
  const distributeBatch = useCallback(() => {
    if (queueRef.current.length === 0) return;

    const currentColumns = columnsRef.current;
    const newColumnItems: T[][] = Array.from({ length: currentColumns }, () => []);
    
    // 라운드로빈으로 모든 아이템 배분
    let colIndex = 0;
    while (queueRef.current.length > 0) {
      const item = queueRef.current.shift()!;
      newColumnItems[colIndex].push(item);
      colIndex = (colIndex + 1) % currentColumns;
    }

    setColumnItems(newColumnItems);
    setQueueLength(0);
  }, []);

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

  // 컬럼 수 변경 시 리셋 (리사이즈 완료 후 처리)
  const pendingColumnChangeRef = useRef(false);
  
  useEffect(() => {
    if (prevColumnsRef.current !== columns) {
      // 리사이즈 중이면 완료 후 처리
      if (isResizing) {
        // 이미 예약되어 있으면 중복 등록 안 함
        if (!pendingColumnChangeRef.current) {
          pendingColumnChangeRef.current = true;
          onResizeEndCallbacks.push(() => {
            pendingColumnChangeRef.current = false;
            // 현재 컬럼과 prevRef가 다르면 처리
            if (prevColumnsRef.current !== columnsRef.current) {
              handleColumnChange(columnsRef.current);
            }
          });
        }
        return;
      }
      
      handleColumnChange(columns);
    }
    
    function handleColumnChange(targetColumns: number) {
      prevColumnsRef.current = targetColumns;

      // 초기 배분 중단
      isInitialDistributingRef.current = false;

      // 모든 아이템을 다시 대기열에 (items 기준으로)
      queueRef.current = [...items];
      distributedIdsRef.current.clear();
      items.forEach(item => distributedIdsRef.current.add(item.id));

      // sentinel refs 업데이트
      if (sentinelRefs.current.length < targetColumns) {
        sentinelRefs.current = [
          ...sentinelRefs.current,
          ...Array(targetColumns - sentinelRefs.current.length).fill(null)
        ];
      } else if (sentinelRefs.current.length > targetColumns) {
        sentinelRefs.current = sentinelRefs.current.slice(0, targetColumns);
      }

      // 배치 배분으로 한 번에 모든 아이템 배분 (리렌더링 최소화)
      // targetColumns를 명시적으로 전달
      const newColumnItems: T[][] = Array.from({ length: targetColumns }, () => []);
      let colIndex = 0;
      while (queueRef.current.length > 0) {
        const item = queueRef.current.shift()!;
        newColumnItems[colIndex].push(item);
        colIndex = (colIndex + 1) % targetColumns;
      }
      setColumnItems(newColumnItems);
      setQueueLength(0);
    }
  }, [columns, items]);

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
          // 리사이즈 중에는 처리 건너뛰기
          if (isResizing) return;
          
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
