'use client';

import React, { useState } from 'react';
import {
  Rss,
  MoreVertical,
  Pencil,
  RefreshCw,
  Trash2,
  CheckCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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

interface RSSFeedListItemProps {
  feed: FeedSchema;
  categoryId: number;
}

export const RSSFeedListItem: React.FC<RSSFeedListItemProps> = ({ feed, categoryId }) => {
  const router = useRouter();
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

  return (
    <>
      <div className="flex items-center group">
        {/* Feed Item Button */}
        <button
          onClick={() => router.push(`/category/${categoryId}/feed/${feed.id}`)}
          className={cn(
            'flex items-center gap-2 flex-1 px-2 py-1.5 rounded-md',
            'hover:bg-sidebar-accent/50 transition-colors',
            'text-left',
            'min-w-0'
          )}
        >
          {feed.favicon_url ? (
            <img src={feed.favicon_url} alt="" className="w-4 h-4 rounded-sm object-cover" />
          ) : (
            <Rss className="w-4 h-4 text-primary shrink-0" />
          )}

          <span title={feed.title} className="text-xs text-sidebar-foreground truncate flex-1 min-w-0">
            {feed.title}
          </span>

          <span
            className={cn(
              'text-[10px] px-1.5 py-0.5 rounded',
              'bg-accent/50 text-foreground font-semibold'
            )}
          >
            {feed.item_count}
          </span>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn('p-1 rounded opacity-0 group-hover:opacity-100', 'hover:bg-sidebar-accent transition-all', 'focus:opacity-100', 'shrink-0 ml-2')}>
              <MoreVertical className="w-4 h-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40">
            <DropdownMenuItem onClick={handleEdit}>
              <Pencil className="w-4 h-4 mr-2 text-primary" /> 수정
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleRefresh}>
              <RefreshCw className="w-4 h-4 mr-2 text-green-500" /> 새로고침
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleMarkAllRead}>
              <CheckCircle className="w-4 h-4 mr-2 text-blue-500" /> 전체 읽음 처리
            </DropdownMenuItem>
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
          custom_headers: feed.custom_headers as any,
          refresh_interval: feed.refresh_interval,
        }}
        onSubmit={handleEditSave}
      />
    </>
  );
};

export default RSSFeedListItem;
