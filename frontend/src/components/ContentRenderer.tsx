'use client';

import React, { useMemo, memo, RefObject } from 'react';
import { FeedViewer } from './FeedViewer';
import { SettingsPage } from './SettingsPage';
import RSSEverythingPage from './RSSEverythingPage';
import TaskResultsPage from './TaskResultsPage';
import PeriodicTasksPage from './PeriodicTasksPage';
import FeedEditPage from './FeedEditPage';
import { useSettingsStore } from '../stores/settingsStore';
import { useTabStore, Tab, PanelId } from '../stores/tabStore';
import { RSSItem } from '../types/rss';
import {
  listAllItems,
  listItemsByCategory,
  listItemsByFeed,
} from '../services/api';
import { usePagination, PaginationFilters } from '../hooks/usePagination';

// 홈 피드 컴포넌트
const HomeFeed = memo(({ isActive, maxColumns, scrollContainerRef }: { isActive: boolean; maxColumns?: number; scrollContainerRef?: RefObject<HTMLDivElement | null> }) => {
  const { filter } = useSettingsStore();

  const filters: PaginationFilters = useMemo(() => {
    switch (filter) {
      case 'unread':
        return { is_read: false };
      case 'read':
        return { is_read: true };
      case 'favorite':
        return { is_favorite: true };
      default:
        return {};
    }
  }, [filter]);

  const { items, handleLoadMore, handleLoadNew, hasNext, loading } = usePagination<RSSItem>(
    listAllItems,
    (item) => item.published_at,
    'home',
    filters,
    isActive  // 활성 탭에서만 데이터 로드
  );

  return (
    <FeedViewer
      items={items}
      onLoadMore={handleLoadMore}
      onLoadNew={handleLoadNew}
      hasNext={hasNext}
      loading={loading}
      isActive={isActive}
      maxColumns={maxColumns}
      scrollContainerRef={scrollContainerRef}
    />
  );
});
HomeFeed.displayName = 'HomeFeed';

// 카테고리 피드 컴포넌트
const CategoryFeed = memo(({ categoryId, isActive, maxColumns, scrollContainerRef }: { categoryId: number; isActive: boolean; maxColumns?: number; scrollContainerRef?: RefObject<HTMLDivElement | null> }) => {
  const { filter } = useSettingsStore();

  const filters: PaginationFilters = useMemo(() => {
    switch (filter) {
      case 'unread':
        return { is_read: false };
      case 'read':
        return { is_read: true };
      case 'favorite':
        return { is_favorite: true };
      default:
        return {};
    }
  }, [filter]);

  const { items, handleLoadMore, handleLoadNew, hasNext, loading } = usePagination<RSSItem>(
    (args) => listItemsByCategory(categoryId, args),
    (item) => item.published_at,
    `category-${categoryId}`,
    filters,
    isActive  // 활성 탭에서만 데이터 로드
  );

  return (
    <FeedViewer
      items={items}
      onLoadMore={handleLoadMore}
      onLoadNew={handleLoadNew}
      hasNext={hasNext}
      loading={loading}
      isActive={isActive}
      maxColumns={maxColumns}
      scrollContainerRef={scrollContainerRef}
    />
  );
});
CategoryFeed.displayName = 'CategoryFeed';

// 개별 피드 컴포넌트
const SingleFeed = memo(({ feedId, isActive, maxColumns, scrollContainerRef }: { feedId: number; isActive: boolean; maxColumns?: number; scrollContainerRef?: RefObject<HTMLDivElement | null> }) => {
  const { filter } = useSettingsStore();

  const filters: PaginationFilters = useMemo(() => {
    switch (filter) {
      case 'unread':
        return { is_read: false };
      case 'read':
        return { is_read: true };
      case 'favorite':
        return { is_favorite: true };
      default:
        return {};
    }
  }, [filter]);

  const { items, handleLoadMore, handleLoadNew, hasNext, loading } = usePagination<RSSItem>(
    (args) => listItemsByFeed(feedId, args),
    (item) => item.published_at,
    `feed-${feedId}`,
    filters,
    isActive  // 활성 탭에서만 데이터 로드
  );

  return (
    <FeedViewer
      items={items}
      onLoadMore={handleLoadMore}
      onLoadNew={handleLoadNew}
      hasNext={hasNext}
      loading={loading}
      isActive={isActive}
      maxColumns={maxColumns}
      scrollContainerRef={scrollContainerRef}
    />
  );
});
SingleFeed.displayName = 'SingleFeed';

