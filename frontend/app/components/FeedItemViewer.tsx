import { FC, useState, useCallback, useMemo, useEffect, useRef } from "react";
import { RSSCategory, RSSFeed, RSSItem } from "../types/rss";
import { useRSSStore } from "../stores/rssStore";
import { Stack, Modal, Box, IconButton, Button, Grid, useTheme, useMediaQuery } from "@mui/material";
import { CheckCircle, Favorite, ExpandMore, ExpandLess } from "@mui/icons-material";
import parse from 'html-react-parser';
import { feedsRouterToggleItemFavorite, feedsRouterToggleItemRead } from "../services/api";
import { FeedItemRenderer } from "./FeedItemRenderer";

export const FeedItemViewer: FC<{
  items: RSSItem[]
}> = ({ items }) => {
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

  const handleImageClick = useCallback((src: string) => {
    setModalImage(src);
    setModalOpen(true);
  }, []);

  return (
    <>
      <Grid container width="100%">
        {viewMode === 'board' ? <Stack>{items.map(item => (
          <FeedItemRenderer key={item.id} item={item} onImageClick={handleImageClick} />
        ))}</Stack> : chunkedItems.map((row, rowIndex) => (
          <Grid key={rowIndex} spacing={2} size={12 / columns}>
            {row.map(item => (
              <Stack key={item.id} >
                <FeedItemRenderer item={item} onImageClick={handleImageClick} />
              </Stack>
            ))}
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
