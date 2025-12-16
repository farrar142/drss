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
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import FeedDialog from './FeedDialog';
import { useRSSStore } from '../stores/rssStore';
import {
  FeedSchema,
  feedsRoutersFeedDeleteFeed,
  feedsRoutersFeedMarkAllFeedItemsRead,
  feedsRoutersFeedRefreshFeed,
  feedsRoutersFeedUpdateFeed,
} from '../services/api';

interface FeedListItemProps {
  feed: FeedSchema;
  categoryId: number;
  onDragStart?: (feed: FeedSchema) => void;
  onDragEnd?: () => void;
}

export const FeedListItem: React.FC<FeedListItemProps> = ({ feed, categoryId, onDragStart, onDragEnd }) => {
  const { updateFeed, removeFeed } = useRSSStore();

  const [editOpen, setEditOpen] = useState(false);

  const handleEdit = () => setEditOpen(true);

  const handleEditSave = async (payload: any) => {
    try {
      const updated = await feedsRoutersFeedUpdateFeed(feed.id, payload);
      updateFeed(updated);
      setEditOpen(false);
      return updated;
    } catch (err) {
      console.error('Failed to update feed', err);
      throw err;
    }
  };

  const handleRefresh = async () => {
    try {
      await feedsRoutersFeedRefreshFeed(feed.id);
      alert('피드 새로고침이 예약되었습니다.');
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async () => {
    if (!confirm('정말로 이 피드를 삭제하시겠습니까?')) return;
    try {
      await feedsRoutersFeedDeleteFeed(feed.id);
      removeFeed(feed.id);
    } catch (error) {
      console.error(error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await feedsRoutersFeedMarkAllFeedItemsRead(feed.id);
      alert('모든 아이템을 읽음으로 표시했습니다.');
    } catch (error) {
      console.error(error);
    }
  };

  const handleToggleVisible = async () => {
    try {
      const updated = await feedsRoutersFeedUpdateFeed(feed.id, {
        visible: !feed.visible,
      });
      updateFeed(updated);
    } catch (error) {
      console.error('Failed to toggle feed visibility', error);
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ feedId: feed.id, fromCategoryId: categoryId }));
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

        {/* Feed Item Link */}
        <Link
          href={`/category/${categoryId}/feed/${feed.id}`}
          draggable={false}
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
        </Link>

        {/* More menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                'p-1 rounded-md opacity-0 group-hover:opacity-100',
                'hover:bg-sidebar-accent/80 transition-all',
                'focus:opacity-100',
                'shrink-0 mr-1'
              )}
            >
              <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuItem onClick={handleEdit}>
              <Pencil className="w-4 h-4 mr-2 text-primary" /> 수정
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleToggleVisible}>
              {feed.visible ? (
                <>
                  <EyeOff className="w-4 h-4 mr-2 text-orange-500" /> 숨기기
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 mr-2 text-green-500" /> 표시하기
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleRefresh}>
              <RefreshCw className="w-4 h-4 mr-2 text-blue-500" /> 새로고침
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleMarkAllRead}>
              <CheckCircle className="w-4 h-4 mr-2 text-cyan-500" /> 전체 읽음 처리
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
              <Trash2 className="w-4 h-4 mr-2" /> 삭제
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <FeedDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        title="피드 수정"
        submitLabel="저장"
        initial={{
          url: feed.url,
          title: feed.title,
          description: feed.description,
          favicon_url: feed.favicon_url,
          visible: feed.visible,
          custom_headers: feed.custom_headers as any,
          refresh_interval: feed.refresh_interval,
        }}
        onSubmit={handleEditSave}
      />
    </>
  );
};

export default FeedListItem;
