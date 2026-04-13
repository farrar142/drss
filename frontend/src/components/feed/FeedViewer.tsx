'use client';

import { FC, RefObject, memo } from "react";
import { RSSItem } from "../../types/rss";
import { useFeedViewer } from "../../hooks/feed/useFeedViewer";
import { FeedViewerView } from "./FeedViewerView";

export interface FeedViewerProps {
  items: RSSItem[];
  onLoadMore?: () => void;
  onLoadNew?: () => void;
  hasNext?: boolean;
  loading?: boolean;
  /** 최대 컬럼 수 (기본 3) */
  maxColumns?: number;
  /** 스크롤 컨테이너 ref */
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
  /** 아이템 업데이트 콜백 */
  onItemUpdate?: (itemId: number, updatedData: Partial<RSSItem>) => void;
  /** 아이템 삭제 콜백 */
  onItemDelete?: (itemId: number) => void;
}

export const FeedViewer: FC<FeedViewerProps> = memo(function FeedViewer(props) {
  const viewerState = useFeedViewer(props);
  return <FeedViewerView {...viewerState} />;
});
FeedViewer.displayName = 'FeedViewer';
