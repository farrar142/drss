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
            top: '64px',
            height: 'calc(100% - 64px)',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderRight: '1px solid var(--border-color)',
            boxShadow: '4px 0 24px var(--shadow-color)',
          },
        }}
      >
        <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
          <List>
            <ListItem disablePadding>
              <ListItemButton
                selected={pathname === '/home'}
                onClick={() => router.push('/home')}
                sx={{
                  mx: 1,
                  my: 0.5,
                  borderRadius: 2,
                  '&.Mui-selected': {
                    background: 'var(--accent-color)',
                    '&:hover': {
                      background: 'var(--accent-hover)',
                    },
                  },
                  '&:hover': {
                    background: 'var(--hover-bg)',
                  },
                }}
              >
                <ListItemIcon sx={{ color: 'var(--text-primary)', minWidth: 40 }}>
                  <RssFeedIcon />
                </ListItemIcon>
                <ListItemText
                  primary="메인 스트림"
                  primaryTypographyProps={{
                    fontWeight: pathname === '/home' ? 600 : 400,
                    color: 'var(--text-primary)',
                  }}
                />
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
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setAddCategoryOpen(true)}
            fullWidth
            sx={{
              background: 'var(--button-gradient)',
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              boxShadow: '0 4px 15px var(--shadow-color)',
              '&:hover': {
                background: 'var(--button-gradient-hover)',
                boxShadow: '0 6px 20px var(--shadow-color)',
              },
            }}
          >
            카테고리 추가
          </Button>
        </Box>
      </Drawer>
      <Dialog
        open={addCategoryOpen}
        onClose={() => setAddCategoryOpen(false)}
        PaperProps={{
          sx: {
            background: 'var(--dialog-bg)',
            backdropFilter: 'blur(20px)',
            border: '1px solid var(--border-color)',
            borderRadius: 3,
            boxShadow: '0 8px 32px var(--shadow-color)',
          },
        }}
      >
        <DialogTitle sx={{ color: 'var(--text-primary)', fontWeight: 600 }}>카테고리 추가</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="이름"
            fullWidth
            variant="outlined"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            sx={{
              '& .MuiOutlinedInput-root': {
                color: 'var(--text-primary)',
                '& fieldset': { borderColor: 'var(--border-color)' },
                '&:hover fieldset': { borderColor: 'var(--text-secondary)' },
                '&.Mui-focused fieldset': { borderColor: 'var(--accent-solid)' },
              },
              '& .MuiInputLabel-root': { color: 'var(--text-secondary)' },
            }}
          />
          <TextField
            margin="dense"
            label="설명"
            fullWidth
            variant="outlined"
            value={newCategoryDescription}
            onChange={(e) => setNewCategoryDescription(e.target.value)}
            sx={{
              mt: 2,
              '& .MuiOutlinedInput-root': {
                color: 'var(--text-primary)',
                '& fieldset': { borderColor: 'var(--border-color)' },
                '&:hover fieldset': { borderColor: 'var(--text-secondary)' },
                '&.Mui-focused fieldset': { borderColor: 'var(--accent-solid)' },
              },
              '& .MuiInputLabel-root': { color: 'var(--text-secondary)' },
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setAddCategoryOpen(false)}
            sx={{ color: 'var(--text-secondary)' }}
          >
            취소
          </Button>
          <Button
            onClick={handleAddCategory}
            variant="contained"
            sx={{
              background: 'var(--button-gradient)',
              '&:hover': {
                background: 'var(--button-gradient-hover)',
              },
            }}
          >
            추가
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
