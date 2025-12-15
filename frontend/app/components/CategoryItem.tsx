'use client';

import { ChevronDown, FolderOpen, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FC, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import FeedDialog from './FeedDialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RSSCategory, RSSFeed } from '../types/rss';
import { RSSFeedListItem } from './RSSFeedListItem';
import { useRSSStore } from '../stores/rssStore';
import { feedsRoutersFeedCreateFeed } from '../services/api';

export const CategoryItem: FC<{
  category: RSSCategory;
  pathname: string;
  deleteCategory: (category: RSSCategory) => Promise<void>;
  feeds: RSSFeed[];
}> = ({ category, pathname, deleteCategory, feeds: _feeds }) => {
  const router = useRouter();
  const { addFeed } = useRSSStore();
  const [expanded, setExpanded] = useState(false);
  const [addFeedOpen, setAddFeedOpen] = useState(false);
  const feeds = useMemo(() => _feeds.filter((f) => f.category_id == category.id), [_feeds, category.id]);
  const categoryIdFromPath = pathname.startsWith('/category/') ? pathname.split('/')[2] : null;

  useEffect(() => {
    if (categoryIdFromPath && parseInt(categoryIdFromPath) === category.id) setExpanded(true);
    else setExpanded(false);
  }, [pathname, category.id, categoryIdFromPath]);

  const handleSummaryClick = () => {
    setExpanded((p) => !p);
    router.push(`/category/${category.id}`);
  };

  const handleCreateSubmit = async (payload: any) => {
    const created = await feedsRoutersFeedCreateFeed({ ...payload, category_id: category.id });
    addFeed(created);
    return created;
  };

  return (
    <>
      <div className="w-full">
        <div
          className={cn(
            'flex items-center justify-between px-3 py-2 mx-1 rounded-lg cursor-pointer',
            'hover:bg-sidebar-accent/50 transition-colors'
          )}
        >
          <div className="flex items-center gap-2 flex-1" onClick={handleSummaryClick}>
            <FolderOpen className="w-4 h-4 text-primary" />
            <span className="font-medium text-sidebar-foreground text-sm">{category.name}</span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((p) => !p);
            }}
            className="p-1 rounded hover:bg-sidebar-accent transition-colors"
          >
            <ChevronDown className={cn('w-4 h-4 text-sidebar-foreground/70', expanded && 'rotate-180')} />
          </button>
        </div>

        <div className={cn('overflow-hidden transition-all duration-200', expanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0')}>
          <div className="px-2 pb-2">
            <div className="space-y-0.5">
              {feeds.map((feed) => (
                <RSSFeedListItem feed={feed} key={feed.id} categoryId={category.id} />
              ))}
            </div>

            <Button variant="outline" size="sm" className="w-full mt-2 gap-2 text-muted-foreground hover:text-foreground" onClick={() => setAddFeedOpen(true)}>
              <Plus className="w-4 h-4" /> RSS 피드 추가
            </Button>
          </div>
        </div>
      </div>

      <FeedDialog open={addFeedOpen} onOpenChange={setAddFeedOpen} title="RSS 피드 추가" submitLabel="추가" onSubmit={handleCreateSubmit} />
    </>
  );
};

export default CategoryItem;
