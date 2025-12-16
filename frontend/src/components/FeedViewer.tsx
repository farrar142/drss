'use client';

import { FC, RefObject } from "react";
import { RSSItem } from "../types/rss";
import { useFeedViewer } from "../hooks/useFeedViewer";
import { FeedViewerView } from "./FeedViewerView";

export interface FeedViewerProps {
  items: RSSItem[];
  onLoadMore?: () => void;
  onLoadNew?: () => void;
  hasNext?: boolean;
  loading?: boolean;
  /** 탭이 활성화된 상태인지 (비활성 시 IntersectionObserver 비활성화) */
  isActive?: boolean;
  /** 최대 컬럼 수 (탭별 설정, 기본 3) */
  maxColumns?: number;
  /** 스크롤 컨테이너 ref (개별 패널 스크롤용) */
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
}

export const FeedViewer: FC<FeedViewerProps> = (props) => {
  const viewerState = useFeedViewer(props);
  return <FeedViewerView {...viewerState} />;
};
