import { FC, useState, useCallback, useMemo, useRef, useEffect } from "react";
import { RSSItem } from "../types/rss";
import { useRSSStore } from "../stores/rssStore";
import { Stack, Modal, Box, Button, Grid, useTheme, useMediaQuery } from "@mui/material";
import { FeedItemRenderer } from "./FeedItemRenderer";

// Masonry layout hook - distributes items into columns in sequential groups
// Items are processed in groups of `columns` size, maintaining reading order
const useMasonryLayout = (items: RSSItem[], columns: number) => {
  const [itemHeights, setItemHeights] = useState<Map<number, number>>(new Map());
  const heightsRef = useRef<Map<number, number>>(new Map());
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingUpdatesRef = useRef<Map<number, number>>(new Map());

  // Register height for an item - debounced and only updates if significantly different
  const registerHeight = useCallback((itemId: number, height: number) => {
    const currentHeight = heightsRef.current.get(itemId) || 0;

    // Only update if height changed by more than 20px (avoid micro-adjustments)
    if (Math.abs(currentHeight - height) > 20) {
      pendingUpdatesRef.current.set(itemId, height);

      // Debounce updates to batch them together
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }

      updateTimeoutRef.current = setTimeout(() => {
        if (pendingUpdatesRef.current.size > 0) {
          setItemHeights(prev => {
            const newMap = new Map(prev);
            pendingUpdatesRef.current.forEach((h, id) => {
              newMap.set(id, h);
              heightsRef.current.set(id, h);
            });
            pendingUpdatesRef.current.clear();
            return newMap;
          });
        }
      }, 300); // Wait 300ms before applying updates
    }
  }, []);

  // Calculate which column each item should go into
  // Process items in groups of `columns`, within each group place in shortest column
  const columnItems = useMemo(() => {
    const result: RSSItem[][] = Array.from({ length: columns }, () => []);
    const columnHeights = Array(columns).fill(0);

    // Process items in groups of `columns` size
    for (let i = 0; i < items.length; i += columns) {
      const group = items.slice(i, i + columns);

      // Sort group items by their heights (largest first) for better distribution
      const sortedGroup = [...group].sort((a, b) => {
        const heightA = itemHeights.get(a.id) || 300;
        const heightB = itemHeights.get(b.id) || 300;
        return heightB - heightA; // Largest first
      });

      // Assign each item in the group to the shortest column
      sortedGroup.forEach(item => {
        const shortestColumnIndex = columnHeights.indexOf(Math.min(...columnHeights));
        result[shortestColumnIndex].push(item);

        const itemHeight = itemHeights.get(item.id) || 300;
        columnHeights[shortestColumnIndex] += itemHeight;
      });
    }

    return result;
  }, [items, columns, itemHeights]);

  return { columnItems, registerHeight };
};

// Wrapper component to measure item height
const MeasuredItem: FC<{
  item: RSSItem;
  onMediaClick: (src: string, type: 'image' | 'video') => void;
  onHeightChange: (id: number, height: number) => void;
}> = ({ item, onMediaClick, onHeightChange }) => {
  const ref = useRef<HTMLDivElement>(null);
  const lastHeightRef = useRef<number>(0);

  useEffect(() => {
    if (!ref.current) return;

    const measureHeight = () => {
      if (ref.current) {
        const height = ref.current.offsetHeight;
        // Only report if height changed significantly
        if (Math.abs(lastHeightRef.current - height) > 10) {
          lastHeightRef.current = height;
          onHeightChange(item.id, height);
        }
      }
    };

    // Initial measurement after a short delay to let content render
    const initialTimeout = setTimeout(measureHeight, 100);

    // Re-measure when images load
    const images = ref.current.querySelectorAll('img');
    const imageLoadHandler = () => {
      setTimeout(measureHeight, 50);
    };

    images.forEach(img => {
      if (!img.complete) {
        img.addEventListener('load', imageLoadHandler);
        img.addEventListener('error', imageLoadHandler);
      }
    });

    // One final measurement after all images should be loaded
    const finalTimeout = setTimeout(measureHeight, 1000);

    return () => {
      clearTimeout(initialTimeout);
      clearTimeout(finalTimeout);
      images.forEach(img => {
        img.removeEventListener('load', imageLoadHandler);
        img.removeEventListener('error', imageLoadHandler);
      });
    };
  }, [item.id, onHeightChange]);

  return (
    <div ref={ref}>
      <FeedItemRenderer item={item} onMediaClick={onMediaClick} />
    </div>
  );
};

