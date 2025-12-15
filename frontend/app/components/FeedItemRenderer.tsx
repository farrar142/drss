'use client';

import { CheckCircle, Heart } from "lucide-react";
import parse from 'html-react-parser';
import Image from 'next/image';
import { FC, useCallback, useEffect, useMemo, useRef, useState, forwardRef } from "react";
import { cn } from "@/lib/utils";
import { useRSSStore } from "../stores/rssStore";
import { RSSItem } from "../types/rss";
import { feedsRoutersItemToggleItemFavorite, feedsRoutersItemToggleItemRead } from "../services/api";

// Custom Image component for RSS content
const RSSImage: FC<{
  src: string;
  alt?: string;
  onClick: () => void;
}> = ({ src, alt = '', onClick }) => {
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);

  // Calculate aspect ratio based height when image loads
  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
    setLoaded(true);
  };

  // For images without known dimensions, use regular img tag for proper aspect ratio
  if (error) {
    // Fallback to regular img tag if Next.js Image fails
    return (
      <img
        src={src}
        alt={alt}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClick();
        }}
        loading="lazy"
        style={{
          display: 'block',
          width: '100%',
          height: 'auto',
          cursor: 'pointer'
        }}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={naturalSize?.width || 800}
      height={naturalSize?.height || 600}
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      style={{
        width: '100%',
        height: 'auto',
        cursor: 'pointer',
        opacity: loaded ? 1 : 0,
        transition: 'opacity 0.2s'
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      onLoad={handleLoad}
      onError={() => setError(true)}
      loading="lazy"
      unoptimized={src.startsWith('data:')} // Data URLs should not be optimized
    />
  );
};

// Custom Video component with intersection observer for autoplay
const RSSVideo: FC<{
  src?: string;
  poster?: string;
  className?: string;
  onClick?: () => void;
  [key: string]: any;
}> = ({ src, poster, className, onClick, ...props }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            video.play().catch(() => { });
          } else {
            video.pause();
          }
        });
      },
      { threshold: 0.5 }
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    <video
      ref={videoRef}
      src={src}
      poster={poster}
      className={className}
      muted
      loop
      playsInline
      controls
      preload="metadata"
      style={{
        display: 'block',
        width: '100%',
        height: 'auto',
        cursor: onClick ? 'pointer' : undefined
      }}
      onClick={(e) => {
        if (onClick) {
          e.stopPropagation();
          onClick();
        }
      }}
      {...props}
    />
  );
};

const renderDescription = (description: string, onMediaClick: (url: string, type: 'image' | 'video') => void) => {
  // Helper to check if a node contains an img or video
  const hasMediaChild = (node: any): boolean => {
    if (!node.children) return false;
    return node.children.some((child: any) =>
      child.name === 'img' || child.name === 'video' || hasMediaChild(child)
    );
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
            return (
              <RSSImage
                key={index}
                src={src}
                alt={alt}
                onClick={() => onMediaClick(src, 'image')}
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

        return (
          <RSSImage
            src={src}
            alt={alt}
            onClick={() => onMediaClick(src, 'image')}
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

  const description = useMemo(() => renderDescription(item.description, onMediaClick), [item.description, onMediaClick]);

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
      ref={ref}
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
