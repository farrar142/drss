'use client';

import React, { useEffect, useState } from 'react';
import { FeedItemViewer } from '../components/FeedItemViewer';
import { useRSSStore } from '../stores/rssStore';
import { feedsRouterListAllItems, feedsRouterListFeeds } from '../services/api';
import { RSSItem } from '../types/rss';

export default function HomePage() {
  const { } = useRSSStore();
  const [items, setItems] = useState<RSSItem[]>([])
  useEffect(() => {
    if (items.length !== 0) return
    feedsRouterListAllItems().then(setItems);
  }, [])
  return <FeedItemViewer items={items}></FeedItemViewer>;
}
