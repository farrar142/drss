'use client';

import { CheckCircle, Heart } from "lucide-react";
import parse, { DOMNode, Element, domToReact, HTMLReactParserOptions } from 'html-react-parser';
import { FC, useCallback, useEffect, useMemo, useRef, useState, forwardRef } from "react";
import { feedsRoutersItemToggleItemFavorite, feedsRoutersItemToggleItemRead } from "../services/api";
import { cn } from "@/lib/utils";
import { useRSSStore } from "../stores/rssStore";
import { useSettingsStore, fontSizeConfig, FontSizeLevel } from "../stores/settingsStore";
import { RSSItem } from "../types/rss";
import { FeedImage } from "./FeedImage";
import { FeedVideo } from "./FeedVideo";


const renderDescription = (
  description: string,
  onMediaClick: (url: string, type: 'image' | 'video', itemId?: number) => void,
  baseUrl?: string,
  itemId?: number
) => {
  // Helper to check if a node contains an img or video (directly or nested)
  const hasMediaChild = (node: any): boolean => {
    if (!node.children) return false;
    return node.children.some((child: any) =>
      child.name === 'img' || child.name === 'video' || hasMediaChild(child)
    );
  };

  // Helper to check if a node is inline (can be inside <p>)
  const isBlockElement = (name: string): boolean => {
    const blockElements = ['div', 'p', 'figure', 'blockquote', 'ul', 'ol', 'li', 'table', 'section', 'article', 'header', 'footer', 'nav', 'aside', 'main', 'form', 'fieldset', 'address', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'hr', 'noscript'];
    return blockElements.includes(name);
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

  // Convert CSS string to React style object
  const parseStyleString = (styleString: string): React.CSSProperties => {
    const style: Record<string, string> = {};
    styleString.split(';').forEach(rule => {
      const [property, value] = rule.split(':').map(s => s.trim());
      if (property && value) {
        // Convert kebab-case to camelCase (e.g., text-align -> textAlign)
        const camelCaseProperty = property.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
        style[camelCaseProperty] = value;
      }
    });
    return style as React.CSSProperties;
  };

  // Define replace function separately so it can be used recursively with domToReact
  const replaceNode = (domNode: DOMNode): React.ReactElement | null | undefined => {
    if (!(domNode instanceof Element)) return undefined; // Let default parsing handle
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
            <FeedImage
              key={index}
              src={resolved}
              alt={alt}
              onClick={() => onMediaClick(resolved, 'image', itemId)}
            />
          );
        } else if (child.name === 'video') {
          const { class: _, src, ...attribs } = child.attribs;
          const videoSrc = src || attribs.source;
          if (!videoSrc) return null;
          const resolved = normalizeSrc(videoSrc);
          return (
            <FeedVideo
              key={index}
              src={resolved}
              onClick={() => onMediaClick(resolved, 'video', itemId)}
              {...attribs}
            />
          );
        }
        return null;
      })}</>;
    }

    // Convert <p> to <div> if it contains media (img/video) to avoid hydration errors
    // HTML doesn't allow <div> inside <p>, and FeedImage/FeedVideo use <div>
    if (domNode.name === 'p' && hasMediaChild(domNode)) {
      const { class: className, style: styleString, ...attribs } = domNode.attribs || {};
      const style = styleString ? parseStyleString(styleString) : undefined;
      return (
        <div {...attribs} className={className} style={style}>
          {domToReact(domNode.children as DOMNode[], { replace: replaceNode })}
        </div>
      );
    }

    if (domNode.name === 'img') {
      const src = domNode.attribs.src;
      const alt = domNode.attribs.alt || '';

      // Skip if no src
      if (!src) return null;

      const resolved = normalizeSrc(src);
      return (
        <FeedImage
          src={resolved}
          alt={alt}
          onClick={() => onMediaClick(resolved, 'image', itemId)}
        />
      );
    }
    if (domNode.name === 'video') {
      const { class: _, src, ...attribs } = domNode.attribs;
      const videoSrc = src || attribs.source;
      const resolved = videoSrc ? normalizeSrc(videoSrc) : videoSrc;
      return (
        <FeedVideo
          src={resolved}
          onClick={() => resolved && onMediaClick(resolved, 'video', itemId)}
          {...attribs}
        />
      );
    }
    return undefined; // Let default parsing handle other elements
  };

  return parse(description, { replace: replaceNode });
}

