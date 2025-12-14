import { CheckCircle, Favorite } from "@mui/icons-material";
import { IconButton, Stack } from "@mui/material";
import parse from 'html-react-parser';
import Image from 'next/image';
import { FC, useCallback, useEffect, useMemo, useRef, useState, forwardRef } from "react";
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
  onMediaClick: (url: string, type: 'image' | 'video') => void
}>(({ item, onMediaClick }, ref) => {
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

  const titleElement = (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      flexWrap: 'wrap',
    }}>
      <IconButton
        size="small"
        onClick={(e) => { e.stopPropagation(); handleToggleRead(); }}
        sx={{
          background: isRead ? 'var(--accent-color)' : 'var(--hover-bg)',
          '&:hover': { background: 'var(--accent-hover)' },
        }}
      >
        <CheckCircle sx={{ color: isRead ? 'var(--accent-solid)' : 'var(--text-secondary)' }} />
      </IconButton>
      <IconButton
        size="small"
        onClick={(e) => { e.stopPropagation(); handleToggleFavorite(); }}
        sx={{
          background: isFavorite ? 'rgba(244, 67, 54, 0.2)' : 'var(--hover-bg)',
          '&:hover': { background: 'rgba(244, 67, 54, 0.3)' },
        }}
      >
        <Favorite sx={{ color: isFavorite ? '#f44336' : 'var(--text-secondary)' }} />
      </IconButton>
      <h3 style={{
        margin: 0,
        flexGrow: 1,
        fontSize: '1rem',
        fontWeight: 600,
        color: 'var(--text-primary)',
        lineHeight: 1.4,
      }}>
        {item.title}
      </h3>
    </div>
  );

  return (
    <div
      ref={ref}
      key={item.id}
      className="glass-card"
      style={{
        padding: '16px',
        cursor: 'pointer',
        marginBottom: viewMode === 'board' ? '12px' : '0',
      }}
      onClick={() => setCollapsed(!collapsed)}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
        {titleElement}
        <a
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{
            padding: '6px 12px',
            background: 'var(--button-gradient)',
            borderRadius: '6px',
            color: '#fff',
            fontSize: '0.75rem',
            fontWeight: 500,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
            transition: 'all 0.2s ease',
          }}
        >
          Read more
        </a>
      </Stack>
      {(viewMode === 'feed' || !collapsed) && (
        <div style={{
          marginTop: '12px',
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
          overflow: 'hidden',
        }}>
          {description}
        </div>
      )}
    </div>
  )
});
