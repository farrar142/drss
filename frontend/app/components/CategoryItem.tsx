'use client';

import { ChevronDown, FolderOpen, Plus, Loader2 } from 'lucide-react';
import { useRouter } from "next/navigation";
import { FC, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
import { RSSCategory, RSSFeed } from "../types/rss";
import { RSSFeedListItem } from './RSSFeedListItem';
import { useRSSStore } from "../stores/rssStore";
import { feedsRoutersFeedCreateFeed, feedsRoutersFeedValidateFeed } from '../services/api';

export const CategoryItem: FC<{
  category: RSSCategory,
  pathname: string,
  deleteCategory: (category: RSSCategory) => Promise<void>
  feeds: RSSFeed[]
}> = ({ category, pathname, deleteCategory, feeds: _feeds }) => {
  const router = useRouter();
  const { addFeed } = useRSSStore();
  const [expanded, setExpanded] = useState(false);
  const [addFeedOpen, setAddFeedOpen] = useState(false);
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [newFeedTitle, setNewFeedTitle] = useState('');
  const [newFeedDescription, setNewFeedDescription] = useState('');
  const [newFeedCustomHeaders, setNewFeedCustomHeaders] = useState('');
  const [newFeedRefreshInterval, setNewFeedRefreshInterval] = useState(5);
  const [validationResult, setValidationResult] = useState<{
    title: string;
    description: string;
    items_count: number;
    latest_item_date?: string
  } | null>(null);
  const [validating, setValidating] = useState(false);
  const feeds = useMemo(() => _feeds.filter(f => f.category_id == category.id), [_feeds, category.id]);
  const categoryIdFromPath = pathname.startsWith('/category/') ? pathname.split('/')[2] : null;

  useEffect(() => {
    if (categoryIdFromPath && parseInt(categoryIdFromPath) === category.id) {
      setExpanded(true);
    } else {
      setExpanded(false);
    }
  }, [pathname, category.id, categoryIdFromPath]);

  const handleValidateFeed = async () => {
    if (!newFeedUrl.trim()) {
      alert('URL을 입력하세요.');
      return;
    }
    setValidating(true);
    try {
      let customHeaders = undefined;
      if (newFeedCustomHeaders.trim()) {
        customHeaders = JSON.parse(newFeedCustomHeaders);
      }
      const result = await feedsRoutersFeedValidateFeed({
        url: newFeedUrl,
        custom_headers: customHeaders,
      });
      setValidationResult(result);
      if (!newFeedTitle && result.title) {
        setNewFeedTitle(result.title);
      }
      if (!newFeedDescription && result.description) {
        setNewFeedDescription(result.description);
      }
    } catch (error) {
      console.error(error);
      alert('피드 검증 실패: ' + ((error as any)?.message || '알 수 없는 오류'));
      setValidationResult(null);
    } finally {
      setValidating(false);
    }
  };

  const handleSummaryClick = () => {
    setExpanded(p => !p);
    router.push(`/category/${category.id}`);
  };

  const handleAddFeed = async () => {
    try {
      let customHeaders = undefined;
      if (newFeedCustomHeaders.trim()) {
        try {
          customHeaders = JSON.parse(newFeedCustomHeaders);
        } catch (e) {
          alert('Custom Headers는 유효한 JSON 형식이어야 합니다.');
          return;
        }
      }

      const newFeed = await feedsRoutersFeedCreateFeed({
        category_id: category.id,
        url: newFeedUrl,
        title: newFeedTitle,
        description: newFeedDescription,
        custom_headers: customHeaders,
        refresh_interval: newFeedRefreshInterval,
      });
      addFeed(newFeed);
      setAddFeedOpen(false);
      resetForm();
    } catch (error) {
      console.error(error);
    }
  };

  const resetForm = () => {
    setNewFeedUrl('');
    setNewFeedTitle('');
    setNewFeedDescription('');
    setNewFeedCustomHeaders('');
    setNewFeedRefreshInterval(5);
    setValidationResult(null);
  };

  return (
    <>
      {/* Accordion */}
      <div className="w-full">
        {/* Accordion Header */}
        <div
          className={cn(
            "flex items-center justify-between px-3 py-2 mx-1 rounded-lg cursor-pointer",
            "hover:bg-sidebar-accent/50 transition-colors"
          )}
        >
          <div
            className="flex items-center gap-2 flex-1"
            onClick={handleSummaryClick}
          >
            <FolderOpen className="w-4 h-4 text-primary" />
            <span className="font-medium text-sidebar-foreground text-sm">
              {category.name}
            </span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(p => !p);
            }}
            className="p-1 rounded hover:bg-sidebar-accent transition-colors"
          >
            <ChevronDown
              className={cn(
                "w-4 h-4 text-sidebar-foreground/70 transition-transform duration-200",
                expanded && "rotate-180"
              )}
            />
          </button>
        </div>

        {/* Accordion Content */}
        <div className={cn(
          "overflow-hidden transition-all duration-200",
          expanded ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
        )}>
          <div className="px-2 pb-2">
            {/* Feed List */}
            <div className="space-y-0.5">
              {feeds.map(feed => (
                <RSSFeedListItem
                  feed={feed}
                  key={feed.id}
                  categoryId={category.id}
                />
              ))}
            </div>

            {/* Add Feed Button */}
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2 gap-2 text-muted-foreground hover:text-foreground"
              onClick={() => setAddFeedOpen(true)}
            >
              <Plus className="w-4 h-4" />
              RSS 피드 추가
            </Button>
          </div>
        </div>
      </div>

      {/* Add Feed Dialog */}
      <Dialog open={addFeedOpen} onOpenChange={setAddFeedOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>RSS 피드 추가</DialogTitle>
            <DialogDescription>
              RSS 피드 URL을 입력하고 검증하세요.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* URL Input */}
            <div className="space-y-2">
              <Label htmlFor="feed-url">URL</Label>
              <div className="flex gap-2">
                <Input
                  id="feed-url"
                  placeholder="https://example.com/rss"
                  value={newFeedUrl}
                  onChange={(e) => setNewFeedUrl(e.target.value)}
                  autoFocus
                />
                <Button
                  variant="outline"
                  onClick={handleValidateFeed}
                  disabled={validating}
                  className="shrink-0"
                >
                  {validating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      검증 중
                    </>
                  ) : (
                    '검증'
                  )}
                </Button>
              </div>
            </div>

            {/* Custom Headers */}
            <div className="space-y-2">
              <Label htmlFor="custom-headers">Custom Headers (JSON)</Label>
              <Input
                id="custom-headers"
                placeholder='{"User-Agent": "MyApp/1.0"}'
                value={newFeedCustomHeaders}
                onChange={(e) => setNewFeedCustomHeaders(e.target.value)}
              />
            </div>

            {/* Validation Result */}
            {validationResult && (
              <div className="p-3 rounded-lg bg-accent/50 border border-border space-y-1">
                <p className="text-sm font-semibold text-foreground">검증 결과</p>
                <p className="text-sm text-muted-foreground">제목: {validationResult.title}</p>
                <p className="text-sm text-muted-foreground">설명: {validationResult.description}</p>
                <p className="text-sm text-muted-foreground">아이템 수: {validationResult.items_count}</p>
                {validationResult.latest_item_date && (
                  <p className="text-sm text-muted-foreground">
                    최신 아이템 날짜: {validationResult.latest_item_date}
                  </p>
                )}
              </div>
            )}

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="feed-title">제목</Label>
              <Input
                id="feed-title"
                placeholder="피드 제목"
                value={newFeedTitle}
                onChange={(e) => setNewFeedTitle(e.target.value)}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="feed-description">설명</Label>
              <Input
                id="feed-description"
                placeholder="피드 설명"
                value={newFeedDescription}
                onChange={(e) => setNewFeedDescription(e.target.value)}
              />
            </div>

            {/* Refresh Interval */}
            <div className="space-y-2">
              <Label htmlFor="refresh-interval">새로고침 간격 (분)</Label>
              <Input
                id="refresh-interval"
                type="number"
                min={1}
                value={newFeedRefreshInterval}
                onChange={(e) => setNewFeedRefreshInterval(Number(e.target.value))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddFeedOpen(false)}>
              취소
            </Button>
            <Button onClick={handleAddFeed}>
              추가
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
