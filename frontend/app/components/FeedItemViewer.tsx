'use client';

import { FC } from "react";
import { RSSItem } from "../types/rss";
import { useFeedItemViewer } from "../hooks/useFeedItemViewer";
import { FeedItemViewerView } from "./FeedItemViewerView";

export interface FeedItemViewerProps {
  items: RSSItem[];
  onLoadMore?: () => void;
  onLoadNew?: () => void;
  hasNext?: boolean;
  loading?: boolean;
}

export const FeedItemViewer: FC<FeedItemViewerProps> = (props) => {
  const viewerState = useFeedItemViewer(props);
  return <FeedItemViewerView {...viewerState} />;
};
