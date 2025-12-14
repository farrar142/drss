import { FC, useState, useCallback, useMemo } from "react";
import { RSSCategory, RSSFeed, RSSItem } from "../types/rss";
import { useRSSStore } from "../stores/rssStore";
import { Stack, Modal, Box } from "@mui/material";
import parse from 'html-react-parser';

export const FeedItemViewer: FC<{
  items: RSSItem[]
}> = ({ items }) => {
  const { viewMode } = useRSSStore()
  const [modalOpen, setModalOpen] = useState(false);
  const [modalImage, setModalImage] = useState<string>('');

  const handleImageClick = useCallback((src: string) => {
    setModalImage(src);
    setModalOpen(true);
  }, []);

  return (
    <>
      <Stack>
        {items.map(item => <FeedItemRenderer key={item.id} item={item} onImageClick={handleImageClick} />)}
      </Stack>
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
            style={{ display: 'block', margin: '0 auto' }}
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
  return (
    <div
      key={item.id}
      style={{ padding: '8px', borderBottom: '1px solid #ccc' }}>
      <h3>{item.title}</h3>
      <div>{description}</div>
      <a href={item.link} target="_blank" rel="noopener noreferrer">Read more</a>
    </div>
  )
}
