'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

export interface UseCruisingOptions {
  /** Minimum speed in pixels per second */
  minSpeed?: number;
  /** Maximum speed in pixels per second */
  maxSpeed?: number;
  /** Default speed in pixels per second */
  defaultSpeed?: number;
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
    defaultSpeed = 30, // 기본값
  } = options;

  const [isCruising, setIsCruising] = useState(false);
  const [speed, setSpeed] = useState(defaultSpeed);
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

  const speedToPercent = useCallback((spd: number): number => {
    // 역함수: t = ((speed - minSpeed) / (maxSpeed - minSpeed))^(1/2.5)
    const normalized = (spd - minSpeed) / (maxSpeed - minSpeed);
    const t = Math.pow(Math.max(0, Math.min(1, normalized)), 1 / 2.5);
    return t * 100;
  }, [minSpeed, maxSpeed]);

  // Calculate percentage from current speed
  const speedPercent = speedToPercent(speed);

  const setSpeedPercent = useCallback((percent: number) => {
    const clampedPercent = Math.max(0, Math.min(100, percent));
    const newSpeed = percentToSpeed(clampedPercent);
    setSpeed(newSpeed);
  }, [percentToSpeed]);

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
        
        window.scrollBy({
          top: scrollAmount,
          behavior: 'instant',
        });
      }

      // Check if we've reached the bottom
      const scrollY = window.scrollY || window.pageYOffset;
      const vh = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;

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
  }, [isCruising, speed, stopCruising]);

  // Stop cruising on user interaction (click, scroll, keypress)
  useEffect(() => {
    if (!isCruising) return;

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

    // Use capture phase to catch events before they bubble
    window.addEventListener('click', handleUserInteraction, { capture: true });
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('wheel', handleWheel, { passive: true });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });

    return () => {
      window.removeEventListener('click', handleUserInteraction, { capture: true });
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('touchstart', handleTouchStart);
    };
  }, [isCruising, stopCruising]);

  return {
    isCruising,
    speed,
    startCruising,
    stopCruising,
    toggleCruising,
    setSpeedPercent,
    speedPercent,
    minSpeed,
    maxSpeed,
  };
}
