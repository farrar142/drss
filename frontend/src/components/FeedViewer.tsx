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
}

export const FeedViewer: FC<FeedViewerProps> = (props) => {
  console.log('[FeedViewer] render:', { itemsLength: props.items.length });
  const viewerState = useFeedViewer(props);
  console.log('[FeedViewer] after useFeedViewer');
  return <FeedViewerView {...viewerState} />;
};
