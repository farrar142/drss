'use client';

import { FC, useState, useCallback, useMemo, useRef, useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { RSSItem } from "../types/rss";
import { useRSSStore } from "../stores/rssStore";
import dynamic from 'next/dynamic';
// Dynamically import FeedItemRenderer to reduce initial bundle size
const FeedItemRenderer = dynamic(
  () => import('./FeedItemRenderer').then((mod) => mod.FeedItemRenderer),
  {
    loading: () => <div className="h-24 animate-pulse bg-muted rounded" />,
    ssr: false,
  }
);

// Custom hook for media queries
const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }
    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [matches, query]);

  return matches;
};

// Masonry layout hook - distributes items into columns in sequential groups
// Items are processed in groups of `columns` size, maintaining reading order
const useMasonryLayout = (items: RSSItem[], columns: number) => {
  const [itemHeights, setItemHeights] = useState<Map<number, number>>(new Map());
  const heightsRef = useRef<Map<number, number>>(new Map());
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingUpdatesRef = useRef<Map<number, number>>(new Map());

  // Register height for an item - debounced and only updates if significantly different
  const registerHeight = useCallback((itemId: number, height: number) => {
    const currentHeight = heightsRef.current.get(itemId) || 0;

    // Only update if height changed by more than 20px (avoid micro-adjustments)
    if (Math.abs(currentHeight - height) > 20) {
      pendingUpdatesRef.current.set(itemId, height);

      // Debounce updates to batch them together
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }

      updateTimeoutRef.current = setTimeout(() => {
        if (pendingUpdatesRef.current.size > 0) {
          setItemHeights(prev => {
            const newMap = new Map(prev);
            pendingUpdatesRef.current.forEach((h, id) => {
              newMap.set(id, h);
              heightsRef.current.set(id, h);
            });
            pendingUpdatesRef.current.clear();
            return newMap;
          });
        }
      }, 300); // Wait 300ms before applying updates
    }
  }, []);

  // Calculate which column each item should go into
  // Process items in groups of `columns`, within each group place in shortest column
  const columnItems = useMemo(() => {
    const result: RSSItem[][] = Array.from({ length: columns }, () => []);
    const columnHeights = Array(columns).fill(0);

    // Process items in groups of `columns` size
    for (let i = 0; i < items.length; i += columns) {
      const group = items.slice(i, i + columns);

      // Sort group items by their heights (largest first) for better distribution
      const sortedGroup = [...group].sort((a, b) => {
        const heightA = itemHeights.get(a.id) || 300;
        const heightB = itemHeights.get(b.id) || 300;
        return heightB - heightA; // Largest first
      });

      // Assign each item in the group to the shortest column
      sortedGroup.forEach(item => {
        const shortestColumnIndex = columnHeights.indexOf(Math.min(...columnHeights));
        result[shortestColumnIndex].push(item);

        const itemHeight = itemHeights.get(item.id) || 300;
        columnHeights[shortestColumnIndex] += itemHeight;
      });
    }

    return result;
  }, [items, columns, itemHeights]);

  return { columnItems, registerHeight };
};

// Wrapper component to measure item height
const MeasuredItem: FC<{
  item: RSSItem;
  onMediaClick: (src: string, type: 'image' | 'video') => void;
  onHeightChange: (id: number, height: number) => void;
}> = ({ item, onMediaClick, onHeightChange }) => {
  const ref = useRef<HTMLDivElement>(null);
  const lastHeightRef = useRef<number>(0);

  useEffect(() => {
    if (!ref.current) return;

    const measureHeight = () => {
      if (ref.current) {
        const height = ref.current.offsetHeight;
        // Only report if height changed significantly
        if (Math.abs(lastHeightRef.current - height) > 10) {
          lastHeightRef.current = height;
          onHeightChange(item.id, height);
        }
      }
    };

    // Initial measurement after a short delay to let content render
    const initialTimeout = setTimeout(measureHeight, 100);

    // Re-measure when images load
    const images = ref.current.querySelectorAll('img');
    const imageLoadHandler = () => {
      setTimeout(measureHeight, 50);
    };

    images.forEach(img => {
      if (!img.complete) {
        img.addEventListener('load', imageLoadHandler);
        img.addEventListener('error', imageLoadHandler);
      }
    });

    // One final measurement after all images should be loaded
    const finalTimeout = setTimeout(measureHeight, 1000);

    return () => {
      clearTimeout(initialTimeout);
      clearTimeout(finalTimeout);
      images.forEach(img => {
        img.removeEventListener('load', imageLoadHandler);
        img.removeEventListener('error', imageLoadHandler);
      });
    };
  }, [item.id, onHeightChange]);

  return (
    <div ref={ref}>
      <FeedItemRenderer item={item} onMediaClick={onMediaClick} />
    </div>
  );
};

