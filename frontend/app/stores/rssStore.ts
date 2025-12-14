import { create } from 'zustand';
import { RSSFeed, RSSCategory } from '../types/rss';
import { FeedSchema } from '../services/api';

interface RSSStore {
    // Data
    feeds: FeedSchema[];
    categories: RSSCategory[];

    // UI State
    searchQuery: string;
    filter: 'all' | 'unread' | 'read' | 'favorite';
    viewMode: 'titles' | 'categories';

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
    setFilter: (filter: 'all' | 'unread' | 'read' | 'favorite') => void;
    setViewMode: (mode: 'titles' | 'categories') => void;
}

export const useRSSStore = create<RSSStore>((set) => ({
    // Initial state
    feeds: [],
    categories: [],
    searchQuery: '',
    filter: 'all',
    viewMode: 'categories',

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
    setFilter: (filter) => set({ filter }),
    setViewMode: (viewMode) => set({ viewMode }),
}));