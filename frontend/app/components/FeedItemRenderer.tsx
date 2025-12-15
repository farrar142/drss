'use client';

import { CheckCircle, Heart } from "lucide-react";
import parse from 'html-react-parser';
import { FC, useCallback, useEffect, useMemo, useRef, useState, forwardRef } from "react";
import { feedsRoutersItemToggleItemFavorite, feedsRoutersItemToggleItemRead } from "../services/api";
import { cn } from "@/lib/utils";
import { useRSSStore } from "../stores/rssStore";
import { RSSItem } from "../types/rss";
import { RSSImage } from "./RSSImage";
import { RSSVideo } from "./RSSVideo";


const renderDescription = (
  description: string,
  onMediaClick: (url: string, type: 'image' | 'video') => void,
  baseUrl?: string
) => {
  // Helper to check if a node contains an img or video
  const hasMediaChild = (node: any): boolean => {
    if (!node.children) return false;
    return node.children.some((child: any) =>
      child.name === 'img' || child.name === 'video' || hasMediaChild(child)
    );
  };

  const normalizeSrc = (raw: string) => {
    if (!raw) return raw;
    // Protocol-relative (//example.com/path)
    if (raw.startsWith('//')) {
      try {
        return window.location.protocol + raw;
      } catch (e) {
        return raw;
      }
    }
    // Root-relative (/path) -> resolve against article/feed origin if provided
    if (raw.startsWith('/')) {
      try {
        const origin = baseUrl ? new URL(baseUrl).origin : window.location.origin;
        return origin + raw;
      } catch (e) {
        return raw;
      }
    }
    // If it's not an absolute URL (no scheme) and we have a baseUrl, resolve relative paths
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw) && baseUrl) {
      try {
        return new URL(raw, baseUrl).toString();
      } catch (e) {
        return raw;
      }
    }
    return raw;
  };

  return parse(description, {
    replace: (domNode: any) => {
      if (domNode.attribs && domNode.attribs.class) {
        domNode.attribs.className = domNode.attribs.class;
        delete domNode.attribs.class;
      }

      // Handle <a> tags that wrap images - remove the link wrapper
      if (domNode.name === 'a' && hasMediaChild(domNode)) {
        // Return just the children without the <a> wrapper
        return <>{domNode.children?.map((child: any, index: number) => {
          if (child.name === 'img') {
            const src = child.attribs?.src;
            const alt = child.attribs?.alt || '';
            if (!src) return null;
            const resolved = normalizeSrc(src);
            return (
              <RSSImage
                key={index}
                src={resolved}
                alt={alt}
                onClick={() => onMediaClick(resolved, 'image')}
              />
            );
          }
          return null;
        })}</>;
      }

      if (domNode.name === 'img') {
        const src = domNode.attribs.src;
        const alt = domNode.attribs.alt || '';

        // Skip if no src
        if (!src) return null;

        const resolved = normalizeSrc(src);
        return (
          <RSSImage
            src={resolved}
            alt={alt}
            onClick={() => onMediaClick(resolved, 'image')}
          />
        );
      }
      if (domNode.name === 'video') {
        const { class: _, src, ...attribs } = domNode.attribs;
        const videoSrc = src || attribs.source;
        return (
          <RSSVideo
            src={videoSrc}
            onClick={() => videoSrc && onMediaClick(videoSrc, 'video')}
            {...attribs}
          />
        );
      }
    }
  });
}

