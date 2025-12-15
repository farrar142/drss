'use client';

import { FC, useState, useCallback, useMemo, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { RSSItem } from "../types/rss";
import { useRSSStore } from "../stores/rssStore";
import dynamic from 'next/dynamic';
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useMasonryLayout } from "../hooks/useMasonryLayout";
import { useMediaModal } from "../hooks/useMediaModal";
import { useCruising } from "../hooks/useCruising";
import { MeasuredItem } from "./MeasuredItem";
import { MediaModal } from "./MediaModal";
import { CruisingControls } from "./CruisingControls";

// Dynamically import FeedItemRenderer to reduce initial bundle size
const FeedItemRenderer = dynamic(
  () => import('./FeedItemRenderer').then((mod) => mod.FeedItemRenderer),
  {
    loading: () => <div className="h-24 animate-pulse bg-muted rounded" />,
    ssr: false,
  }
);


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

  const { columnItems, registerHeight, getItemHeight } = useMasonryLayout(items, columns);
  
  // Use extracted hooks
  const mediaModal = useMediaModal({ items });
  const cruising = useCruising({ minSpeed: 20, maxSpeed: 300, defaultSpeed: 80 });
  
  // Use fast, CSS-based masonry when possible
  const useCSSColumns = true;
  
  // For CSS columns mode, compute sentinel positions
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

  // Multiple sentinel refs for each column
  const sentinelRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Use ref to always have access to latest callback
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;
  const onLoadNewRef = useRef(onLoadNew);
  onLoadNewRef.current = onLoadNew;

  // Callback ref setter for sentinel elements
  const setSentinelRef = useCallback((index: number) => (el: HTMLDivElement | null) => {
    sentinelRefs.current[index] = el;
  }, []);

  // Intersection observer for infinite scroll
  useEffect(() => {
    if (!hasNext || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const isAnyIntersecting = entries.some(entry => entry.isIntersecting);
        if (isAnyIntersecting && onLoadMoreRef.current) {
          onLoadMoreRef.current();
          console.log("Loading more items...");
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    sentinelRefs.current.forEach(ref => {
      if (ref) observer.observe(ref);
    });

    // Fallback scroll handler
    let rafId: number | null = null;
    const checkNearBottom = () => {
      if (!hasNext || loading) return;
      const scrollY = window.scrollY || window.pageYOffset;
      const vh = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;
      const threshold = 300;
      if (scrollY + vh + threshold >= docHeight) {
        if (onLoadMoreRef.current) {
          onLoadMoreRef.current();
          console.log('Loading more items (near-bottom fallback)...');
        }
      }
    };

    const onScroll = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        checkNearBottom();
        rafId = null;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    checkNearBottom();

    return () => observer.disconnect();
  }, [hasNext, loading, columns]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    if (!onLoadNew) return;

    let inFlight = false;

    const doTick = async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      if (inFlight) return;
      const cb = onLoadNewRef.current;
      if (!cb) return;
      try {
        inFlight = true;
        const res = cb();
        const p = res as any;
        if (p && typeof p.then === 'function') await p;
      } catch (e) {
        // ignore
      } finally {
        inFlight = false;
      }
    };

    const intervalId = window.setInterval(doTick, 60 * 1000);

    const visibilityHandler = () => {
      if (!document.hidden) doTick();
    };
    document.addEventListener('visibilitychange', visibilityHandler);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', visibilityHandler);
    };
  }, [onLoadNew]);

  // Track expanded items
  const [expandedSet, setExpandedSet] = useState<Set<number>>(new Set());
  const handleCollapseChange = useCallback((id: number, collapsed: boolean) => {
    setExpandedSet(prev => {
      const next = new Set(prev);
      if (!collapsed) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  // Handle media click
  const handleMediaClick = useCallback((src: string, type: 'image' | 'video' = 'image', itemId?: number) => {
    mediaModal.openMedia(src, type, itemId);
  }, [mediaModal]);

  // ColumnVirtual component for virtualized columns
  function ColumnVirtual({ columnData, columnIndex }: { columnData: RSSItem[]; columnIndex: number }) {
    const offsets = useMemo(() => {
      const arr: number[] = [];
      let acc = 0;
      for (let i = 0; i < columnData.length; i++) {
        arr.push(acc);
        acc += getItemHeight(columnData[i].id);
      }
      return { offsets: arr, total: acc };
    }, [columnData, getItemHeight]);

    const [range, setRange] = useState({ start: 0, end: Math.min(columnData.length - 1, 10) });

    useEffect(() => {
      const onScroll = () => {
        const scrollY = window.scrollY || window.pageYOffset;
        const vh = window.innerHeight;
        const margin = 500;

        let start = 0;
        while (start < columnData.length && (offsets.offsets[start] + getItemHeight(columnData[start].id)) < (scrollY - margin)) start++;
        let end = start;
        while (end < columnData.length && offsets.offsets[end] < (scrollY + vh + margin)) end++;
        start = Math.max(0, start - 3);
        end = Math.min(columnData.length - 1, end + 3);
        setRange({ start, end });
      };

      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll);
      return () => {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onScroll);
      };
    }, [columnData, offsets, getItemHeight]);

    return (
      <div className="relative">
        <div style={{ height: offsets.total, position: 'relative' }}>
          {columnData.slice(range.start, range.end + 1).map((item, idx) => {
            const i = range.start + idx;
            const top = offsets.offsets[i];
            return (
              <div key={item.id} style={{ position: 'absolute', left: 0, right: 0, top }}>
                <MeasuredItem
                  item={item}
                  onMediaClick={handleMediaClick}
                  onHeightChange={(id, h) => registerHeight(id, h)}
                  isForcedVisible={expandedSet.has(item.id)}
                  estimateHeight={getItemHeight(item.id)}
                  onCollapseChange={handleCollapseChange}
                  Renderer={FeedItemRenderer}
                />
              </div>
            );
          })}

          {hasNext && (
            <div ref={setSentinelRef(columnIndex)} className="h-px w-full" style={{ position: 'absolute', bottom: 0 }} />
          )}
        </div>
      </div>
    );
  }

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
          <div className="w-full space-y-3 px-1">
            {items.map((item) => (
              <FeedItemRenderer key={item.id} item={item} onMediaClick={handleMediaClick} />
            ))}
            {hasNext && (
              <div ref={setSentinelRef(0)} className="h-px w-full" />
            )}
          </div>
        ) : (
          useCSSColumns ? (
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
                  <MeasuredItem
                    item={item}
                    onMediaClick={handleMediaClick}
                    onHeightChange={registerHeight}
                    isForcedVisible={expandedSet.has(item.id)}
                    estimateHeight={getItemHeight(item.id)}
                    onCollapseChange={handleCollapseChange}
                    Renderer={FeedItemRenderer}
                  />
                  {hasNext && columnSentinelIndexes.includes(idx) && (
                    <div
                      key={`sentinel-${idx}`}
                      data-sentinel-index={columnSentinelIndexes.indexOf(idx)}
                      ref={setSentinelRef(columnSentinelIndexes.indexOf(idx))}
                      className="h-px w-full"
                      style={{ display: 'block', breakInside: 'avoid' }}
                    />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className={cn(
              "grid gap-4",
              columns === 1 && "grid-cols-1",
              columns === 2 && "grid-cols-2",
              columns === 3 && "grid-cols-3"
            )}>
              {columnItems.map((columnData, columnIndex) => (
                <ColumnVirtual
                  key={columnIndex}
                  columnIndex={columnIndex}
                  columnData={columnData}
                />
              ))}
            </div>
          )
        )}
      </div>

      {/* Media Modal */}
      <MediaModal modal={mediaModal} />

      {/* Cruising Controls */}
      <CruisingControls
        isCruising={cruising.isCruising}
        speedPercent={cruising.speedPercent}
        onToggle={cruising.toggleCruising}
        onSpeedChange={cruising.setSpeedPercent}
      />
    </>
  );
}
