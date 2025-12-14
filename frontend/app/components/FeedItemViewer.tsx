import { FC, useState, useCallback, useMemo, useRef, useEffect } from "react";
import { RSSItem } from "../types/rss";
import { useRSSStore } from "../stores/rssStore";
import { Stack, Modal, Box, IconButton, Button, Grid, useTheme, useMediaQuery } from "@mui/material";
import { FeedItemRenderer } from "./FeedItemRenderer";

export const FeedItemViewer: FC<{
  items: RSSItem[],
  onLoadMore?: () => void,
  hasNext?: boolean
}> = ({ items, onLoadMore, hasNext }) => {
  const { viewMode } = useRSSStore();
  const theme = useTheme();
  const isMd = useMediaQuery(theme.breakpoints.down("md"));
  const isXl = useMediaQuery(theme.breakpoints.up("xl"));

  let columns = 1;
  if (isXl) columns = 3;
  else if (!isMd) columns = 2;

  const chunk = (arr: RSSItem[], size: number) =>
    arr.reduce((acc, _, i) => {
      const index = i % size;
      if (!acc[index]) {
        acc[index] = [];
      }
      acc[index].push(arr[i]);
      return acc;
    },
      [] as RSSItem[][]);

  const chunkedItems = useMemo(() => chunk(items, columns), [items, columns]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalImage, setModalImage] = useState<string>('');
  const lastItemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!onLoadMore || !hasNext) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      { threshold: 1.0 }
    );

    if (lastItemRef.current) {
      observer.observe(lastItemRef.current);
    }

    return () => observer.disconnect();
  }, [onLoadMore, hasNext, items.length]); // items.length를 추가해서 아이템이 추가될 때마다 재설정


  const handleImageClick = useCallback((src: string) => {
    setModalImage(src);
    setModalOpen(true);
  }, []);

  return (
    <>
      <Grid container width="100%">
        {viewMode === 'board' ? <Stack>{items.map((item, index) => (
          <FeedItemRenderer key={item.id} item={item} onImageClick={handleImageClick} ref={index === items.length - 1 ? lastItemRef : null} />
        ))}</Stack> : chunkedItems.map((row, rowIndex) => (
          <Grid key={rowIndex} spacing={2} size={12 / columns}>
            {row.map((item, itemIndex) => (
              <Stack key={item.id} >
                <FeedItemRenderer item={item} onImageClick={handleImageClick} ref={rowIndex === chunkedItems.length - 1 && itemIndex === row.length - 1 ? lastItemRef : null} />
              </Stack>
            ))}

            <div ref={lastItemRef}></div>
          </Grid>
        ))}
      </Grid>
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Box sx={{ maxWidth: '90%', maxHeight: '90%' }}>
          <img src={modalImage} alt="Enlarged" style={{ maxWidth: '100%', maxHeight: '100%' }} />
        </Box>
      </Modal>
    </>
  );
}