export const FeedItemRenderer = forwardRef<HTMLDivElement, {
  item: RSSItem,
  onMediaClick: (url: string, type: 'image' | 'video') => void,
  onCollapseChange?: (id: number, collapsed: boolean) => void
}>(({ item, onMediaClick, onCollapseChange }, ref) => {
  const { viewMode } = useRSSStore()
  const [collapsed, setCollapsed] = useState(true);
  const [isRead, setIsRead] = useState(item.is_read);
  const [isFavorite, setIsFavorite] = useState(item.is_favorite);
  const localRef = useRef<HTMLDivElement | null>(null);

  const description = useMemo(() => renderDescription(item.description, onMediaClick, item.link), [item.description, onMediaClick, item.link]);

  const publishedAt = useMemo(() => {
    try {
      const d = new Date(item.published_at);
      if (isNaN(d.getTime())) return null;
      // Format like: Dec 15, 2025 · 17:26
      const date = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
      const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      return `${date} · ${time}`;
    } catch (e) {
      return null;
    }
  }, [item.published_at]);

  // Pre-schedule caching for nearby (above-the-fold / near-viewport) items to improve
  // perceived performance. If the item's container is within ~1.5x viewport height on mount,
  // schedule caching for all images found in the description.
  useEffect(() => {
    const el = localRef.current as HTMLDivElement | null;
    if (!el) return;
    try {
      const rect = el.getBoundingClientRect();
      if (rect.top < (window.innerHeight * 1.5)) {
        const urls: string[] = [];
        const re = /<img[^>]+src=(?:"|')([^"']+)(?:"|')/gi;
        let m: RegExpExecArray | null;
        while ((m = re.exec(item.description))) {
          if (m[1]) urls.push(m[1]);
        }
        // No-op: server-side image caching was removed. Rely on browser cache.
      }
    } catch (e) {
      // ignore
    }
  }, [item.description]);

  const handleToggleFavorite = useCallback(async () => {
    try {
      await feedsRoutersItemToggleItemFavorite(item.id);
      setIsFavorite(!isFavorite);
    } catch (error) {
      console.error(error);
    }
  }, [item.id, isFavorite]);

  const handleToggleRead = useCallback(async () => {
    try {
      await feedsRoutersItemToggleItemRead(item.id);
      setIsRead(!isRead);
    } catch (error) {
      console.error(error);
    }
  }, [item.id, isRead]);

  return (
    <div
      ref={(node) => {
        localRef.current = node;
        if (typeof ref === 'function') (ref as any)(node);
        else if (ref && typeof ref === 'object') (ref as any).current = node;
      }}
      key={item.id}
      className={cn(
        "glass-card p-4 cursor-pointer",
        viewMode === 'board' ? 'mb-3' : ''
      )}
      onClick={() => {
        const newCollapsed = !collapsed;
        setCollapsed(newCollapsed);
        onCollapseChange && onCollapseChange(item.id, newCollapsed);
      }}
    >
      {/* Header with actions and title */}
      <div className="flex justify-between items-start gap-4">
        <div className="flex items-center gap-2 flex-wrap flex-1">
          {/* Read Toggle Button */}
          <button
            onClick={(e) => { e.stopPropagation(); handleToggleRead(); }}
            className={cn(
              "p-1.5 rounded-full transition-colors",
              isRead
                ? "bg-primary/20 hover:bg-primary/30"
                : "bg-muted hover:bg-muted/80"
            )}
          >
            <CheckCircle className={cn(
              "w-5 h-5",
              isRead ? "text-primary" : "text-muted-foreground"
            )} />
          </button>

          {/* Favorite Toggle Button */}
          <button
            onClick={(e) => { e.stopPropagation(); handleToggleFavorite(); }}
            className={cn(
              "p-1.5 rounded-full transition-colors",
              isFavorite
                ? "bg-red-500/20 hover:bg-red-500/30"
                : "bg-muted hover:bg-muted/80"
            )}
          >
            <Heart className={cn(
              "w-5 h-5",
              isFavorite ? "text-red-500 fill-red-500" : "text-muted-foreground"
            )} />
          </button>

          {/* Title */}
          <h3 className="flex-1 text-base font-semibold text-foreground leading-snug">
            {item.title}
            {publishedAt && (
              <div className="text-xs text-muted-foreground font-normal mt-1">
                {publishedAt}
              </div>
            )}
          </h3>
        </div>

        {/* Read More Link */}
        <a
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "px-3 py-1.5 rounded-md text-xs font-medium text-white whitespace-nowrap",
            "bg-primary hover:bg-primary/90 transition-colors"
          )}
        >
          Read more
        </a>
      </div>

      {/* Description */}
      {(viewMode === 'feed' || !collapsed) && (
        <div className="mt-3 text-muted-foreground leading-relaxed overflow-hidden prose prose-sm dark:prose-invert max-w-none">
          {description}
        </div>
      )}
    </div>
  )
});

FeedItemRenderer.displayName = 'FeedItemRenderer';

export default FeedItemRenderer;
