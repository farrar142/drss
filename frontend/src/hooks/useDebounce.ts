import { useCallback, useEffect, useRef } from "react";

export const useDebounce = (func: () => void, { delay = 150, deps = [] }: {
  delay?: number;
  deps?: any[];
} = {}) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedFunction = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      func();
      timeoutRef.current = null;
    }, delay);
  }, [func, delay]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedFunction;
}
