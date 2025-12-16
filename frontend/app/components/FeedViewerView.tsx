'use client';

import { FC, useState, useEffect, useMemo, useCallback } from "react";
import { ArrowUp } from 'lucide-react';
import { cn } from "@/lib/utils";
import { RSSItem } from "../types/rss";
import { MeasuredItem } from "./MeasuredItem";
import { MediaModal } from "./MediaModal";
import { CruisingControls } from "./CruisingControls";
import { PullToRefresh } from "./PullToRefresh";
import { UseFeedViewerReturn } from "../hooks/useFeedViewer";
import dynamic from 'next/dynamic';

// Dynamically import FeedItemCard to reduce initial bundle size
const FeedItemCard = dynamic(
  () => import('./FeedItemCard').then((mod) => mod.FeedItemCard),
  {
    loading: () => <div className="h-24 animate-pulse bg-muted rounded" />,
    ssr: false,
  }
);

export interface FeedViewerViewProps extends UseFeedViewerReturn { }

// ColumnVirtual component for virtualized columns
function ColumnVirtual({
  columnData,
  columnIndex,
  getItemHeight,
  registerHeight,
  expandedSet,
  handleCollapseChange,
  handleMediaClick,
  hasNext,
  setSentinelRef,
}: {
  columnData: RSSItem[];
  columnIndex: number;
  getItemHeight: (id: number) => number;
  registerHeight: (id: number, height: number) => void;
  expandedSet: Set<number>;
  handleCollapseChange: (id: number, collapsed: boolean) => void;
  handleMediaClick: (src: string, type?: 'image' | 'video', itemId?: number) => void;
  hasNext?: boolean;
  setSentinelRef: (index: number) => (el: HTMLDivElement | null) => void;
}) {
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
    let rafId: number | null = null;
    let resizeTimeoutId: NodeJS.Timeout | null = null;

    const calculateRange = () => {
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

    const onScroll = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        calculateRange();
        rafId = null;
      });
    };

    // Debounced resize handler
    const onResize = () => {
      if (resizeTimeoutId) clearTimeout(resizeTimeoutId);
      resizeTimeoutId = setTimeout(() => {
        calculateRange();
        resizeTimeoutId = null;
      }, 150);
    };

    calculateRange();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (resizeTimeoutId) clearTimeout(resizeTimeoutId);
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
                Renderer={FeedItemCard}
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

export const FeedViewerView: FC<FeedViewerViewProps> = ({
  viewMode,
  columns,
  columnItems,
  useCSSColumns,
  columnSentinelIndexes,
  registerHeight,
  getItemHeight,
  expandedSet,
  handleCollapseChange,
  mediaModal,
  handleMediaClick,
  cruising,
  setSentinelRef,
  onLoadNew,
  hasNext,
  items,
  handleLoadNew,
}) => {
  return (
    <>
      <PullToRefresh onRefresh={handleLoadNew}>
        <div className="w-full space-y-4">
          {/* Content Grid */}
          {viewMode === 'board' ? (
            <div className="w-full space-y-3 px-1">
              {items.map((item) => (
                <FeedItemCard key={item.id} item={item} onMediaClick={handleMediaClick} />
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
                      Renderer={FeedItemCard}
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
                    getItemHeight={getItemHeight}
                    registerHeight={registerHeight}
                    expandedSet={expandedSet}
                    handleCollapseChange={handleCollapseChange}
                    handleMediaClick={handleMediaClick}
                    hasNext={hasNext}
                    setSentinelRef={setSentinelRef}
                  />
                ))}
              </div>
            )
          )}
        </div>
      </PullToRefresh>


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
};
