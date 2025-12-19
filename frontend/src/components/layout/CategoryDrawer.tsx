'use client';

import { FC, useState, useEffect, useCallback, memo } from 'react';
import { useRouter } from 'next/navigation';
import { Rss, Plus, GripVertical } from 'lucide-react';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { ScrollArea } from '@/ui/scroll-area';
import { Sheet, SheetContent } from '@/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/ui/dialog';
import { cn } from '@/lib/utils';
import { RSSCategory, RSSFeed } from '@/types/rss';
import { useRSSStore } from '@/stores/rssStore';
import { useTranslation } from '@/stores/languageStore';
import { useTabStore } from '@/stores/tabStore';
import { CategoryItem } from './CategoryItem';
import {
  createCategory,
  deleteCategory,
  listCategories,
  reorderCategories,
  listFeeds,
  FeedSchema,
} from '@/services/api';

export const DRAWER_WIDTH = 240;

// DrawerContent를 외부 컴포넌트로 분리하여 리렌더 시 상태 초기화 방지
type DrawerContentProps = {
  pathname: string;
  categories: RSSCategory[];
  feeds: RSSFeed[];
  onNavigateHome: () => void;
  onNavigateCategory: (category: RSSCategory) => void;
  onNavigateFeed: (categoryId: number, feedId: number, feedTitle: string, faviconUrl?: string) => void;
  onOpenAdd: () => void;
  onDeleteCategory: (category: RSSCategory) => Promise<void>;
  draggingFeed: FeedSchema | null;
  onDragStart: (feed: FeedSchema) => void;
  onDragEnd: () => void;
  onReorderCategories: (categories: RSSCategory[]) => void;
  onCloseDrawer?: () => void;  // 드로워 닫기 콜백
  t: ReturnType<typeof useTranslation>['t'];
};

