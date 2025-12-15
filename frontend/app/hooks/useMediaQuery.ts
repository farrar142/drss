import { useState, useEffect, useRef } from "react";

// Custom hook for media queries with debounce to reduce layout thrashing
export const useMediaQuery = (query: string, debounceMs: number = 150): boolean => {
  const [matches, setMatches] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const media = window.matchMedia(query);

    // Set initial value immediately
    if (media.matches !== matches) {
      setMatches(media.matches);
    }

    // Debounced change handler
    const listener = (e: MediaQueryListEvent) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setMatches(e.matches);
        timeoutRef.current = null;
      }, debounceMs);
    };

    media.addEventListener('change', listener);
    return () => {
      media.removeEventListener('change', listener);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [query, debounceMs]); // Remove matches from deps to avoid loop

  return matches;
};
