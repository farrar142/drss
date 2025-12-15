'use client';

import { FC, useState, useCallback, useMemo, useRef, useEffect } from "react";
import { X, SkipBack, SkipForward, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { RSSItem } from "../types/rss";
import { useRSSStore } from "../stores/rssStore";
import dynamic from 'next/dynamic';
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useMasonryLayout } from "../hooks/useMasonryLayout";
import { MeasuredItem } from "./MeasuredItem";
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
  const [modalMedia, setModalMedia] = useState<{ type: 'image' | 'video'; src: string; itemId?: number } | null>(null);
  const mediaListRef = useRef<Array<{ src: string; type: 'image' | 'video'; itemId: number }>>([]);
  const [currentMediaIndex, setCurrentMediaIndex] = useState<number | null>(null);

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

    // Fallback: also trigger load when user scrolls near the bottom of the page.
    // This handles uneven CSS-column distributions where per-column sentinels
    // may not be placed in a way that becomes visible.
    let rafId: number | null = null;
    const checkNearBottom = () => {
      if (!hasNext || loading) return;
      const scrollY = window.scrollY || window.pageYOffset;
      const vh = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;
      const threshold = 300; // px from bottom to trigger
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
    // initial check in case page is already near bottom
    checkNearBottom();

    return () => observer.disconnect();
  }, [hasNext, loading, columns]);

  // Auto-refresh: call `onLoadNew` every 60 seconds when the page is visible.
  // Avoid overlapping calls by tracking an in-flight flag.
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
        // ignore errors from user-provided callback
      } finally {
        inFlight = false;
      }
    };

    const intervalId = window.setInterval(doTick, 60 * 1000);

    // When the page becomes visible, trigger an immediate refresh
    const visibilityHandler = () => {
      if (!document.hidden) doTick();
    };
    document.addEventListener('visibilitychange', visibilityHandler);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', visibilityHandler);
    };
  }, [onLoadNew]);

  const collectMediaForItem = useCallback((itemId: number) => {
    const list: Array<{ src: string; type: 'image' | 'video'; itemId: number }> = [];
    const imgRe = /<img[^>]+src=(?:"|')([^"']+)(?:"|')/gi;
    const vidRe = /<video[^>]+src=(?:"|')([^"']+)(?:"|')/gi;

    const normalize = (raw: string, baseUrl?: string) => {
      if (!raw) return raw;
      if (raw.startsWith('//')) return window.location.protocol + raw;
      if (raw.startsWith('/')) {
        try { const origin = baseUrl ? new URL(baseUrl).origin : window.location.origin; return origin + raw; } catch (e) { return raw; }
      }
      if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw) && baseUrl) {
        try { return new URL(raw, baseUrl).toString(); } catch (e) { return raw; }
      }
      return raw;
    };


    const it = items.find(i => i.id === itemId);
    if (!it) return list;

    let m: RegExpExecArray | null;
    while ((m = imgRe.exec(it.description))) {
      if (m[1]) list.push({ src: normalize(m[1], it.link), type: 'image', itemId: it.id });
    }
    while ((m = vidRe.exec(it.description))) {
      if (m[1]) list.push({ src: normalize(m[1], it.link), type: 'video', itemId: it.id });
    }

    return list;
  }, [items]);

  const handleMediaClick = useCallback((src: string, type: 'image' | 'video' = 'image', itemId?: number) => {
    const clickedItem = items.find(it => it.id === itemId);
    let list: Array<{ src: string; type: 'image' | 'video'; itemId: number }> = [];
    if (itemId !== undefined && clickedItem) {
      list = collectMediaForItem(itemId);
    }
    if (list.length === 0) list = [{ src, type, itemId: itemId ?? -1 }];

    mediaListRef.current = list;
    const idx = list.findIndex(it => it.src === src && it.type === type && (itemId == null || it.itemId === itemId));
    setCurrentMediaIndex(idx >= 0 ? idx : 0);
    setModalMedia({ type, src, itemId });
    setModalOpen(true);
  }, [collectMediaForItem, items]);

  const closeModal = () => {
    setModalOpen(false);
    setModalMedia(null);
    setCurrentMediaIndex(null);
  };

  const showMediaAt = useCallback((idx: number) => {
    const list = mediaListRef.current;
    if (!list || idx < 0 || idx >= list.length) return;
    const m = list[idx];
    setCurrentMediaIndex(idx);
    setModalMedia({ src: m.src, type: m.type, itemId: m.itemId });
  }, []);

  const nextMedia = useCallback(() => {
    const list = mediaListRef.current;
    if (!list || list.length <= 1 || currentMediaIndex == null) return;
    const next = currentMediaIndex + 1;
    if (next >= list.length) return; // do not wrap
    showMediaAt(next);
  }, [currentMediaIndex, showMediaAt]);

  const prevMedia = useCallback(() => {
    const list = mediaListRef.current;
    if (!list || list.length <= 1 || currentMediaIndex == null) return;
    const prev = currentMediaIndex - 1;
    if (prev < 0) return; // do not wrap
    showMediaAt(prev);
  }, [currentMediaIndex, showMediaAt]);

  // Keyboard navigation when modal is open
  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
      else if (e.key === 'ArrowLeft') prevMedia();
      else if (e.key === 'ArrowRight') nextMedia();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen, prevMedia, nextMedia]);


  // Track which items are expanded so we always render them and avoid layout jumps
  const [expandedSet, setExpandedSet] = useState<Set<number>>(new Set());
  const handleCollapseChange = useCallback((id: number, collapsed: boolean) => {
    setExpandedSet(prev => {
      const next = new Set(prev);
      if (!collapsed) next.add(id); // expanded
      else next.delete(id);
      return next;
    });
  }, []);

  // ColumnVirtual renders a virtualized column using @tanstack/react-virtual
  function ColumnVirtual({ columnData, columnIndex }: { columnData: RSSItem[]; columnIndex: number }) {
    const parentRef = useRef<HTMLDivElement | null>(null);

    // Compute offsets and total height based on current item heights
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
        const margin = 500; // overscan

        // find visible indices
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
    }, [columnData, offsets]);

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
                  onHeightChange={(id, h) => {
                    registerHeight(id, h);
                  }}
                  isForcedVisible={expandedSet.has(item.id)}
                  estimateHeight={getItemHeight(item.id)}
                  onCollapseChange={handleCollapseChange}
                  Renderer={FeedItemRenderer}
                />
              </div>
            );
          })}

          {/* Sentinel element at the end of each column */}
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
                    <MeasuredItem
                      item={item}
                      onMediaClick={handleMediaClick}
                      onHeightChange={registerHeight}
                      isForcedVisible={expandedSet.has(item.id)}
                      estimateHeight={getItemHeight(item.id)}
                      onCollapseChange={handleCollapseChange}
                      Renderer={FeedItemRenderer}
                    />
                    {/* If this index matches one of the per-column sentinel indexes, render a sentinel
                        that will be placed near the bottom of a column by the browser's column layout. */}
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
            </>
          ) : (
            <div className={cn(
              "grid gap-4",
              columns === 1 && "grid-cols-1",
              columns === 2 && "grid-cols-2",
              columns === 3 && "grid-cols-3"
            )}>
              {columnItems.map((columnData, columnIndex) => (
                // ColumnVirtual handles virtualization for this column
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
            onClick={(e) => {
              e.stopPropagation();
              // Only navigate when clicking the image itself and there's more than one media
              if (!mediaListRef.current || mediaListRef.current.length <= 1) return;
              try {
                const img = e.currentTarget as HTMLImageElement;
                const rect = img.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                if (clickX < rect.width / 2) {
                  prevMedia();
                } else {
                  nextMedia();
                }
              } catch (err) {
                // ignore
              }
            }}
            onPointerDown={(e) => {
              (e.currentTarget as any)._startX = e.clientX;
            }}
            onPointerUp={(e) => {
              const startX = (e.currentTarget as any)._startX;
              if (typeof startX !== 'number') return;
              const dx = e.clientX - startX;
              if (Math.abs(dx) > 30) {
                if (dx > 0) prevMedia(); else nextMedia();
              }
            }}
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

            {/* NOTE: image click handles previous/next when clicking left/right halves of the image itself. */}

            {/* Prev / Next buttons */}
            {mediaListRef.current.length > 1 && (
              <>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20">
                  <button
                    onClick={(e) => { e.stopPropagation(); showMediaAt(0); }}
                    title="처음으로"
                    aria-label="first"
                    className={cn(
                      "p-2 rounded bg-white/10 hover:bg-white/20",
                      (currentMediaIndex == null || currentMediaIndex === 0) && "opacity-40 pointer-events-none"
                    )}
                    aria-disabled={currentMediaIndex == null || currentMediaIndex === 0}
                  >
                    <SkipBack className="w-4 h-4" />
                    <span className="sr-only">처음으로</span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); prevMedia(); }}
                    title="이전"
                    aria-label="previous"
                    className={cn(
                      "p-2 rounded bg-white/10 hover:bg-white/20",
                      (currentMediaIndex == null || currentMediaIndex === 0) && "opacity-40 pointer-events-none"
                    )}
                    aria-disabled={currentMediaIndex == null || currentMediaIndex === 0}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span className="sr-only">이전</span>
                  </button>
                  <div className="text-xs text-white/90 bg-black/40 px-3 py-1 rounded">{currentMediaIndex != null ? `${currentMediaIndex + 1}/${mediaListRef.current.length}` : ''}</div>
                  <button
                    onClick={(e) => { e.stopPropagation(); nextMedia(); }}
                    title="다음"
                    aria-label="next"
                    className={cn(
                      "p-2 rounded bg-white/10 hover:bg-white/20",
                      (currentMediaIndex == null || currentMediaIndex === mediaListRef.current.length - 1) && "opacity-40 pointer-events-none"
                    )}
                    aria-disabled={currentMediaIndex == null || currentMediaIndex === mediaListRef.current.length - 1}
                  >
                    <ChevronRight className="w-4 h-4" />
                    <span className="sr-only">다음</span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); showMediaAt(mediaListRef.current.length - 1); }}
                    title="마지막으로"
                    aria-label="last"
                    className={cn(
                      "p-2 rounded bg-white/10 hover:bg-white/20",
                      (currentMediaIndex == null || currentMediaIndex === mediaListRef.current.length - 1) && "opacity-40 pointer-events-none"
                    )}
                    aria-disabled={currentMediaIndex == null || currentMediaIndex === mediaListRef.current.length - 1}
                  >
                    <SkipForward className="w-4 h-4" />
                    <span className="sr-only">마지막으로</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
