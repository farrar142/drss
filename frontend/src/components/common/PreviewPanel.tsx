'use client';

import React, { useMemo, useCallback, useId } from 'react';
import { PreviewItem } from '@/services/api';
import { FeedItemCard } from '@/components/feed/FeedItemCard';
import { RSSItem } from '@/types/rss';

interface PreviewPanelProps {
  items: PreviewItem[];
  pageCss?: string;  // 페이지에서 추출한 CSS (::marker 등 pseudo-element 스타일 유지용)
}

// CSS 셀렉터를 스코프 ID로 감싸는 함수
function scopeCss(css: string, scopeId: string): string {
  if (!css.trim()) return '';
  
  // 간단한 CSS 스코핑: 각 셀렉터 앞에 scope ID 추가
  // 주의: 복잡한 CSS는 완벽하게 처리되지 않을 수 있음
  return css.replace(
    /([^\r\n,{}]+)(,(?=[^}]*{)|\s*{)/g,
    (match, selector, ending) => {
      const trimmed = selector.trim();
      // @규칙은 스킵
      if (trimmed.startsWith('@') || trimmed.startsWith('from') || trimmed.startsWith('to') || /^\d+%$/.test(trimmed)) {
        return match;
      }
      // :root, html, body는 스코프로 대체
      if (trimmed === ':root' || trimmed === 'html' || trimmed === 'body') {
        return `#${scopeId}${ending}`;
      }
      return `#${scopeId} ${trimmed}${ending}`;
    }
  );
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

export function PreviewPanel({ items, pageCss }: PreviewPanelProps) {
  const scopeId = useId().replace(/:/g, '');  // CSS-safe ID 생성
  
  // 미리보기용 미디어 클릭 핸들러 (새 탭에서 열기)
  const handleMediaClick = useCallback((url: string, type: 'image' | 'video', itemId?: number) => {
    window.open(url, '_blank');
  }, []);

  // 스코프된 CSS 생성
  const scopedCss = useMemo(() => {
    if (!pageCss) return '';
    return scopeCss(pageCss, scopeId);
  }, [pageCss, scopeId]);

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
    <div id={scopeId} className="space-y-1 max-h-[60vh] overflow-y-auto">
      {/* 페이지에서 추출한 CSS를 스코프하여 적용 */}
      {scopedCss && <style dangerouslySetInnerHTML={{ __html: scopedCss }} />}
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
