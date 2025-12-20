import { create } from 'zustand';
import { RSSFeed, RSSCategory } from '../types/rss';
import { FeedSchema, listCategoriesWithFeeds } from '../services/api';

interface RSSStore {
  // Data
  feeds: FeedSchema[];
  categories: RSSCategory[];

  // 서버에서 초기 데이터를 받았는지 여부
  _initialized: boolean;

  // UI State
  searchQuery: string;

  // Actions
  setFeeds: (feeds: RSSFeed[]) => void;
  setCategories: (categories: RSSCategory[]) => void;
  addFeed: (feed: RSSFeed) => void;
  updateFeed: (feed: RSSFeed) => void;
  removeFeed: (id: number) => void;
  addCategory: (category: RSSCategory) => void;
  updateCategory: (category: RSSCategory) => void;
  removeCategory: (id: number) => void;

  setSearchQuery: (query: string) => void;

  // 서버 초기 데이터로 초기화 (SSR에서 사용)
  initializeFromServer: (categories: RSSCategory[], feeds: FeedSchema[]) => void;

  // 카테고리와 피드를 서버에서 새로 불러와 갱신
  refreshCategoriesWithFeeds: () => Promise<void>;

  // 특정 피드의 아이템 카운트를 증감
  adjustFeedItemCount: (feedId: number, delta: number) => void;
}

export const useRSSStore = create<RSSStore>((set) => ({
  // Initial state
  feeds: [],
  categories: [],
  _initialized: false,
  searchQuery: '',

  // Data actions
  setFeeds: (feeds) => set({ feeds }),
  setCategories: (categories) => set({ categories }),
  addFeed: (feed) => set((state) => ({ feeds: [...state.feeds, feed] })),
  updateFeed: (updatedFeed) => set((state) => ({
    feeds: state.feeds.map(feed => feed.id === updatedFeed.id ? updatedFeed : feed)
  })),
  removeFeed: (id) => set((state) => ({
    feeds: state.feeds.filter(feed => feed.id !== id)
  })),
  addCategory: (category) => set((state) => ({ categories: [...state.categories, category] })),
  updateCategory: (updatedCategory) => set((state) => ({
    categories: state.categories.map(cat => cat.id === updatedCategory.id ? updatedCategory : cat)
  })),
  removeCategory: (id) => set((state) => ({
    categories: state.categories.filter(cat => cat.id !== id)
  })),

  // UI actions
  setSearchQuery: (searchQuery) => set({ searchQuery }),

  // 서버 초기 데이터로 초기화
  initializeFromServer: (categories, feeds) => set({
    categories,
    feeds,
    _initialized: true
  }),

  // 카테고리와 피드를 서버에서 새로 불러와 갱신
  refreshCategoriesWithFeeds: async () => {
    try {
      const categoriesWithFeeds = await listCategoriesWithFeeds();
      const normalizedCategories = (categoriesWithFeeds || []).map((c) => ({
        ...c,
        visible: c.visible ?? true,
        order: c.order ?? 0
      })).sort((a, b) => a.order - b.order);

      // 모든 피드를 추출
      const allFeeds: FeedSchema[] = [];
      for (const cat of categoriesWithFeeds || []) {
        if (cat.feeds) {
          allFeeds.push(...cat.feeds);
        }
      }

      set({
        categories: normalizedCategories,
        feeds: allFeeds,
        _initialized: true
      });
    } catch (error) {
      console.error('Failed to refresh categories with feeds:', error);
    }
  },

  // 특정 피드의 아이템 카운트를 증감 (낙관적 업데이트용)
  adjustFeedItemCount: (feedId, delta) => set((state) => ({
    feeds: state.feeds.map(feed => 
      feed.id === feedId 
        ? { ...feed, item_count: Math.max(0, feed.item_count + delta) }
        : feed
    )
  })),
}));
