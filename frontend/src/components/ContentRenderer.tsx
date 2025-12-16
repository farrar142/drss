'use client';

import React, { useMemo, memo } from 'react';
import { FeedViewer } from './FeedViewer';
import { SettingsPage } from './SettingsPage';
import { useSettingsStore } from '../stores/settingsStore';
import { useTabStore, Tab } from '../stores/tabStore';
import { RSSItem } from '../types/rss';
import {
  feedsRoutersItemListAllItems,
  feedsRoutersItemListItemsByCategory,
  feedsRoutersItemListItemsByFeed,
} from '../services/api';
import { usePagination, PaginationFilters } from '../hooks/usePagination';

// 홈 피드 컴포넌트
const HomeFeed = memo(({ isActive }: { isActive: boolean }) => {
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
    feedsRoutersItemListAllItems,
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
    />
  );
});
HomeFeed.displayName = 'HomeFeed';

// 카테고리 피드 컴포넌트
const CategoryFeed = memo(({ categoryId, isActive }: { categoryId: number; isActive: boolean }) => {
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
    (args) => feedsRoutersItemListItemsByCategory(categoryId, args),
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
    />
  );
});
CategoryFeed.displayName = 'CategoryFeed';

// 개별 피드 컴포넌트
const SingleFeed = memo(({ feedId, isActive }: { feedId: number; isActive: boolean }) => {
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
    (args) => feedsRoutersItemListItemsByFeed(feedId, args),
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
    />
  );
});
SingleFeed.displayName = 'SingleFeed';

// 탭의 고유 키 생성 (타입 + resourceId 조합으로 같은 리소스는 같은 컴포넌트 재사용)
const getTabContentKey = (tab: Tab): string => {
  if (tab.type === 'home') return 'home';
  if (tab.type === 'settings') return 'settings';
  if (tab.type === 'category' && tab.resourceId) return `category-${tab.resourceId}`;
  if (tab.type === 'feed' && tab.resourceId) return `feed-${tab.resourceId}`;
  return tab.id;
};

// 탭 컨텐츠 컴포넌트 - isActive에 따라 데이터 로딩 제어
const TabContentRenderer = memo(({ tab, isActive }: { tab: Tab; isActive: boolean }) => {
  switch (tab.type) {
    case 'home':
      return <HomeFeed isActive={isActive} />;
    case 'category':
      if (tab.resourceId) {
        return <CategoryFeed categoryId={tab.resourceId} isActive={isActive} />;
      }
      return null;
    case 'feed':
      if (tab.resourceId) {
        return <SingleFeed feedId={tab.resourceId} isActive={isActive} />;
      }
      return null;
    case 'settings':
      return <SettingsPage />;
    default:
      return null;
  }
});
TabContentRenderer.displayName = 'TabContentRenderer';

// 메인 컨텐츠 렌더러 - 각 탭을 직접 렌더링 (컴포넌트 인스턴스 유지)
export const ContentRenderer = memo(() => {
  const { tabs, activeTabId } = useTabStore();

  return (
    <>
      {tabs.map(tab => {
        const contentKey = getTabContentKey(tab);
        const isActive = tab.id === activeTabId;
        
        return (
          <div
            key={contentKey}
            data-tab-content={tab.id}
            style={{ display: isActive ? 'block' : 'none' }}
          >
            <TabContentRenderer tab={tab} isActive={isActive} />
          </div>
        );
      })}
    </>
  );
});
ContentRenderer.displayName = 'ContentRenderer';
