'use client';

import { FC, useEffect, useState, useRef, useCallback, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface PullToRefreshProps {
  /** 새로고침 핸들러 */
  onRefresh: () => void | Promise<void>;
  /** 자식 요소 */
  children: ReactNode;
  /** 당기기 임계값 (px) */
  threshold?: number;
}

export const PullToRefresh: FC<PullToRefreshProps> = ({
  onRefresh,
  children,
  threshold = 80,
}) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const pullDistanceRef = useRef(0); // 동기적 거리 추적
  const isRefreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  // 새로고침 실행
  const executeRefresh = useCallback(async () => {
    if (isRefreshingRef.current) return;

    isRefreshingRef.current = true;
    setIsRefreshing(true);
    setPullDistance(60); // 스피너 표시용 고정 위치

    try {
      await Promise.resolve(onRefreshRef.current());
    } finally {
      isRefreshingRef.current = false;
      setIsRefreshing(false);
      setPullDistance(0);
      pullDistanceRef.current = 0;
    }
  }, []);

  useEffect(() => {
    // 휠 이벤트 (데스크탑/터치패드)
    let wheelAccumulator = 0;
    let wheelTimeout: NodeJS.Timeout | null = null;

    const handleWheel = (e: WheelEvent) => {
      if (isRefreshingRef.current) return;
      if (window.scrollY > 0) return;
      if (e.deltaY >= 0) return; // 위로 스크롤만

      e.preventDefault();

      // 휠 값 누적
      wheelAccumulator += Math.abs(e.deltaY) * 0.5;
      const distance = Math.min(wheelAccumulator, threshold * 1.5);

      pullDistanceRef.current = distance;
      setPullDistance(distance);

      // 휠 멈추면 = 손 뗀 것
      if (wheelTimeout) clearTimeout(wheelTimeout);
      wheelTimeout = setTimeout(() => {
        const finalDistance = pullDistanceRef.current;
        wheelAccumulator = 0;

        if (finalDistance >= threshold) {
          executeRefresh();
        } else {
          pullDistanceRef.current = 0;
          setPullDistance(0);
        }
      }, 100);
    };

    // 터치 이벤트 (모바일)
    let touchStartY = 0;
    let isTouchPulling = false;

    const handleTouchStart = (e: TouchEvent) => {
      if (isRefreshingRef.current) return;

      touchStartY = e.touches[0].clientY;
      // 최상단 근처에서 시작하면 pulling 가능
      isTouchPulling = window.scrollY < 5;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isRefreshingRef.current) return;
      if (!isTouchPulling) return;

      const currentY = e.touches[0].clientY;
      const diff = currentY - touchStartY;

      // 아래로 당기는 경우만
      if (diff > 0) {
        e.preventDefault();
        const distance = Math.min(diff * 0.5, threshold * 1.5);
        pullDistanceRef.current = distance;
        setPullDistance(distance);
      }
    };

    const handleTouchEnd = () => {
      if (isRefreshingRef.current) {
        touchStartY = 0;
        isTouchPulling = false;
        return;
      }
      
      if (!isTouchPulling) {
        touchStartY = 0;
        return;
      }

      const finalDistance = pullDistanceRef.current;

      // 임계값 도달했으면 새로고침
      if (finalDistance >= threshold) {
        executeRefresh();
      } else {
        // 임계값 미달이면 리셋
        pullDistanceRef.current = 0;
        setPullDistance(0);
      }

      // 상태 리셋
      touchStartY = 0;
      isTouchPulling = false;
    };

    const handleTouchCancel = () => {
      // 터치 취소 시 리셋
      if (!isRefreshingRef.current) {
        pullDistanceRef.current = 0;
        setPullDistance(0);
      }
      touchStartY = 0;
      isTouchPulling = false;
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchCancel);
      window.removeEventListener('touchend', handleTouchEnd);
      if (wheelTimeout) clearTimeout(wheelTimeout);
    };
  }, [threshold, executeRefresh]);

  // 스피너 표시
  const showIndicator = pullDistance > 10 || isRefreshing;
  const progress = Math.min(pullDistance / threshold, 1);
  const canTrigger = pullDistance >= threshold;
  const indicatorSize = 32 + progress * 8; // 32px ~ 40px

  return (
    <div className="relative">
      {/* 인디케이터 - 트위터처럼 fixed 위치 */}
      <div
        className={cn(
          "fixed left-1/2 -translate-x-1/2 z-50",
          "transition-opacity duration-150",
          showIndicator ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        style={{
          top: 'var(--pull-spinner-top, 88px)',
        }}
      >
        <div
          className="rounded-full bg-background shadow-lg border flex items-center justify-center"
          style={{
            width: indicatorSize + 16,
            height: indicatorSize + 16,
          }}
        >
          {(isRefreshing || canTrigger) ? (
            // 로딩 스피너 (100% 찼거나 새로고침 중)
            <div
              className="border-2 border-primary border-t-transparent rounded-full animate-spin"
              style={{ width: indicatorSize, height: indicatorSize }}
            />
          ) : (
            // 프로그레스 원
            <svg
              className="-rotate-90"
              style={{ width: indicatorSize, height: indicatorSize }}
              viewBox="0 0 40 40"
            >
              <circle
                cx="20"
                cy="20"
                r="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className="text-muted opacity-30"
              />
              <circle
                cx="20"
                cy="20"
                r="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 16}
                strokeDashoffset={2 * Math.PI * 16 * (1 - progress)}
                className="text-muted-foreground"
              />
            </svg>
          )}
        </div>
      </div>

      {/* 콘텐츠 - 움직이지 않음 (트위터 스타일) */}
      {children}
    </div>
  );
};