export const FeedItemViewer: FC<{
  items: RSSItem[],
  onLoadMore?: () => void,
  onLoadNew?: () => void,
  hasNext?: boolean,
  loading?: boolean
}> = ({ items, onLoadMore, onLoadNew, hasNext, loading }) => {
  const { viewMode } = useRSSStore();
  const theme = useTheme();
  const isMd = useMediaQuery(theme.breakpoints.down("md"));
  const isXl = useMediaQuery(theme.breakpoints.up("xl"));

  let columns = 1;
  if (isXl) columns = 3;
  else if (!isMd) columns = 2;

  const { columnItems, registerHeight } = useMasonryLayout(items, columns);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMedia, setModalMedia] = useState<{ type: 'image' | 'video'; src: string } | null>(null);

  // Multiple sentinel refs for each column
  const sentinelRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Use ref to always have access to latest callback
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;

  // Callback ref setter for sentinel elements
  const setSentinelRef = useCallback((index: number) => (el: HTMLDivElement | null) => {
    sentinelRefs.current[index] = el;
  }, []);

  useEffect(() => {
    if (!hasNext || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // If any sentinel is intersecting, load more
        const isAnyIntersecting = entries.some(entry => entry.isIntersecting);
        if (isAnyIntersecting && onLoadMoreRef.current) {
          onLoadMoreRef.current();
          console.log("Loading more items...");
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    // Observe all sentinel elements
    sentinelRefs.current.forEach(ref => {
      if (ref) {
        observer.observe(ref);
      }
    });

    return () => observer.disconnect();
  }, [hasNext, loading, columns]);

  const handleMediaClick = useCallback((src: string, type: 'image' | 'video' = 'image') => {
    setModalMedia({ type, src });
    setModalOpen(true);
  }, []);

  return (
    <>
      <Grid container width="100%">
        <Grid size={12}>
          <Button onClick={onLoadNew}>
            새글불러오기
          </Button>
        </Grid>
        {viewMode === 'board' ? (
          <Stack width="100%">
            {items.map((item) => (
              <FeedItemRenderer key={item.id} item={item} onMediaClick={handleMediaClick} />
            ))}
            {/* Sentinel element for board mode */}
            {hasNext && (
              <div
                ref={setSentinelRef(0)}
                style={{ height: "1px", width: "100%" }}
              />
            )}
          </Stack>
        ) : (
          columnItems.map((columnData, columnIndex) => (
            <Grid key={columnIndex} size={12 / columns}>
              <Stack spacing={2}>
                {columnData.map((item) => (
                  <MeasuredItem
                    key={item.id}
                    item={item}
                    onMediaClick={handleMediaClick}
                    onHeightChange={registerHeight}
                  />
                ))}
                {/* Sentinel element at the end of each column */}
                {hasNext && (
                  <div
                    ref={setSentinelRef(columnIndex)}
                    style={{ height: "1px", width: "100%" }}
                  />
                )}
              </Stack>
            </Grid>
          ))
        )}
      </Grid>
      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setModalMedia(null);
        }}
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Box 
          sx={{ 
            width: '90vw', 
            height: '90vh', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            outline: 'none'
          }}
          onClick={() => {
            setModalOpen(false);
            setModalMedia(null);
          }}
        >
          {modalMedia?.type === 'video' ? (
            <video
              src={modalMedia.src}
              controls
              autoPlay
              style={{ 
                maxWidth: '100%', 
                maxHeight: '100%',
                objectFit: 'contain'
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : modalMedia?.type === 'image' ? (
            <img 
              src={modalMedia.src} 
              alt="Enlarged" 
              style={{ 
                maxWidth: '100%', 
                maxHeight: '100%',
                objectFit: 'contain'
              }} 
            />
          ) : null}
        </Box>
      </Modal>
    </>
  );
}
