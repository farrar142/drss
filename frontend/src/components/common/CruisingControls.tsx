'use client';

import { FC, useState, useRef, useCallback, RefObject, useEffect, memo } from 'react';
import { ChevronDown, Pause, Ship, ChevronsUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Slider } from '@/ui/slider';
import { useTranslation } from '@/stores/languageStore';

export interface CruisingControlsProps {
  isCruising: boolean;
  speedPercent: number;
  onToggle: () => void;
  onSpeedChange: (percent: number) => void;
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
}

export const CruisingControls: FC<CruisingControlsProps> = memo(({
  isCruising,
  speedPercent,
  onToggle,
  onSpeedChange,
  scrollContainerRef,
}) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 스크롤 컨테이너의 위치를 기준으로 버튼 위치 계산 (ref + DOM 직접 조작)
  useEffect(() => {
    const updatePosition = () => {
      if (!containerRef.current) return;

      if (scrollContainerRef?.current) {
        const rect = scrollContainerRef.current.getBoundingClientRect();
        containerRef.current.style.right = `${window.innerWidth - rect.right + 16}px`;
        containerRef.current.style.bottom = `${window.innerHeight - rect.bottom + 16}px`;
      } else {
        containerRef.current.style.right = '16px';
        containerRef.current.style.bottom = '16px';
      }
    };

    // 디바운싱 - 리사이징이 끝난 후 100ms 뒤에 한 번만 실행
    const debouncedUpdate = () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        updatePosition();
        debounceTimerRef.current = null;
      }, 100);
    };

    updatePosition();
    window.addEventListener('resize', debouncedUpdate);

    // ResizeObserver로 컨테이너 크기 변화 감지 (디바운싱 적용)
    const observer = new ResizeObserver(debouncedUpdate);
    if (scrollContainerRef?.current) {
      observer.observe(scrollContainerRef.current);
    }

    return () => {
      window.removeEventListener('resize', debouncedUpdate);
      observer.disconnect();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [scrollContainerRef]);

  // 크루즈 시작하면 슬라이더 닫기
  const doToggle = useCallback(() => {
    if (!isCruising) {
      setIsExpanded(false);
    }
    onToggle();
  }, [isCruising, onToggle]);

  // 터치/클릭 통합 핸들러 - pointerdown 사용으로 단일 이벤트만 처리
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // pointerdown에서 처리하고 다른 이벤트는 모두 무시
    e.preventDefault();
    e.stopPropagation();

    // pointerType으로 터치/마우스 구분 가능하지만, 둘 다 같은 동작
    doToggle();
  }, [doToggle]);

  // 위치가 계산되기 전에는 렌더링하지 않음

  return (
    <div
      ref={containerRef}
      className="fixed w-fit z-40 flex flex-col items-end gap-2 pointer-events-none"
      style={{ right: 16, bottom: 16 }}
      data-cruising-control
    >
      {/* Scroll-to-top button - top row, right aligned */}
      <button
        onClick={() => {
          if (scrollContainerRef?.current) {
            scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
          } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }}
        className={cn(
          "p-3 rounded-full shadow-lg transition-all pointer-events-auto",
          "bg-primary hover:bg-primary/80 text-primary-foreground",
          "hover:scale-105 active:scale-95"
        )}
        data-cruising-control
        title={t.ui.scrollToTop}
        aria-label={t.ui.scrollToTop}
      >
        <ChevronsUp className="w-5 h-5" />
      </button>

      {/* Bottom row: Settings + Play/Pause */}
      <div className="relative flex items-center gap-2 pointer-events-auto" data-cruising-control>
        {/* Speed Slider - positioned above the bottom row */}
        {isExpanded && (
          <div
            className={cn(
              "absolute bottom-full right-0 mb-2",
              "bg-card/95 backdrop-blur-sm rounded-xl border border-border shadow-lg p-4",
              "animate-in slide-in-from-bottom-2 fade-in duration-200"
            )}
            data-cruising-control
          >
            <div className="flex items-center gap-3 min-w-[200px]">
              <span className="text-xs text-muted-foreground whitespace-nowrap">{t.settings.cruiseSpeedSlow}</span>
              <Slider
                value={[speedPercent]}
                onValueChange={([value]: number[]) => onSpeedChange(value)}
                min={0}
                max={100}
                step={1}
                className="flex-1"
                data-cruising-control
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">{t.settings.cruiseSpeedFast}</span>
            </div>
            <div className="text-center text-xs text-muted-foreground mt-2">
              {t.settings.cruiseSpeed}: {Math.round(speedPercent)}%
            </div>
          </div>
        )}

        {/* Settings toggle */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "p-3 rounded-full shadow-lg transition-all",
            "bg-secondary hover:bg-secondary/80",
            "hover:scale-105 active:scale-95",
            isExpanded && "bg-secondary/80"
          )}
          data-cruising-control
          title={t.ui.cruiseSettings}
          aria-label={t.ui.cruiseSettings}
        >
          <Ship className="w-5 h-5" />
        </button>

        {/* Play/Pause button */}
        <button
          onPointerDown={handlePointerDown}
          className={cn(
            "p-3 rounded-full shadow-lg transition-all select-none",
            "hover:scale-105 active:scale-95",
            isCruising
              ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              : "bg-primary hover:bg-primary/90 text-primary-foreground"
          )}
          style={{ touchAction: 'manipulation' }}
          data-cruising-control
          title={isCruising ? t.ui.stopCruise : t.ui.startCruise}
          aria-label={isCruising ? t.ui.stopCruise : t.ui.startCruise}
        >
          {isCruising ? (
            <Pause className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
        </button>

        {/* Cruising indicator */}
        {isCruising && (
          <div
            className={cn(
              "absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-green-500",
              "animate-pulse"
            )}
            data-cruising-control
          />
        )}
      </div>
    </div>
  );
});

CruisingControls.displayName = 'CruisingControls';
