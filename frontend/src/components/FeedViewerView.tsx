'use client';

import { FC } from "react";
import { cn } from "@/lib/utils";
import { RSSItem } from "../types/rss";
import { MediaModal } from "./MediaModal";
import { CruisingControls } from "./CruisingControls";
import { PullToRefresh } from "./PullToRefresh";
import { UseFeedViewerReturn } from "../hooks/useFeedViewer";
import dynamic from 'next/dynamic';

// Dynamically import FeedItemCard to reduce initial bundle size
const FeedItemCard = dynamic(
  () => import('./FeedItemCard').then((mod) => mod.FeedItemCard),
  {
    loading: () => <div className="h-24 bg-muted/30 rounded" />,
    ssr: false,
  }
);

export interface FeedViewerViewProps extends UseFeedViewerReturn { }

// 단일 컬럼 컴포넌트
function Column({
  columnData,
  columnIndex,
  handleCollapseChange,
  handleMediaClick,
  setSentinelRef,
}: {
  columnData: RSSItem[];
  columnIndex: number;
  handleCollapseChange: (id: number, collapsed: boolean) => void;
  handleMediaClick: (src: string, type?: 'image' | 'video', itemId?: number) => void;
  setSentinelRef: (index: number) => (el: HTMLDivElement | null) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {columnData.map((item) => (
        <FeedItemCard
          key={item.id}
          item={item}
          onMediaClick={handleMediaClick}
          onCollapseChange={handleCollapseChange}
        />
      ))}
      {/* Sentinel: 이 컬럼의 끝이 보이면 대기열에서 아이템 추가 */}
      <div
        ref={setSentinelRef(columnIndex)}
        className="h-4 w-full"
        data-column-sentinel={columnIndex}
      />
    </div>
  );
}

export const FeedViewerView: FC<FeedViewerViewProps> = ({
  viewMode,
  columns,
  columnItems,
  handleCollapseChange,
  mediaModal,
  handleMediaClick,
  cruising,
  setSentinelRef,
  hasNext,
  items,
  handleLoadNew,
  queueLength,
  scrollContainerRef,
}) => {
  return (
    <div className="relative">
      <PullToRefresh onRefresh={handleLoadNew} scrollContainerRef={scrollContainerRef}>
        <div className="w-full">
          {/* Content Grid */}
          {viewMode === 'board' ? (
            // Board 모드: 단일 컬럼으로 모든 아이템 표시
            <div className="w-full space-y-3 px-1">
              {items.map((item) => (
                <FeedItemCard
                  key={item.id}
                  item={item}
                  onMediaClick={handleMediaClick}
                  onCollapseChange={handleCollapseChange}
                />
              ))}
              {hasNext && (
                <div ref={setSentinelRef(0)} className="h-4 w-full" />
              )}
            </div>
          ) : (
            // Feed 모드: 멀티 컬럼 그리드
            <div className={cn(
              "grid gap-4",
              columns === 1 && "grid-cols-1",
              columns === 2 && "grid-cols-2",
              columns === 3 && "grid-cols-3"
            )}>
              {columnItems.map((columnData, columnIndex) => (
                <Column
                  key={columnIndex}
                  columnData={columnData}
                  columnIndex={columnIndex}
                  handleCollapseChange={handleCollapseChange}
                  handleMediaClick={handleMediaClick}
                  setSentinelRef={setSentinelRef}
                />
              ))}
            </div>
          )}
        </div>
      </PullToRefresh>

      {/* Queue indicator (개발용, 나중에 제거 가능) */}
      {process.env.NODE_ENV === 'development' && queueLength > 0 && (
        <div className="sticky bottom-4 left-0 w-fit bg-primary/80 text-primary-foreground px-2 py-1 rounded text-xs">
          Queue: {queueLength}
        </div>
      )}

      {/* Media Modal */}
      <MediaModal modal={mediaModal} />

      {/* Cruising Controls */}
      <CruisingControls
        isCruising={cruising.isCruising}
        speedPercent={cruising.speedPercent}
        onToggle={cruising.toggleCruising}
        onSpeedChange={cruising.setSpeedPercent}
        scrollContainerRef={scrollContainerRef}
      />
    </div>
  );
};
