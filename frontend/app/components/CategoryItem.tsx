'use client';

import { ChevronRight, Eye, EyeOff, FolderOpen, GripVertical, MoreVertical, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { FC, useEffect, useMemo, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import FeedDialog from './FeedDialog';
import { RSSCategory, RSSFeed } from '../types/rss';
import { FeedListItem } from './FeedListItem';
import { useRSSStore } from '../stores/rssStore';
import {
  feedsRoutersFeedCreateFeed,
  feedsRoutersCategoryUpdateCategory,
  feedsRoutersCategoryRefreshCategoryFeeds,
  feedsRoutersFeedUpdateFeed,
  FeedSchema,
} from '../services/api';

export const CategoryItem: FC<{
  category: RSSCategory;
  pathname: string;
  deleteCategory: (category: RSSCategory) => Promise<void>;
  feeds: RSSFeed[];
  draggingFeed?: FeedSchema | null;
  onFeedMoved?: (feedId: number, toCategoryId: number) => void;
  onDragStart?: (feed: FeedSchema) => void;
  onDragEnd?: () => void;
  // 카테고리 드래그용
  onCategoryDragStart?: (e: React.DragEvent, category: RSSCategory) => void;
  onCategoryDragOver?: (e: React.DragEvent) => void;
  onCategoryDrop?: (e: React.DragEvent, category: RSSCategory) => void;
  isDraggingCategory?: boolean;
}> = ({
  category,
  pathname,
  deleteCategory,
  feeds: _feeds,
  draggingFeed,
  onFeedMoved,
  onDragStart,
  onDragEnd,
  onCategoryDragStart,
  onCategoryDragOver,
  onCategoryDrop,
  isDraggingCategory,
}) => {
    const { addFeed, updateCategory, updateFeed } = useRSSStore();
    const [expanded, setExpanded] = useState(false);
    const [addFeedOpen, setAddFeedOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [editName, setEditName] = useState(category.name);
    const [editDescription, setEditDescription] = useState(category.description);
    const [editVisible, setEditVisible] = useState(category.visible);
    const [isDragOver, setIsDragOver] = useState(false);
    const feeds = useMemo(() => _feeds.filter((f) => f.category_id == category.id), [_feeds, category.id]);
    const totalItemCount = useMemo(() => feeds.reduce((sum, f) => sum + f.item_count, 0), [feeds]);
    const categoryIdFromPath = pathname.startsWith('/category/') ? pathname.split('/')[2] : null;
    const isActive = categoryIdFromPath && parseInt(categoryIdFromPath) === category.id;

    useEffect(() => {
      if (isActive) setExpanded(true);
    }, [pathname, category.id, isActive]);

    // 카테고리 데이터가 변경되면 편집 폼도 업데이트
    useEffect(() => {
      setEditName(category.name);
      setEditDescription(category.description);
      setEditVisible(category.visible);
    }, [category]);

    const handleExpandToggle = () => {
      setExpanded((p) => !p);
    };

    const handleCreateSubmit = async (payload: any) => {
      const created = await feedsRoutersFeedCreateFeed({ ...payload, category_id: category.id });
      addFeed(created);
      return created;
    };

    const handleEditSave = async () => {
      try {
        const updated = await feedsRoutersCategoryUpdateCategory(category.id, ({
          name: editName,
          description: editDescription,
          visible: editVisible,
        } as any));
        updateCategory({ ...(updated as any), visible: (updated as any).visible ?? true });
        setEditOpen(false);
      } catch (error) {
        console.error('Failed to update category', error);
      }
    };

    const handleToggleVisible = async () => {
      try {
        const updated = await feedsRoutersCategoryUpdateCategory(category.id, ({
          visible: !category.visible,
        } as any));
        updateCategory({ ...(updated as any), visible: (updated as any).visible ?? true });
      } catch (error) {
        console.error('Failed to toggle category visibility', error);
      }
    };

    const handleRefresh = async () => {
      try {
        await feedsRoutersCategoryRefreshCategoryFeeds(category.id);
        alert('카테고리 피드 새로고침이 예약되었습니다.');
      } catch (error) {
        console.error('Failed to refresh category feeds', error);
      }
    };

    const handleDelete = async () => {
      if (!confirm('정말로 이 카테고리를 삭제하시겠습니까? 하위 피드도 모두 삭제됩니다.')) return;
      await deleteCategory(category);
    };

    // Drag & Drop handlers
    const handleDragOver = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
      // 자식 요소로 이동할 때는 무시
      if (e.currentTarget.contains(e.relatedTarget as Node)) return;
      setIsDragOver(false);
    }, []);

    const handleDrop = useCallback(async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      try {
        const data = JSON.parse(e.dataTransfer.getData('application/json'));
        const { feedId, fromCategoryId } = data;

        // 같은 카테고리면 무시
        if (fromCategoryId === category.id) return;

        // API 호출로 카테고리 변경
        const updated = await feedsRoutersFeedUpdateFeed(feedId, { category_id: category.id });
        updateFeed(updated);
        onFeedMoved?.(feedId, category.id);
      } catch (error) {
        console.error('Failed to move feed:', error);
      }
    }, [category.id, updateFeed, onFeedMoved]);

    return (
      <>
        <div
          className={cn(
            "w-full group rounded-lg transition-all duration-200",
            isDragOver && draggingFeed && draggingFeed.category_id !== category.id && 'bg-primary/10 ring-2 ring-primary ring-inset'
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* 카테고리 헤더 */}
          <div
            draggable={!!onCategoryDragStart}
            onDragStart={(e) => onCategoryDragStart?.(e, category)}
            onDragOver={onCategoryDragOver}
            onDrop={(e) => onCategoryDrop?.(e, category)}
            className={cn(
              'flex items-center gap-1 px-2 py-2.5 mx-1 rounded-lg cursor-pointer select-none',
              'transition-all duration-150',
              !category.visible && 'opacity-60',
              isActive
                ? 'bg-primary/15 text-primary shadow-sm'
                : 'hover:bg-sidebar-accent/60',
              isDraggingCategory && 'opacity-50'
            )}
          >
            {/* 드래그 핸들 */}
            {onCategoryDragStart && (
              <div className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity -ml-1">
                <GripVertical className="w-4 h-4 text-muted-foreground" />
              </div>
            )}

            {/* 펼치기/접기 화살표 */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((p) => !p);
              }}
              className={cn(
                "p-0.5 rounded transition-all duration-200",
                "hover:bg-sidebar-accent/80",
                !onCategoryDragStart && "-ml-1"
              )}
            >
              <ChevronRight
                className={cn(
                  'w-4 h-4 text-muted-foreground transition-transform duration-200',
                  expanded && 'rotate-90'
                )}
              />
            </button>

            {/* 카테고리 정보 */}
            <Link
              href={`/category/${category.id}`}
              className="flex items-center gap-2 flex-1 min-w-0"
              onClick={handleExpandToggle}
            >
              <FolderOpen className={cn(
                "w-4 h-4 shrink-0 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )} />
              <span className={cn(
                "font-medium text-sm",
                isActive ? "text-primary" : "text-sidebar-foreground"
              )}>
                {category.name}
              </span>
              {!category.visible && (
                <EyeOff className="w-3 h-3 text-muted-foreground shrink-0" />
              )}
            </Link>

            {/* 피드 개수 & 아이템 총 개수 */}
            <div className="flex items-center gap-1.5 shrink-0">
              {feeds.length > 0 && (
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                  isActive
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                )}>
                  {feeds.length}개 피드 · {totalItemCount}
                </span>
              )}

              {/* 더보기 메뉴 */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      'p-1 rounded-md opacity-0 group-hover:opacity-100',
                      'hover:bg-sidebar-accent/80 transition-all',
                      'focus:opacity-100'
                    )}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="w-4 h-4 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => setEditOpen(true)}>
                    <Pencil className="w-4 h-4 mr-2 text-primary" /> 수정
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleToggleVisible}>
                    {category.visible ? (
                      <>
                        <EyeOff className="w-4 h-4 mr-2 text-orange-500" /> 메인에서 숨기기
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4 mr-2 text-green-500" /> 메인에 표시
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleRefresh}>
                    <RefreshCw className="w-4 h-4 mr-2 text-blue-500" /> 전체 새로고침
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
                    <Trash2 className="w-4 h-4 mr-2" /> 삭제
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* 피드 리스트 */}
          <div
            className={cn(
              'overflow-hidden transition-all duration-200 ease-out',
              expanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
            )}
          >
            <div className="pl-4 pr-2 pb-2 pt-1">
              {feeds.length > 0 ? (
                <div className="space-y-0.5 border-l-2 border-sidebar-border/50 pl-2">
                  {feeds.map((feed) => (
                    <FeedListItem
                      feed={feed}
                      key={feed.id}
                      categoryId={category.id}
                      onDragStart={onDragStart}
                      onDragEnd={onDragEnd}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground text-center py-3 border border-dashed border-sidebar-border rounded-md">
                  아직 피드가 없습니다
                </div>
              )}

              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "w-full mt-2 gap-2 h-8",
                  "text-muted-foreground hover:text-foreground",
                  "border border-dashed border-sidebar-border/70 hover:border-sidebar-border",
                  "hover:bg-sidebar-accent/50"
                )}
                onClick={() => setAddFeedOpen(true)}
              >
                <Plus className="w-3.5 h-3.5" /> 피드 추가
              </Button>
            </div>
          </div>
        </div>

        <FeedDialog open={addFeedOpen} onOpenChange={setAddFeedOpen} title="RSS 피드 추가" submitLabel="추가" onSubmit={handleCreateSubmit} />

        {/* 카테고리 수정 다이얼로그 */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>카테고리 수정</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="category-name">이름</Label>
                <Input
                  id="category-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="카테고리 이름"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="category-description">설명</Label>
                <Input
                  id="category-description"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="카테고리 설명 (선택)"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="category-visible">메인 화면에 표시</Label>
                  <p className="text-xs text-muted-foreground">
                    끄면 메인 화면에서 이 카테고리의 글이 보이지 않습니다
                  </p>
                </div>
                <Switch
                  id="category-visible"
                  checked={editVisible}
                  onCheckedChange={setEditVisible}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)}>
                취소
              </Button>
              <Button onClick={handleEditSave}>저장</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  };

export default CategoryItem;