export const FeedItemViewer: FC<{
  items: RSSItem[],
  onLoadMore?: () => void,
  onLoadNew?: () => void,
  hasNext?: boolean,
  loading?: boolean
}> = ({ items, onLoadMore, onLoadNew, hasNext, loading }) => {
  const { viewMode } = useRSSStore();
  const isMd = useMediaQuery('(max-width: 768px)');
  const isXl = useMediaQuery('(min-width: 1280px)');

  let columns = 1;
  if (isXl) columns = 3;
  else if (!isMd) columns = 2;

  const { columnItems, registerHeight } = useMasonryLayout(items, columns);
  // Use fast, CSS-based masonry when possible to avoid heavy JS layout recalculations
  // CSS columns have the side effect of filling top-to-bottom, left-to-right (different
  // reading order), but it greatly improves scroll performance for long lists.
  const useCSSColumns = true;
  // For CSS columns mode, compute sentinel positions so each column gets a sentinel
  // near its end. This allows loading more when any column reaches the viewport.
  const columnSentinelIndexes = useMemo(() => {
    if (!useCSSColumns) return [] as number[];
    const n = items.length;
    if (n === 0) return [] as number[];
    const idxs: number[] = [];
    for (let c = 1; c <= columns; c++) {
      const pos = Math.max(0, Math.min(n - 1, Math.ceil((c * n) / columns) - 1));
      idxs.push(pos);
    }
    return idxs;
  }, [items.length, columns, useCSSColumns]);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMedia, setModalMedia] = useState<{ type: 'image' | 'video'; src: string } | null>(null);

  // Multiple sentinel refs for each column
  const sentinelRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Use ref to always have access to latest callback
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;

  // Callback ref setter for sentinel elements
  const setSentinelRef = useCallback((index: number) => (el: HTMLDivElement | null) => {
    sentinelRefs.current[index] = el;
  }, []);

  useEffect(() => {
    if (!hasNext || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // If any sentinel is intersecting, load more
        const isAnyIntersecting = entries.some(entry => entry.isIntersecting);
        if (isAnyIntersecting && onLoadMoreRef.current) {
          onLoadMoreRef.current();
          console.log("Loading more items...");
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    // Observe all sentinel elements
    sentinelRefs.current.forEach(ref => {
      if (ref) {
        observer.observe(ref);
      }
    });

    return () => observer.disconnect();
  }, [hasNext, loading, columns]);

  const handleMediaClick = useCallback((src: string, type: 'image' | 'video' = 'image') => {
    setModalMedia({ type, src });
    setModalOpen(true);
  }, []);

  const closeModal = () => {
    setModalOpen(false);
    setModalMedia(null);
  };

  return (
    <>
      <div className="w-full space-y-4">
        {/* Load New Button */}
        <Button
          onClick={onLoadNew}
          className="shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
        >
          새글 불러오기
        </Button>

        {/* Content Grid */}
        {viewMode === 'board' ? (
          // Board Mode - Single Column
          <div className="w-full space-y-3 px-1">
            {items.map((item) => (
              <FeedItemRenderer key={item.id} item={item} onMediaClick={handleMediaClick} />
            ))}
            {/* Sentinel element for board mode */}
            {hasNext && (
              <div ref={setSentinelRef(0)} className="h-px w-full" />
            )}
          </div>
        ) : (
          // Masonry Mode - Multiple Columns
          // If useCSSColumns is true we'll render a CSS-column based masonry which
          // avoids measuring, sorting and reflow caused by JS layout. This dramatically
          // reduces main-thread work while scrolling.
          useCSSColumns ? (
            <>
              <div
                className={cn(
                  "w-full",
                  columns === 1 && "columns-1",
                  columns === 2 && "md:columns-2",
                  columns === 3 && "xl:columns-3",
                  "gap-4"
                )}
              >
                {items.map((item, idx) => (
                  <div key={item.id} className="mb-4" style={{ breakInside: 'avoid' }}>
                    <FeedItemRenderer item={item} onMediaClick={handleMediaClick} />
                    {/* If this index matches one of the per-column sentinel indexes, render a sentinel
                        that will be placed near the bottom of a column by the browser's column layout. */}
                    {hasNext && columnSentinelIndexes.includes(idx) && (
                      <div
                        key={`sentinel-${idx}`}
                        ref={setSentinelRef(columnSentinelIndexes.indexOf(idx))}
                        className="h-px w-full"
                        style={{ display: 'block', breakInside: 'avoid' }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className={cn(
              "grid gap-4",
              columns === 1 && "grid-cols-1",
              columns === 2 && "grid-cols-2",
              columns === 3 && "grid-cols-3"
            )}>
              {columnItems.map((columnData, columnIndex) => (
                <div key={columnIndex} className="space-y-4">
                  {columnData.map((item) => (
                    <MeasuredItem
                      key={item.id}
                      item={item}
                      onMediaClick={handleMediaClick}
                      onHeightChange={registerHeight}
                    />
                  ))}
                  {/* Sentinel element at the end of each column */}
                  {hasNext && (
                    <div ref={setSentinelRef(columnIndex)} className="h-px w-full" />
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Media Modal */}
      {modalOpen && (
        <div
          className={cn(
            "fixed inset-0 z-50 flex items-center justify-center",
            "bg-black/80 backdrop-blur-sm"
          )}
          onClick={closeModal}
        >
          {/* Close Button */}
          <button
            onClick={closeModal}
            className={cn(
              "absolute top-4 right-4 p-2 rounded-full",
              "bg-white/10 hover:bg-white/20 transition-colors"
            )}
          >
            <X className="w-6 h-6 text-white" />
          </button>

          {/* Media Content */}
          <div
            className={cn(
              "w-[90vw] h-[90vh] flex items-center justify-center",
              "bg-card/90 rounded-2xl border border-border p-4",
              "shadow-2xl"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {modalMedia?.type === 'video' ? (
              <video
                src={modalMedia.src}
                controls
                autoPlay
                className="max-w-full max-h-full object-contain rounded-lg"
                onClick={(e) => e.stopPropagation()}
              />
            ) : modalMedia?.type === 'image' ? (
              <img
                src={modalMedia.src}
                alt="Enlarged"
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
