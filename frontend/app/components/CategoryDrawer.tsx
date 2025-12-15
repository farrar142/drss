'use client';

import { FC, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Rss, Plus, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { RSSCategory, RSSFeed } from '../types/rss';
import { useRSSStore } from '../stores/rssStore';
import { CategoryItem } from './CategoryItem';
import {
  feedsRoutersCategoryCreateCategory,
  feedsRoutersCategoryDeleteCategory,
  feedsRoutersCategoryListCategories,
  feedsRoutersFeedListFeeds,
  FeedSchema,
} from '../services/api';

export const DRAWER_WIDTH = 240;

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
  const [draggingFeed, setDraggingFeed] = useState<FeedSchema | null>(null);

  useEffect(() => {
    feedsRoutersFeedListFeeds().then(setFeeds);
  }, [setFeeds]);

  useEffect(() => {
    // The backend OpenAPI/types may not always include the `visible` field
    // (older specs). Ensure we normalize the response to `RSSCategory` by
    // defaulting `visible` to `true` when absent.
    feedsRoutersCategoryListCategories().then((cats) =>
      setCategories((cats || []).map((c: any) => ({ ...c, visible: (c.visible ?? true) })))
    );
  }, [setCategories]);

  const handleAddCategory = async () => {
    try {
      const newCategory = await feedsRoutersCategoryCreateCategory({
        name: newCategoryName,
        description: newCategoryDescription,
      });
      // Ensure `visible` exists (older API specs may omit it)
      addCategory({ ...(newCategory as any), visible: (newCategory as any).visible ?? true });
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
  };

  // Move Drawer content into a stable component to avoid creating it during each render


  type DrawerContentProps = {
    pathname: string;
    categories: RSSCategory[];
    feeds: RSSFeed[];
    onNavigateHome: () => void;
    onOpenAdd: () => void;
    onDeleteCategory: (category: RSSCategory) => Promise<void>;
    draggingFeed: FeedSchema | null;
    onDragStart: (feed: FeedSchema) => void;
    onDragEnd: () => void;
  };

  const DrawerContent = ({ pathname, categories, feeds, onNavigateHome, onOpenAdd, onDeleteCategory, draggingFeed, onDragStart, onDragEnd }: DrawerContentProps) => {
    return (
      <div className="flex h-full flex-col">
        <ScrollArea className="flex-1 py-2">
          {/* Main Stream */}
          <div className="px-2">
            <button
              onClick={onNavigateHome}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                pathname === '/home' && 'bg-sidebar-primary text-sidebar-primary-foreground'
              )}
            >
              <Rss className="h-4 w-4" />
              <span className="font-medium">메인 스트림</span>
            </button>
          </div>

          {/* Categories */}
          <div className="mt-2 space-y-1">
            {categories.map((category) => (
              <CategoryItem
                feeds={feeds}
                category={category}
                pathname={pathname}
                key={category.id}
                deleteCategory={onDeleteCategory}
                draggingFeed={draggingFeed}
                onFeedMoved={() => onDragEnd()}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
              />
            ))}
          </div>
        </ScrollArea>

        {/* Add Category Button */}
        <div className="border-t border-sidebar-border p-3">
          <Button
            onClick={onOpenAdd}
            className="w-full"
            size="sm"
          >
            <Plus className="mr-2 h-4 w-4" />
            카테고리 추가
          </Button>
        </div>
      </div>
    );
  };
  // Temporary (mobile) drawer
  if (variant === 'temporary') {
    return (
      <>
        <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
          <SheetContent side="left" className="w-[240px] p-0 pt-14" onClose={onClose}>
            <DrawerContent
              pathname={pathname}
              categories={categories}
              feeds={feeds}
              onNavigateHome={() => router.push('/home')}
              onOpenAdd={() => setAddCategoryOpen(true)}
              onDeleteCategory={handleDeleteCategory}
              draggingFeed={draggingFeed}
              onDragStart={setDraggingFeed}
              onDragEnd={() => setDraggingFeed(null)}
            />
          </SheetContent>
        </Sheet>

        {/* Add Category Dialog */}
        <Dialog open={addCategoryOpen} onOpenChange={setAddCategoryOpen}>
          <DialogContent onClose={() => setAddCategoryOpen(false)}>
            <DialogHeader>
              <DialogTitle>카테고리 추가</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">이름</Label>
                <Input
                  id="name"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="카테고리 이름"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">설명</Label>
                <Input
                  id="description"
                  value={newCategoryDescription}
                  onChange={(e) => setNewCategoryDescription(e.target.value)}
                  placeholder="카테고리 설명"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddCategoryOpen(false)}>
                취소
              </Button>
              <Button onClick={handleAddCategory}>추가</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Persistent drawer
  return (
    <>
      <aside
        className={cn(
          'fixed left-0 top-14 z-40 h-[calc(100vh-3.5rem)] border-r border-sidebar-border bg-sidebar-background transition-transform duration-300',
          !open && '-translate-x-full'
        )}
        style={{ width: DRAWER_WIDTH }}
      >
        <DrawerContent
          pathname={pathname}
          categories={categories}
          feeds={feeds}
          onNavigateHome={() => router.push('/home')}
          onOpenAdd={() => setAddCategoryOpen(true)}
          onDeleteCategory={handleDeleteCategory}
          draggingFeed={draggingFeed}
          onDragStart={setDraggingFeed}
          onDragEnd={() => setDraggingFeed(null)}
        />
      </aside>

      {/* Add Category Dialog */}
      <Dialog open={addCategoryOpen} onOpenChange={setAddCategoryOpen}>
        <DialogContent onClose={() => setAddCategoryOpen(false)}>
          <DialogHeader>
            <DialogTitle>카테고리 추가</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">이름</Label>
              <Input
                id="name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="카테고리 이름"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">설명</Label>
              <Input
                id="description"
                value={newCategoryDescription}
                onChange={(e) => setNewCategoryDescription(e.target.value)}
                placeholder="카테고리 설명"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddCategoryOpen(false)}>
              취소
            </Button>
            <Button onClick={handleAddCategory}>추가</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
