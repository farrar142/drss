'use client';

import React, { useState } from "react";
import {
  Rss,
  MoreVertical,
  Pencil,
  RefreshCw,
  Trash2,
  CheckCircle
} from 'lucide-react';
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RSSFeed } from "../types/rss";
import { useRSSStore } from "../stores/rssStore";
import {
  FeedSchema,
  feedsRoutersFeedDeleteFeed,
  feedsRoutersFeedMarkAllFeedItemsRead,
  feedsRoutersFeedRefreshFeed,
  feedsRoutersFeedUpdateFeed
} from "../services/api";

interface RSSFeedListItemProps {
  feed: FeedSchema;
  categoryId: number;
}

export const RSSFeedListItem: React.FC<RSSFeedListItemProps> = ({ feed, categoryId }) => {
  const router = useRouter();
  const { updateFeed, removeFeed } = useRSSStore();
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(feed.title);
  const [editDescription, setEditDescription] = useState(feed.description);
  const [editUrl, setEditUrl] = useState(feed.url);
  const [editRefreshInterval, setEditRefreshInterval] = useState(feed.refresh_interval);

  const handleEdit = () => {
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    try {
      const updatedFeed = await feedsRoutersFeedUpdateFeed(feed.id, {
        title: editTitle,
        description: editDescription,
        url: editUrl,
        refresh_interval: editRefreshInterval,
      });
      updateFeed(updatedFeed);
      setEditOpen(false);
    } catch (error) {
      console.error(error);
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
    if (confirm('정말로 이 피드를 삭제하시겠습니까?')) {
      try {
        await feedsRoutersFeedDeleteFeed(feed.id);
        removeFeed(feed.id);
      } catch (error) {
        console.error(error);
      }
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
            "flex items-center gap-2 flex-1 px-2 py-1.5 rounded-md",
            "hover:bg-sidebar-accent/50 transition-colors",
            "text-left"
          )}
        >
          {/* Feed Icon */}
          {feed.favicon_url ? (
            <img
              src={feed.favicon_url}
              alt=""
              className="w-4 h-4 rounded-sm object-cover"
            />
          ) : (
            <Rss className="w-4 h-4 text-primary shrink-0" />
          )}

          {/* Feed Title */}
          <span className="text-xs text-sidebar-foreground truncate flex-1">
            {feed.title}
          </span>

          {/* Item Count Badge */}
          <span className={cn(
            "text-[10px] px-1.5 py-0.5 rounded",
            "bg-accent/50 text-foreground font-semibold"
          )}>
            {feed.item_count}
          </span>
        </button>

        {/* Menu Button */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn(
              "p-1 rounded opacity-0 group-hover:opacity-100",
              "hover:bg-sidebar-accent transition-all",
              "focus:opacity-100"
            )}>
              <MoreVertical className="w-4 h-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={handleEdit}>
              <Pencil className="w-4 h-4 mr-2 text-primary" />
              수정
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleRefresh}>
              <RefreshCw className="w-4 h-4 mr-2 text-green-500" />
              새로고침
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleMarkAllRead}>
              <CheckCircle className="w-4 h-4 mr-2 text-blue-500" />
              전체 읽음 처리
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              삭제
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>피드 수정</DialogTitle>
            <DialogDescription>
              피드 정보를 수정합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">제목</Label>
              <Input
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">설명</Label>
              <Input
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-url">URL</Label>
              <Input
                id="edit-url"
                value={editUrl}
                onChange={(e) => setEditUrl(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-refresh">새로고침 간격 (분)</Label>
              <Input
                id="edit-refresh"
                type="number"
                min={1}
                value={editRefreshInterval}
                onChange={(e) => setEditRefreshInterval(Number(e.target.value))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>
              취소
            </Button>
            <Button onClick={handleEditSave}>
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
