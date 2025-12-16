'use client';

import { useState, useCallback, useRef, useEffect, RefObject } from 'react';
import { useSettingsStore } from '../stores/settingsStore';

export interface UseCruisingOptions {
  /** Minimum speed in pixels per second */
  minSpeed?: number;
  /** Maximum speed in pixels per second */
  maxSpeed?: number;
  /** 스크롤 컨테이너 ref (개별 패널 스크롤용, 없으면 window 사용) */
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
}

export interface UseCruisingReturn {
  /** Whether cruising is currently active */
  isCruising: boolean;
  /** Current speed in pixels per second */
  speed: number;
  /** Start cruising */
  startCruising: () => void;
  /** Stop cruising */
  stopCruising: () => void;
  /** Toggle cruising on/off */
  toggleCruising: () => void;
  /** Set speed (0-100 normalized, will be mapped to min-max range) */
  setSpeedPercent: (percent: number) => void;
  /** Get current speed as percentage (0-100) */
  speedPercent: number;
  /** Min speed */
  minSpeed: number;
  /** Max speed */
  maxSpeed: number;
}

export function useCruising(options: UseCruisingOptions = {}): UseCruisingReturn {
  const {
    minSpeed = 10,      // 0%에서의 속도
    maxSpeed = 300,    // 100%에서의 속도
    scrollContainerRef,
  } = options;

  // 설정 스토어에서 속도 가져오기
  const { cruiseSpeedPercent, setCruiseSpeedPercent } = useSettingsStore();

  const [isCruising, setIsCruising] = useState(false);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const accumulatedScrollRef = useRef<number>(0); // 누적 스크롤 값

  // 지수 함수를 사용한 속도 계산
  // percent 0 → minSpeed, percent 100 → maxSpeed
  // 낮은 구간에서 세밀하게, 높은 구간에서 빠르게 증가
  const percentToSpeed = useCallback((percent: number): number => {
    const t = percent / 100; // 0 ~ 1
    // 지수 함수: speed = minSpeed + (maxSpeed - minSpeed) * t^2.5
    // t^2.5는 낮은 구간에서 천천히, 높은 구간에서 빠르게 증가
    return minSpeed + (maxSpeed - minSpeed) * Math.pow(t, 2.5);
  }, [minSpeed, maxSpeed]);

  // Calculate speed from current percentage
  const speed = percentToSpeed(cruiseSpeedPercent);

  const setSpeedPercent = useCallback((percent: number) => {
    const clampedPercent = Math.max(0, Math.min(100, percent));
    setCruiseSpeedPercent(clampedPercent);
  }, [setCruiseSpeedPercent]);

  const stopCruising = useCallback(() => {
    setIsCruising(false);
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const startCruising = useCallback(() => {
    setIsCruising(true);
    lastTimeRef.current = performance.now();
  }, []);

  const toggleCruising = useCallback(() => {
    if (isCruising) {
      stopCruising();
    } else {
      startCruising();
    }
  }, [isCruising, startCruising, stopCruising]);

  // Smooth scrolling animation loop
  useEffect(() => {
    if (!isCruising) return;

    // Reset accumulated scroll when starting
    accumulatedScrollRef.current = 0;

    const animate = (currentTime: number) => {
      const deltaTime = currentTime - lastTimeRef.current;
      lastTimeRef.current = currentTime;

      // Calculate scroll amount based on speed (pixels per second)
      // Accumulate fractional pixels to ensure smooth scrolling at low speeds
      accumulatedScrollRef.current += (speed * deltaTime) / 1000;

      // Only scroll when we have at least 1 pixel accumulated
      if (accumulatedScrollRef.current >= 1) {
        const scrollAmount = Math.floor(accumulatedScrollRef.current);
        accumulatedScrollRef.current -= scrollAmount;

        const container = scrollContainerRef?.current;
        if (container) {
          // 개별 스크롤 컨테이너 사용
          container.scrollTop += scrollAmount;
        } else {
          // 폴백: window 스크롤
          window.scrollBy({
            top: scrollAmount,
            behavior: 'instant',
          });
        }
      }

      // Check if we've reached the bottom
      const container = scrollContainerRef?.current;
      let scrollY: number;
      let vh: number;
      let docHeight: number;

      if (container) {
        scrollY = container.scrollTop;
        vh = container.clientHeight;
        docHeight = container.scrollHeight;
      } else {
        scrollY = window.scrollY || window.pageYOffset;
        vh = window.innerHeight;
        docHeight = document.documentElement.scrollHeight;
      }

      if (scrollY + vh >= docHeight - 10) {
        // Reached bottom, stop cruising
        stopCruising();
        return;
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    lastTimeRef.current = performance.now();
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isCruising, speed, stopCruising, scrollContainerRef]);

  // Stop cruising on user interaction (click, scroll, keypress)
  useEffect(() => {
    if (!isCruising) return;

    const container = scrollContainerRef?.current;

    const handleUserInteraction = (e: Event) => {
      // Don't stop if clicking on cruising controls
      const target = e.target as HTMLElement;
      if (target.closest('[data-cruising-control]')) {
        return;
      }
      stopCruising();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow Escape to stop cruising
      stopCruising();
    };

    const handleWheel = () => {
      stopCruising();
    };

    const handleTouchStart = () => {
      stopCruising();
    };

    // 이벤트 리스너 대상 (컨테이너 또는 window)
    const target = container || window;

    // Use capture phase to catch events before they bubble
    target.addEventListener('click', handleUserInteraction, { capture: true });
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    target.addEventListener('wheel', handleWheel, { passive: true });
    target.addEventListener('touchstart', handleTouchStart, { passive: true });

    return () => {
      target.removeEventListener('click', handleUserInteraction, { capture: true });
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      target.removeEventListener('wheel', handleWheel);
      target.removeEventListener('touchstart', handleTouchStart);
    };
  }, [isCruising, stopCruising, scrollContainerRef]);

  return {
    isCruising,
    speed,
    startCruising,
    stopCruising,
    toggleCruising,
    setSpeedPercent,
    speedPercent: cruiseSpeedPercent,
    minSpeed,
    maxSpeed,
  };
}
