'use client';

import React, { useState } from 'react';
import {
  Rss,
  MoreVertical,
  Pencil,
  RefreshCw,
  Trash2,
  CheckCircle,
  Eye,
  EyeOff,
  GripVertical,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui/dropdown-menu';
import { useRSSStore } from '../../stores/rssStore';
import { useTabStore } from '../../stores/tabStore';
import { useToast, useConfirm } from '../../stores/toastStore';
import { useTranslation } from '../../stores/languageStore';
import {
  FeedSchema,
  deleteFeed,
  markAllFeedItemsRead,
  refreshFeed,
  updateFeed as updateFeedApi,
} from '../../services/api';

interface FeedListItemProps {
  feed: FeedSchema;
  categoryId: number;
  onDragStart?: (feed: FeedSchema) => void;
  onDragEnd?: () => void;
  onNavigateFeed?: (categoryId: number, feedId: number, feedTitle: string, faviconUrl?: string) => void;
}

export const FeedListItem: React.FC<FeedListItemProps> = ({ feed, categoryId, onDragStart, onDragEnd, onNavigateFeed }) => {
  const { updateFeed, removeFeed, adjustFeedItemCount } = useRSSStore();
  const { openTab, closeTabsByFeedId } = useTabStore();
  const toast = useToast();
  const confirm = useConfirm();
  const { t } = useTranslation();

  // 피드 수정 - FeedEdit 탭 열기
  const handleEdit = () => {
    openTab({
      type: 'feed-edit',
      title: `${feed.title} - ${t.feed.edit}`,
      path: '/feed-edit',
      resourceId: feed.id, // 피드별로 다른 탭이 열리도록
      feedEditContext: {
        mode: 'edit',
        feedId: feed.id,
      },
    });
  };

  const handleRefresh = async () => {
    try {
      await refreshFeed(feed.id);
      toast.success(t.feed.refreshScheduled);
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: t.feed.deleteTitle,
      description: t.feed.deleteConfirm,
      variant: 'destructive',
    });
    if (!confirmed) return;
    try {
      await deleteFeed(feed.id);
      removeFeed(feed.id);
      // 삭제된 피드와 관련된 모든 탭 닫기
      closeTabsByFeedId(feed.id);
    } catch (error) {
      console.error(error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const previousCount = feed.item_count;
      await markAllFeedItemsRead(feed.id);
      // 모든 아이템을 읽음으로 표시했으므로 unread count를 0으로 만듦
      adjustFeedItemCount(feed.id, -previousCount);
      toast.success(t.feed.markAllReadSuccess);
    } catch (error) {
      console.error(error);
    }
  };

  const handleToggleVisible = async () => {
    try {
      const updated = await updateFeedApi(feed.id, {
        visible: !feed.visible,
      });
      updateFeed(updated);
    } catch (error) {
      console.error('Failed to toggle feed visibility', error);
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      feedId: feed.id,
      fromCategoryId: categoryId,
      feedTitle: feed.title,
      faviconUrl: feed.favicon_url,
    }));
    e.dataTransfer.effectAllowed = 'move';
    onDragStart?.(feed);
  };

  const handleDragEnd = () => {
    onDragEnd?.();
  };

  return (
    <>
      <div
        className={cn(
          'flex items-center group rounded-md',
          'hover:bg-sidebar-accent/40 transition-colors',
          !feed.visible && 'opacity-50'
        )}
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Drag Handle */}
        <div className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity p-1">
          <GripVertical className="w-3 h-3 text-muted-foreground" />
        </div>

        {/* Feed Item Button */}
        <button
          onClick={() => onNavigateFeed?.(categoryId, feed.id, feed.title, feed.favicon_url || undefined)}
          className={cn(
            'flex items-center gap-2 flex-1 px-2 py-1.5 rounded-md',
            'transition-colors',
            'text-left',
            'min-w-0'
          )}
        >
          {/* Favicon */}
          <div className="w-4 h-4 shrink-0 flex items-center justify-center">
            {feed.favicon_url ? (
              <img
                src={feed.favicon_url}
                alt=""
                className="w-4 h-4 rounded-sm object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                }}
              />
            ) : null}
            <Rss className={cn(
              "w-4 h-4 text-muted-foreground",
              feed.favicon_url && "hidden"
            )} />
          </div>

          {/* Title */}
          <span
            title={feed.title}
            className="text-xs text-sidebar-foreground truncate flex-1 min-w-0"
          >
            {feed.title}
          </span>

          {/* Hidden indicator */}
          {!feed.visible && (
            <EyeOff className="w-3 h-3 text-muted-foreground shrink-0" />
          )}

          {/* Item count badge */}
          <span
            className={cn(
              'text-[10px] px-1.5 py-0.5 rounded-full shrink-0',
              'bg-muted/80 text-muted-foreground font-medium',
              feed.item_count > 0 && 'bg-primary/15 text-primary'
            )}
          >
            {feed.item_count}
          </span>
        </button>

        {/* More menu - 모바일 친화적으로 항상 표시 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                'p-1 rounded-md transition-all',
                'hover:bg-sidebar-accent/80',
                'opacity-60 hover:opacity-100 focus:opacity-100',
                'md:opacity-0 md:group-hover:opacity-100', // 데스크톱에서만 hover 시 표시
                'shrink-0 mr-1'
              )}
            >
              <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuItem onClick={handleEdit}>
              <Pencil className="w-4 h-4 mr-2 text-primary" /> {t.feed.edit}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleToggleVisible}>
              {feed.visible ? (
                <>
                  <EyeOff className="w-4 h-4 mr-2 text-orange-500" /> {t.feed.hide}
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 mr-2 text-green-500" /> {t.feed.show}
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleRefresh}>
              <RefreshCw className="w-4 h-4 mr-2 text-blue-500" /> {t.feed.refresh}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleMarkAllRead}>
              <CheckCircle className="w-4 h-4 mr-2 text-cyan-500" /> {t.feed.markAllRead}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
              <Trash2 className="w-4 h-4 mr-2" /> {t.common.delete}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
};

export default FeedListItem;
