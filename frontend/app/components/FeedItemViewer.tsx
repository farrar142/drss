import { FC, useState, useCallback, useMemo } from "react";
import { RSSCategory, RSSFeed, RSSItem } from "../types/rss";
import { useRSSStore } from "../stores/rssStore";
import { Stack, Modal, Box, IconButton, Button, Grid, useTheme, useMediaQuery } from "@mui/material";
import { CheckCircle, Favorite, ExpandMore, ExpandLess } from "@mui/icons-material";
import parse from 'html-react-parser';
import { feedsRouterToggleItemFavorite, feedsRouterToggleItemRead } from "../services/api";

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
    arr.reduce((acc, _, i) => (i % size ? acc : [...acc, arr.slice(i, i + size)]), [] as RSSItem[][]);

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
          <Grid container key={rowIndex} spacing={2}>
            {row.map(item => (
              <Grid key={item.id} size={12 / columns}>
                <FeedItemRenderer item={item} onImageClick={handleImageClick} />
              </Grid>
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

const renderDescription = (description: string, onImageClick: (url: string) => void) => {
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
    }
  });
}

const FeedItemRenderer: FC<{
  item: RSSItem,
  onImageClick: (url: string) => void
}> = ({ item, onImageClick }) => {
  const description = useMemo(() => renderDescription(item.description, onImageClick), [item.description]);
  const { viewMode } = useRSSStore()
  const [collapsed, setCollapsed] = useState(true);
  const [isRead, setIsRead] = useState(item.is_read);
  const [isFavorite, setIsFavorite] = useState(item.is_favorite);
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
