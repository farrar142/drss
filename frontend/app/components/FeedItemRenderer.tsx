import { CheckCircle, Favorite } from "@mui/icons-material";
import { IconButton, Stack } from "@mui/material";
import parse from 'html-react-parser';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { feedsRouterToggleItemFavorite, feedsRouterToggleItemRead } from "../services/api";
import { useRSSStore } from "../stores/rssStore";
import { RSSItem } from "../types/rss";

const renderDescription = (description: string, onImageClick: (url: string) => void, onVideoMount: (video: HTMLVideoElement) => void) => {
  return parse(description, {
    replace: (domNode: any) => {
      if (domNode.attribs && domNode.attribs.class) {
        domNode.attribs.className = domNode.attribs.class;
        delete domNode.attribs.class;
      }
      if (domNode.name === 'img') {
        return (
          <img
            {...domNode.attribs}
            onClick={() => onImageClick(domNode.attribs.src)}
            style={{ display: 'block', margin: '0 auto', maxWidth: '100%', height: 'auto' }}
          />
        );
      }
      if (domNode.name === 'video') {
        return (
          <video
            {...domNode.attribs}
            muted
            loop
            style={{ display: 'block', margin: '0 auto', maxWidth: '100%', height: 'auto' }}
            controls
            ref={(el) => el && onVideoMount(el)}
          />
        );
      }
    }
  });
}

export const FeedItemRenderer: FC<{
  item: RSSItem,
  onImageClick: (url: string) => void
}> = ({ item, onImageClick }) => {
  const { viewMode } = useRSSStore()
  const [collapsed, setCollapsed] = useState(true);
  const [isRead, setIsRead] = useState(item.is_read);
  const [isFavorite, setIsFavorite] = useState(item.is_favorite);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const onVideoMount = useCallback((video: HTMLVideoElement) => {
    observerRef.current?.observe(video);
  }, []);

  const description = useMemo(() => renderDescription(item.description, onImageClick, onVideoMount), [item.description, onImageClick, onVideoMount]);

  useEffect(() => {
    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const video = entry.target as HTMLVideoElement;
        if (entry.isIntersecting) {
          video.play().catch(() => { });
        } else {
          video.pause();
        }
      });
    });
    return () => observerRef.current?.disconnect();
  }, []);

  const handleToggleFavorite = useCallback(async () => {
    try {
      await feedsRouterToggleItemFavorite(item.id);
      setIsFavorite(!isFavorite);
    } catch (error) {
      console.error(error);
    }
  }, [item.id, isFavorite]);

  const handleToggleRead = useCallback(async () => {
    try {
      await feedsRouterToggleItemRead(item.id);
      setIsRead(!isRead);
    } catch (error) {
      console.error(error);
    }
  }, [item.id, isRead]);

  const titleElement = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <IconButton size="small" onClick={handleToggleRead}>
        <CheckCircle color={isRead ? 'primary' : 'disabled'} />
      </IconButton>
      <IconButton size="small" onClick={handleToggleFavorite}>
        <Favorite color={isFavorite ? 'error' : 'disabled'} />
      </IconButton>
      <h3 style={{ margin: 0, flexGrow: 1 }}>{item.title}</h3>
    </div>
  );

  return (
    <div
      key={item.id}
      style={{ padding: '8px', borderBottom: '1px solid #ccc' }}
      onClick={() => setCollapsed(!collapsed)}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        {titleElement}
        <a href={item.link} target="_blank" rel="noopener noreferrer">Read more</a>
      </Stack>
      {(viewMode === 'feed' || !collapsed) && (
        <div>{description}</div>
      )}
    </div>
  )
}
