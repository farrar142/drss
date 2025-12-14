import { Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Box, Button, Dialog, DialogTitle, DialogContent, TextField, DialogActions } from "@mui/material";

import {
  Add as AddIcon,
  Category as CategoryIcon,
  RssFeed as RssFeedIcon,
} from '@mui/icons-material';
import { FC, useState, useEffect } from "react";
import { RSSCategory, RSSFeed } from "../types/rss";
import { useRouter } from "next/navigation";
import { useRSSStore } from "../stores/rssStore";
import { CategoryItem } from "./CategoryItem";
import { feedsRoutersCategoryCreateCategory, feedsRoutersCategoryDeleteCategory, feedsRoutersCategoryListCategories, feedsRoutersFeedListFeeds } from "../services/api";

const DRAWER_WIDTH = 240;

export { DRAWER_WIDTH };

export const CategoryDrawer: FC<{
  open: boolean;
  pathname: string;
  variant?: 'permanent' | 'persistent' | 'temporary';
  onClose: () => void;
}> = ({ open, pathname, variant = 'permanent', onClose }) => {
  const router = useRouter();
  const { categories, setCategories, addCategory, removeCategory, feeds, setFeeds } = useRSSStore();
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  useEffect(() => {
    feedsRoutersFeedListFeeds().then(setFeeds)
  }, [setFeeds])

  useEffect(() => {
    feedsRoutersCategoryListCategories().then(setCategories)
  }, [setCategories])

  const handleAddCategory = async () => {
    try {
      const newCategory = await feedsRoutersCategoryCreateCategory({ name: newCategoryName, description: newCategoryDescription });
      addCategory(newCategory);
      setAddCategoryOpen(false);
      setNewCategoryName('');
      setNewCategoryDescription('');
    } catch (error) {
      console.error(error);
    }
  };
  const handleDeleteCategory = async (category: RSSCategory) => {
    try {
      await feedsRoutersCategoryDeleteCategory(category.id);
      removeCategory(category.id);
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <>
      <Drawer
        anchor="left"
        open={open}
        variant={variant}
        onClose={onClose}
        sx={{
          width: variant === 'persistent' && open ? DRAWER_WIDTH : 0,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            top: '64px', // AppBar 높이만큼 offset
            height: 'calc(100% - 64px)',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
          <List>
            <ListItem disablePadding>
              <ListItemButton selected={pathname === '/home'} onClick={() => router.push('/home')}>
                <ListItemIcon><RssFeedIcon /></ListItemIcon>
                <ListItemText primary="메인 스트림" />
              </ListItemButton>
            </ListItem>
          </List>
          {categories.map(category => (
            <CategoryItem
              feeds={feeds}
              category={category}
              pathname={pathname}
              key={category.id}
              deleteCategory={handleDeleteCategory}
            />
          ))}
        </Box>
        <Box sx={{ p: 2 }}>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddCategoryOpen(true)} fullWidth>
            카테고리 추가
          </Button>
        </Box>
      </Drawer>
      <Dialog open={addCategoryOpen} onClose={() => setAddCategoryOpen(false)}>
        <DialogTitle>카테고리 추가</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="이름"
            fullWidth
            variant="standard"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
          />
          <TextField
            margin="dense"
            label="설명"
            fullWidth
            variant="standard"
            value={newCategoryDescription}
            onChange={(e) => setNewCategoryDescription(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddCategoryOpen(false)}>취소</Button>
          <Button onClick={handleAddCategory}>추가</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
