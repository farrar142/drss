'use client';

import React, { useMemo, useCallback } from 'react';
import { PreviewItem } from '@/services/api';
import { FeedItemCard } from '@/components/feed/FeedItemCard';
import { RSSItem } from '@/types/rss';

interface PreviewPanelProps {
  items: PreviewItem[];
}

// PreviewItem을 RSSItem 형태로 변환
function convertToRSSItem(item: PreviewItem, index: number): RSSItem {
  return {
    id: index,
    feed_id: 0,
    title: item.title,
    link: item.link,
    description: item.description || '',
    image: item.image,
    published_at: item.published_at || new Date().toISOString(),
    is_read: false,
    is_favorite: false,
  };
}

export function PreviewPanel({ items }: PreviewPanelProps) {
  // 미리보기용 미디어 클릭 핸들러 (새 탭에서 열기)
  const handleMediaClick = useCallback((url: string, type: 'image' | 'video', itemId?: number) => {
    window.open(url, '_blank');
  }, []);

  // PreviewItem들을 RSSItem으로 변환
  const rssItems = useMemo(() =>
    items.map((item, index) => convertToRSSItem(item, index)),
    [items]
  );

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No items found with the current selectors
      </div>
    );
  }

  return (
    <div className="space-y-1 max-h-[60vh] overflow-y-auto">
      {rssItems.map((item) => (
        <FeedItemCard
          key={item.id}
          item={item}
          onMediaClick={handleMediaClick}
        />
      ))}
    </div>
  );
}