// 탭의 고유 키 생성 (타입 + resourceId 조합으로 같은 리소스는 같은 컴포넌트 재사용)
const getTabContentKey = (tab: Tab): string => {
  if (tab.type === 'home') return 'home';
  if (tab.type === 'settings') return 'settings';
  if (tab.type === 'rss-everything') return `rss-everything-${tab.resourceId ?? 'new'}`;
  if (tab.type === 'feed-edit') return `feed-edit-${tab.resourceId ?? 'new'}`;
  if (tab.type === 'task-results') return 'task-results';
  if (tab.type === 'periodic-tasks') return 'periodic-tasks';
  if (tab.type === 'category' && tab.resourceId) return `category-${tab.resourceId}`;
  if (tab.type === 'feed' && tab.resourceId) return `feed-${tab.resourceId}`;
  return tab.id;
};

// 탭 컨텐츠 컴포넌트 - isActive에 따라 데이터 로딩 제어
const TabContentRenderer = memo(({ tab, isActive, scrollContainerRef }: { tab: Tab; isActive: boolean; scrollContainerRef?: RefObject<HTMLDivElement | null> }) => {
  const maxColumns = tab.columns ?? 3;

  switch (tab.type) {
    case 'home':
      return <HomeFeed isActive={isActive} maxColumns={maxColumns} scrollContainerRef={scrollContainerRef} />;
    case 'category':
      if (tab.resourceId) {
        return <CategoryFeed categoryId={tab.resourceId} isActive={isActive} maxColumns={maxColumns} scrollContainerRef={scrollContainerRef} />;
      }
      return null;
    case 'feed':
      if (tab.resourceId) {
        return <SingleFeed feedId={tab.resourceId} isActive={isActive} maxColumns={maxColumns} scrollContainerRef={scrollContainerRef} />;
      }
      return null;
    case 'settings':
      return <SettingsPage />;
    case 'rss-everything':
      return <RSSEverythingPage context={tab.context} />;
    case 'feed-edit':
      return <FeedEditPage context={tab.feedEditContext} />;
    case 'task-results':
      return <TaskResultsPage />;
    case 'periodic-tasks':
      return <PeriodicTasksPage />;
    default:
      return null;
  }
});
TabContentRenderer.displayName = 'TabContentRenderer';

// 메인 컨텐츠 렌더러 - 각 탭을 직접 렌더링 (컴포넌트 인스턴스 유지)
interface ContentRendererProps {
  panelId?: PanelId;
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
}

export const ContentRenderer = memo(({ panelId, scrollContainerRef }: ContentRendererProps) => {
  const { panels, activePanelId } = useTabStore();

  // panelId가 지정되면 해당 패널의 탭만, 아니면 활성 패널의 탭만 렌더링
  const targetPanelId = panelId ?? activePanelId;
  const panel = panels.find(p => p.id === targetPanelId);

  if (!panel) return null;

  return (
    <div className="min-h-full">
      {panel.tabs.map(tab => {
        const contentKey = getTabContentKey(tab);
        const isActive = tab.id === panel.activeTabId;

        return (
          <div
            key={contentKey}
            data-tab-content={tab.id}
            className={isActive ? 'min-h-full' : ''}
            style={{ display: isActive ? 'block' : 'none' }}
          >
            <TabContentRenderer tab={tab} isActive={isActive} scrollContainerRef={scrollContainerRef} />
          </div>
        );
      })}
    </div>
  );
});
ContentRenderer.displayName = 'ContentRenderer';