const DrawerContent = memo(({
  pathname,
  categories,
  feeds,
  onNavigateHome,
  onNavigateCategory,
  onNavigateFeed,
  onOpenAdd,
  onDeleteCategory,
  draggingFeed,
  onDragStart,
  onDragEnd,
  onReorderCategories,
  onCloseDrawer,
  t
}: DrawerContentProps) => {
  const [draggingCategoryId, setDraggingCategoryId] = useState<number | null>(null);
  const [dragOverCategoryId, setDragOverCategoryId] = useState<number | null>(null);

  const handleCategoryDragStart = useCallback((e: React.DragEvent, category: RSSCategory) => {
    e.dataTransfer.setData('application/category-reorder', JSON.stringify({
      categoryId: category.id,
      categoryName: category.name,
    }));
    e.dataTransfer.effectAllowed = 'move';
    setDraggingCategoryId(category.id);
  }, []);

  const handleCategoryDragOver = useCallback((e: React.DragEvent, category: RSSCategory) => {
    // 카테고리 재정렬인 경우에만 처리
    if (!e.dataTransfer.types.includes('application/category-reorder')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCategoryId(category.id);
  }, []);

  const handleCategoryDragLeave = useCallback((e: React.DragEvent) => {
    // 자식 요소로 이동할 때는 무시
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDragOverCategoryId(null);
  }, []);

  const handleCategoryDrop = useCallback((e: React.DragEvent, targetCategory: RSSCategory) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverCategoryId(null);
    setDraggingCategoryId(null);

    try {
      const data = JSON.parse(e.dataTransfer.getData('application/category-reorder'));
      const { categoryId } = data;

      if (categoryId === targetCategory.id) return;

      // 카테고리 순서 재배열
      const draggedIndex = categories.findIndex(c => c.id === categoryId);
      const targetIndex = categories.findIndex(c => c.id === targetCategory.id);

      if (draggedIndex === -1 || targetIndex === -1) return;

      const newCategories = [...categories];
      const [draggedCategory] = newCategories.splice(draggedIndex, 1);
      newCategories.splice(targetIndex, 0, draggedCategory);

      // order 값 업데이트
      const reorderedCategories = newCategories.map((cat, idx) => ({ ...cat, order: idx }));
      onReorderCategories(reorderedCategories);
    } catch (error) {
      console.error('Failed to reorder categories:', error);
    }
  }, [categories, onReorderCategories]);

  const handleCategoryDragEnd = useCallback(() => {
    setDraggingCategoryId(null);
    setDragOverCategoryId(null);
  }, []);

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
            <span className="font-medium">{t.nav.home}</span>
          </button>
        </div>

        {/* Categories */}
        <div className="mt-2 space-y-1">
          {categories.map((category) => (
            <div
              key={category.id}
              draggable
              onDragStart={(e) => handleCategoryDragStart(e, category)}
              onDragOver={(e) => handleCategoryDragOver(e, category)}
              onDragLeave={handleCategoryDragLeave}
              onDrop={(e) => handleCategoryDrop(e, category)}
              onDragEnd={handleCategoryDragEnd}
              className={cn(
                'transition-all duration-150',
                draggingCategoryId === category.id && 'opacity-50',
                dragOverCategoryId === category.id && draggingCategoryId !== category.id && 'border-t-2 border-primary'
              )}
            >
              <CategoryItem
                feeds={feeds}
                category={category}
                pathname={pathname}
                deleteCategory={onDeleteCategory}
                draggingFeed={draggingFeed}
                onFeedMoved={() => onDragEnd()}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onNavigateCategory={onNavigateCategory}
                onNavigateFeed={onNavigateFeed}
                onCloseDrawer={onCloseDrawer}
              />
            </div>
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
          {t.category.add}
        </Button>
      </div>
    </div>
  );
});

DrawerContent.displayName = 'DrawerContent';

export const CategoryDrawer: FC<{
  open: boolean;
  pathname: string;
  variant?: 'permanent' | 'persistent' | 'temporary';
  onClose: () => void;
}> = ({ open, pathname, variant = 'permanent', onClose }) => {
  const router = useRouter();
  const { t } = useTranslation();
  const { categories, setCategories, addCategory, removeCategory, feeds, setFeeds } = useRSSStore();
  const { openTab, activeTabId, saveScrollPosition } = useTabStore();
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  const [draggingFeed, setDraggingFeed] = useState<FeedSchema | null>(null);

  // 현재 탭의 스크롤 위치 저장 헬퍼
  const saveCurrentScroll = useCallback(() => {
    if (activeTabId) {
      saveScrollPosition(activeTabId, window.scrollY);
    }
  }, [activeTabId, saveScrollPosition]);

  // 탭으로 네비게이션하는 핸들러들
  const handleNavigateHome = useCallback(() => {
    saveCurrentScroll();
    openTab({ type: 'home', title: '메인스트림', path: '/home' });
    // 플로팅 모드(temporary)일 때 드로워 닫기
    if (variant === 'temporary') {
      onClose();
    }
  }, [openTab, saveCurrentScroll, variant, onClose]);

  const handleNavigateCategory = useCallback((category: RSSCategory) => {
    saveCurrentScroll();
    openTab({
      type: 'category',
      title: category.name,
      path: '/home', // URL 단순화 - 모든 피드 탭은 /home
      resourceId: category.id
    });
    // 플로팅 모드(temporary)일 때 드로워 닫기
    if (variant === 'temporary') {
      onClose();
    }
  }, [openTab, saveCurrentScroll, variant, onClose]);

  const handleNavigateFeed = useCallback((categoryId: number, feedId: number, feedTitle: string, faviconUrl?: string) => {
    saveCurrentScroll();
    openTab({
      type: 'feed',
      title: feedTitle,
      path: '/home', // URL 단순화 - 모든 피드 탭은 /home
      resourceId: feedId,
      favicon: faviconUrl
    });
    // 플로팅 모드(temporary)일 때 드로워 닫기
    if (variant === 'temporary') {
      onClose();
    }
  }, [openTab, saveCurrentScroll, variant, onClose]);

  // 서버에서 초기화된 상태 확인
  const _initialized = useRSSStore((state) => state._initialized);

  useEffect(() => {
    // 서버에서 이미 초기화된 경우 스킵
    if (_initialized) return;
    listFeeds().then(setFeeds);
  }, [setFeeds, _initialized]);

  useEffect(() => {
    // 서버에서 이미 초기화된 경우 스킵
    if (_initialized) return;

    // The backend OpenAPI/types may not always include the `visible` field
    // (older specs). Ensure we normalize the response to `RSSCategory` by
    // defaulting `visible` to `true` when absent.
    listCategories().then((cats) => {
      const normalized = (cats || []).map((c: any) => ({
        ...c,
        visible: (c.visible ?? true),
        order: (c.order ?? 0)
      }));
      // order로 정렬
      normalized.sort((a, b) => a.order - b.order);
      setCategories(normalized);
    });
  }, [setCategories, _initialized]);

  const handleAddCategory = async () => {
    try {
      const newCategory = await createCategory({
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
      await deleteCategory(category.id);
      removeCategory(category.id);
    } catch (error) {
      console.error(error);
    }
  };

  const handleReorderCategories = useCallback(async (reorderedCategories: RSSCategory[]) => {
    // 낙관적 업데이트: 먼저 UI 업데이트
    setCategories(reorderedCategories);

    try {
      // 서버에 순서 저장
      await reorderCategories({
        category_ids: reorderedCategories.map(c => c.id)
      });
    } catch (error) {
      console.error('Failed to save category order:', error);
      // 실패 시 원래 순서로 복구
      listCategories().then((cats) =>
        setCategories((cats || []).map((c: any) => ({ ...c, visible: (c.visible ?? true), order: (c.order ?? 0) })))
      );
    }
  }, [setCategories]);

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
              onNavigateHome={handleNavigateHome}
              onNavigateCategory={handleNavigateCategory}
              onNavigateFeed={handleNavigateFeed}
              onOpenAdd={() => setAddCategoryOpen(true)}
              onDeleteCategory={handleDeleteCategory}
              draggingFeed={draggingFeed}
              onDragStart={setDraggingFeed}
              onDragEnd={() => setDraggingFeed(null)}
              onReorderCategories={handleReorderCategories}
              onCloseDrawer={onClose}
              t={t}
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
          onNavigateHome={handleNavigateHome}
          onNavigateCategory={handleNavigateCategory}
          onNavigateFeed={handleNavigateFeed}
          onOpenAdd={() => setAddCategoryOpen(true)}
          onDeleteCategory={handleDeleteCategory}
          draggingFeed={draggingFeed}
          onDragStart={setDraggingFeed}
          onDragEnd={() => setDraggingFeed(null)}
          onReorderCategories={handleReorderCategories}
          t={t}
        />
      </aside>

      {/* Add Category Dialog */}
      <Dialog open={addCategoryOpen} onOpenChange={setAddCategoryOpen}>
        <DialogContent onClose={() => setAddCategoryOpen(false)}>
          <DialogHeader>
            <DialogTitle>{t.category.add}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t.category.name}</Label>
              <Input
                id="name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder={t.category.name}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">{t.category.description}</Label>
              <Input
                id="description"
                value={newCategoryDescription}
                onChange={(e) => setNewCategoryDescription(e.target.value)}
                placeholder={t.category.description}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddCategoryOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button onClick={handleAddCategory}>{t.common.add}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
