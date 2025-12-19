'use client';

import { FC, memo, useMemo } from "react";
import { cn } from "@/lib/utils";
import { RSSItem } from "../../types/rss";
import { MediaModal } from "../media/MediaModal";
import { CruisingControls } from "../common/CruisingControls";
import { PullToRefresh } from "../common/PullToRefresh";
import { UseFeedViewerReturn } from "../../hooks/feed/useFeedViewer";
import { useSettingsStore } from "../../stores/settingsStore";
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

// 단일 컬럼 컴포넌트 - memo로 불필요한 리렌더링 방지
const Column = memo(function Column({
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
    <div className="flex flex-col gap-4" style={{ contain: 'layout style' }}>
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
});

// FeedViewerView를 memo로 감싸서 불필요한 리렌더링 방지
export const FeedViewerView: FC<FeedViewerViewProps> = memo(function FeedViewerView({
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
}) {
  // cruising에서 필요한 값만 추출 (객체 참조 변경으로 인한 리렌더링 방지)
  const { isCruising, speedPercent, toggleCruising, setSpeedPercent } = cruising;

  // 크루즈 컨트롤 표시 여부
  const { showCruisingControls } = useSettingsStore();

  return (
    <div className={cn(
      "relative min-h-[calc(100vh-7rem)]",
      // 크루징 중에는 pointer-events 비활성화 (성능 최적화)
      isCruising && "pointer-events-none"
    )}>
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
            <div
              className={cn(
                "grid gap-4",
                columns === 1 && "grid-cols-1",
                columns === 2 && "grid-cols-2",
                columns === 3 && "grid-cols-3",
                columns === 4 && "grid-cols-4",
                columns === 5 && "grid-cols-5"
              )}
              style={{ contain: 'layout style' }}
            >
              {columnItems.slice(0, columns).map((columnData, columnIndex) => (
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
      {showCruisingControls && (
        <CruisingControls
          isCruising={isCruising}
          speedPercent={speedPercent}
          onToggle={toggleCruising}
          onSpeedChange={setSpeedPercent}
          scrollContainerRef={scrollContainerRef}
        />
      )}
    </div>
  );
});
