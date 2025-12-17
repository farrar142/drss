'use client';

import React, { useMemo, useCallback } from 'react';
import { ExternalLink, Calendar, FileText } from 'lucide-react';
import { Card, CardContent } from '@/ui/card';
import { Badge } from '@/ui/badge';
import { PreviewItem } from '@/services/api';
import { renderDescription } from './FeedItemCard';

interface PreviewPanelProps {
  items: PreviewItem[];
}

export function PreviewPanel({ items }: PreviewPanelProps) {
  // 미리보기용 더미 미디어 클릭 핸들러 (새 탭에서 열기)
  const handleMediaClick = useCallback((url: string, type: 'image' | 'video', itemId?: number) => {
    window.open(url, '_blank');
  }, []);

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No items found with the current selectors
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-[60vh] overflow-y-auto">
      {items.map((item, index) => {
        // description을 renderDescription으로 렌더링 (CSS scoping 포함)
        const renderedDescription = item.description
          ? renderDescription(item.description, handleMediaClick, item.link, index)
          : null;

        return (
          <Card key={index} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex gap-4">
                {/* Thumbnail */}
                {item.image && (
                  <div className="flex-shrink-0">
                    <img
                      src={item.image}
                      alt=""
                      className="w-24 h-24 object-cover rounded-md"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Title */}
                  <h3 className="font-medium line-clamp-2 mb-1">
                    {item.link ? (
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-primary flex items-center gap-1"
                      >
                        {item.title}
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                      </a>
                    ) : (
                      item.title
                    )}
                  </h3>

                  {/* Description with scoped CSS */}
                  {renderedDescription && (
                    <div className={`rss-scope-${index} text-sm text-muted-foreground mb-2 prose prose-sm dark:prose-invert max-w-none`}>
                      {renderedDescription}
                    </div>
                  )}

                  {/* Meta */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {item.date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {item.date}
                      </span>
                    )}
                    {item.link && (
                      <Badge variant="outline" className="text-xs">
                        Has Link
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
