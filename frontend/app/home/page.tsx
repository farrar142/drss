'use client';

import React, { useEffect, useState } from 'react';
import { FeedItemViewer } from '../components/FeedItemViewer';
import { useRSSStore } from '../stores/rssStore';
import { RSSItem } from '../types/rss';
import { feedsRoutersItemListAllItems } from '../services/api';

export default function HomePage() {
  const { } = useRSSStore();
  const [items, setItems] = useState<RSSItem[]>([])
  useEffect(() => {
    if (items.length !== 0) return
    feedsRoutersItemListAllItems().then(setItems);
  }, [])
  return <FeedItemViewer items={items}></FeedItemViewer>;
}