export const FeedItemCard = forwardRef<HTMLDivElement, {
  item: RSSItem,
  onMediaClick: (url: string, type: 'image' | 'video', itemId?: number) => void,
  onCollapseChange?: (id: number, collapsed: boolean) => void,
  fontSizeOverride?: FontSizeLevel, // 미리보기용 오버라이드
}>(({ item, onMediaClick, onCollapseChange, fontSizeOverride }, ref) => {
  const { viewMode } = useRSSStore()
  const { fontSizeLevel: storeFontSize } = useSettingsStore();
  const fontSizeLevel = fontSizeOverride || storeFontSize;
  const fontSize = fontSizeConfig[fontSizeLevel];
  
  const [collapsed, setCollapsed] = useState(true);
  const [isRead, setIsRead] = useState(item.is_read);
  const [isFavorite, setIsFavorite] = useState(item.is_favorite);
  const localRef = useRef<HTMLDivElement | null>(null);

  // Use ref for onMediaClick to avoid re-rendering description on callback change
  const onMediaClickRef = useRef(onMediaClick);
  onMediaClickRef.current = onMediaClick;

  // Stable callback that uses the ref
  const stableMediaClick = useCallback((url: string, type: 'image' | 'video', itemId?: number) => {
    onMediaClickRef.current(url, type, itemId);
  }, []);

  const description = useMemo(() => renderDescription(item.description, stableMediaClick, item.link, item.id), [item.description, stableMediaClick, item.link, item.id]);

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
      <div className={cn("flex justify-between items-start", fontSize.gap)}>
        <div className={cn("flex items-center flex-wrap flex-1", fontSize.gap)}>
          {/* Read Toggle Button */}
          <button
            onClick={(e) => { e.stopPropagation(); handleToggleRead(); }}
            className={cn(
              "p-1 rounded-full transition-colors flex items-center justify-center",
              fontSize.iconWrapper,
              isRead
                ? "bg-primary/20 hover:bg-primary/30"
                : "bg-muted hover:bg-muted/80"
            )}
          >
            <CheckCircle className={cn(
              fontSize.icon,
              isRead ? "text-primary" : "text-muted-foreground"
            )} />
          </button>

          {/* Favorite Toggle Button */}
          <button
            onClick={(e) => { e.stopPropagation(); handleToggleFavorite(); }}
            className={cn(
              "p-1 rounded-full transition-colors flex items-center justify-center",
              fontSize.iconWrapper,
              isFavorite
                ? "bg-red-500/20 hover:bg-red-500/30"
                : "bg-muted hover:bg-muted/80"
            )}
          >
            <Heart className={cn(
              fontSize.icon,
              isFavorite ? "text-red-500 fill-red-500" : "text-muted-foreground"
            )} />
          </button>

          {/* Title */}
          <h3 className={cn("flex-1 font-semibold text-foreground leading-snug", fontSize.title)}>
            {item.title}
            {publishedAt && (
              <div className={cn("text-muted-foreground font-normal mt-1", fontSize.meta)}>
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
            "px-2 py-1 rounded-md font-medium text-white whitespace-nowrap",
            "bg-primary hover:bg-primary/90 transition-colors",
            fontSize.meta
          )}
        >
          Read more
        </a>
      </div>

      {/* Description */}
      {(viewMode === 'feed' || !collapsed) && (
        <div className={cn(
          "mt-3 text-muted-foreground leading-relaxed overflow-hidden prose dark:prose-invert max-w-none",
          fontSize.body
        )}>
          {description}
        </div>
      )}
    </div>
  )
});

FeedItemCard.displayName = 'FeedItemCard';

export default FeedItemCard;
