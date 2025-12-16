'use client';

import { FC } from "react";
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
}

export const FeedViewer: FC<FeedViewerProps> = (props) => {
  const viewerState = useFeedViewer(props);
  return <FeedViewerView {...viewerState} />;
};
