import { useState, useEffect, useRef, useSyncExternalStore } from "react";

// Custom hook for media queries - SSR-safe with useSyncExternalStore
export const useMediaQuery = (query: string): boolean => {
  const getSnapshot = () => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  };

  const getServerSnapshot = () => false;

  const subscribe = (callback: () => void) => {
    if (typeof window === 'undefined') return () => { };
    const media = window.matchMedia(query);
    media.addEventListener('change', callback);
    return () => media.removeEventListener('change', callback);
  };

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
};
