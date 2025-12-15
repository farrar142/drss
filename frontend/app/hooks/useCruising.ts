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
    minSpeed = 5,
    maxSpeed = 300,
    defaultSpeed = 80,
  } = options;

  const [isCruising, setIsCruising] = useState(false);
  const [speed, setSpeed] = useState(defaultSpeed);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  // Calculate percentage
  const speedPercent = ((speed - minSpeed) / (maxSpeed - minSpeed)) * 100;

  const setSpeedPercent = useCallback((percent: number) => {
    const clampedPercent = Math.max(0, Math.min(100, percent));
    const newSpeed = minSpeed + (clampedPercent / 100) * (maxSpeed - minSpeed);
    setSpeed(newSpeed);
  }, [minSpeed, maxSpeed]);

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

    const animate = (currentTime: number) => {
      const deltaTime = currentTime - lastTimeRef.current;
      lastTimeRef.current = currentTime;

      // Calculate scroll amount based on speed (pixels per second)
      const scrollAmount = (speed * deltaTime) / 1000;

      // Smooth scroll
      window.scrollBy({
        top: scrollAmount,
        behavior: 'instant', // We handle smoothness ourselves via RAF
      });

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
