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
  const [isTriggered, setIsTriggered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const wheelAccumulatorRef = useRef(0);
  const wheelTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onRefreshRef = useRef(onRefresh);
  const hasCalledRefreshRef = useRef(false); // API 호출 여부 추적
  
  // onRefresh를 ref로 저장해서 useEffect dependency에서 제외
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  // 리셋 함수
  const resetState = useCallback(() => {
    setPullDistance(0);
    setIsTriggered(false);
    wheelAccumulatorRef.current = 0;
    hasCalledRefreshRef.current = false;
  }, []);

  // 스크롤/휠 이벤트로 overscroll 감지
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      // 페이지 최상단에서 위로 스크롤할 때만 처리
      if (window.scrollY <= 0 && e.deltaY < 0) {
        e.preventDefault();
        
        // 휠 값 누적 (위로 스크롤 = 음수, 양수로 변환)
        wheelAccumulatorRef.current += Math.abs(e.deltaY) * 0.3;
        
        const distance = Math.min(wheelAccumulatorRef.current, threshold * 1.5);
        setPullDistance(distance);
        
        if (distance >= threshold && !hasCalledRefreshRef.current) {
          setIsTriggered(true);
          hasCalledRefreshRef.current = true;
          // 임계값 도달하면 바로 API 호출 (결과는 나중에 적용)
          onRefreshRef.current();
        }
        
        // 휠 멈추면 리셋 (사용자가 손을 뗀 것으로 간주)
        if (wheelTimeoutRef.current) {
          clearTimeout(wheelTimeoutRef.current);
        }
        wheelTimeoutRef.current = setTimeout(() => {
          resetState();
        }, 150);
      }
    };

    // 터치 이벤트 (모바일)
    let touchStartY = 0;
    let isTouching = false;
    
    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY <= 0) {
        touchStartY = e.touches[0].clientY;
        isTouching = true;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isTouching || window.scrollY > 0) {
        return;
      }

      const diff = e.touches[0].clientY - touchStartY;
      if (diff > 0 && touchStartY > 0) {
        e.preventDefault();
        const resistance = 0.4;
        const distance = Math.min(diff * resistance, threshold * 1.5);
        setPullDistance(distance);
        
        if (distance >= threshold && !hasCalledRefreshRef.current) {
          setIsTriggered(true);
          hasCalledRefreshRef.current = true;
          // 임계값 도달하면 바로 API 호출
          onRefreshRef.current();
        }
      }
    };

    const handleTouchEnd = () => {
      // 사용자가 손을 뗐을 때 리셋
      isTouching = false;
      touchStartY = 0;
      resetState();
    };

    // 이벤트 등록
    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      if (wheelTimeoutRef.current) {
        clearTimeout(wheelTimeoutRef.current);
      }
    };
  }, [threshold, resetState]); // onRefresh 제거!

  // 스피너 표시 조건: 당기는 중이고 pullDistance > 10
  const showSpinner = pullDistance > 10;

  // 스피너 크기 (당긴 거리에 비례)
  const spinnerScale = Math.min(pullDistance / threshold, 1);
  const spinnerSize = 24 + spinnerScale * 16; // 24px ~ 40px

  return (
    <div ref={containerRef} className="relative">
      {/* 스피너만 표시 */}
      <div
        className={cn(
          "fixed left-1/2 -translate-x-1/2 z-50",
          "flex items-center justify-center",
          "transition-all duration-150",
          showSpinner ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        style={{
          top: 80 + pullDistance * 0.5,
        }}
      >
        <div
          className="rounded-full bg-background shadow-lg border p-2"
          style={{
            width: spinnerSize + 16,
            height: spinnerSize + 16,
          }}
        >
          {isTriggered ? (
            // 스피너 (임계값 도달 후)
            <div
              className="border-3 border-primary border-t-transparent rounded-full animate-spin"
              style={{
                width: spinnerSize,
                height: spinnerSize,
                borderWidth: Math.max(2, spinnerScale * 3),
              }}
            />
          ) : (
            // 프로그레스 서클 (임계값 도달 전)
            <svg
              className="-rotate-90"
              style={{ width: spinnerSize, height: spinnerSize }}
              viewBox="0 0 40 40"
            >
              <circle
                cx="20"
                cy="20"
                r="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                className="text-muted opacity-30"
              />
              <circle
                cx="20"
                cy="20"
                r="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 16}
                strokeDashoffset={2 * Math.PI * 16 * (1 - spinnerScale)}
                className="text-primary transition-all duration-100"
              />
            </svg>
          )}
        </div>
      </div>

      {/* 콘텐츠 영역 */}
      <div
        style={{
          transform: `translateY(${pullDistance}px)`,
          transition: pullDistance > 0 ? 'none' : 'transform 0.3s ease-out',
        }}
      >
        {children}
      </div>
    </div>
  );
};
