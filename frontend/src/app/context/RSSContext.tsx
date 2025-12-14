'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { RSSCategory, RSSFeed, RSSItem } from '../types/rss';
import { useAuth } from './AuthContext';
import {
    feedsRouterListCategories,
    feedsRouterCreateCategory,
    feedsRouterUpdateCategory,
    feedsRouterDeleteCategory,
    feedsRouterListFeeds,
    feedsRouterCreateFeed,
    feedsRouterDeleteFeed,
    feedsRouterListFeedItems,
    feedsRouterMarkItemRead,
    feedsRouterToggleItemFavorite
} from '../services/api';

interface RSSContextType {
    categories: RSSCategory[];
    feeds: RSSFeed[];
    selectedCategory: RSSCategory | null;
    selectedFeed: RSSFeed | null;
    feedItems: RSSItem[];
    loading: boolean;
    error: string | null;

    // 카테고리 관련
    createCategory: (name: string, description: string) => Promise<void>;
    updateCategory: (id: number, name: string, description: string) => Promise<void>;
    deleteCategory: (id: number) => Promise<void>;

    // 피드 관련
    createFeed: (categoryId: number, url: string, title: string, description?: string, customHeaders?: any, refreshInterval?: number) => Promise<void>;
    deleteFeed: (id: number) => Promise<void>;
    selectCategory: (category: RSSCategory | null) => void;
    selectFeed: (feed: RSSFeed | null) => void;

    // 아이템 관련
    loadFeedItems: (feedId: number) => Promise<void>;
    markItemRead: (itemId: number) => Promise<void>;
    toggleItemFavorite: (itemId: number) => Promise<void>;

    refreshData: () => Promise<void>;
}

const RSSContext = createContext<RSSContextType | undefined>(undefined);

export const useRSS = () => {
    const context = useContext(RSSContext);
    if (!context) {
        throw new Error('useRSS must be used within an RSSProvider');
    }
    return context;
};

interface RSSProviderProps {
    children: ReactNode;
}

export const RSSProvider: React.FC<RSSProviderProps> = ({ children }) => {
    const [categories, setCategories] = useState<RSSCategory[]>([]);
    const [feeds, setFeeds] = useState<RSSFeed[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<RSSCategory | null>(null);
    const [selectedFeed, setSelectedFeed] = useState<RSSFeed | null>(null);
    const [feedItems, setFeedItems] = useState<RSSItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { logout, user } = useAuth();

    const refreshData = async () => {
        try {
            setLoading(true);
            setError(null);

            const [categoriesRes, feedsRes] = await Promise.all([
                feedsRouterListCategories(),
                feedsRouterListFeeds(),
            ]);

            setCategories(categoriesRes);
            setFeeds(feedsRes);
        } catch (err: any) {
            if (err.response?.status === 401) {
                logout();
            } else {
                setError(err.response?.data?.detail || '데이터 로드 실패');
            }
        } finally {
            setLoading(false);
        }
    }; useEffect(() => {
        if (user) {
            refreshData();
        } else {
            // 인증되지 않은 경우 데이터를 초기화
            setCategories([]);
            setFeeds([]);
            setFeedItems([]);
            setSelectedCategory(null);
            setSelectedFeed(null);
            setError(null);
        }
    }, [user]);

    const createCategory = async (name: string, description: string) => {
        try {
            await feedsRouterCreateCategory({ name, description });
            await refreshData();
        } catch (err: any) {
            throw new Error(err.response?.data?.detail || '카테고리 생성 실패');
        }
    };

    const updateCategory = async (id: number, name: string, description: string) => {
        try {
            await feedsRouterUpdateCategory(id, { name, description });
            await refreshData();
        } catch (err: any) {
            throw new Error(err.response?.data?.detail || '카테고리 수정 실패');
        }
    };

    const deleteCategory = async (id: number) => {
        try {
            await feedsRouterDeleteCategory(id);
            await refreshData();
        } catch (err: any) {
            throw new Error(err.response?.data?.detail || '카테고리 삭제 실패');
        }
    };

    const createFeed = async (categoryId: number, url: string, title: string, description?: string, customHeaders?: any, refreshInterval?: number) => {
        try {
            await feedsRouterCreateFeed({
                category_id: categoryId,
                url,
                title,
                description,
                custom_headers: customHeaders,
                refresh_interval: refreshInterval
            });
            await refreshData();
        } catch (err: any) {
            throw new Error(err.response?.data?.detail || '피드 생성 실패');
        }
    };

    const deleteFeed = async (id: number) => {
        try {
            await feedsRouterDeleteFeed(id);
            await refreshData();
        } catch (err: any) {
            throw new Error(err.response?.data?.detail || '피드 삭제 실패');
        }
    };

    const selectCategory = (category: RSSCategory | null) => {
        setSelectedCategory(category);
        setSelectedFeed(null);
        setFeedItems([]);
    };

    const selectFeed = (feed: RSSFeed | null) => {
        setSelectedFeed(feed);
        if (feed) {
            loadFeedItems(feed.id);
        } else {
            setFeedItems([]);
        }
    };

    const loadFeedItems = async (feedId: number) => {
        try {
            setLoading(true);
            const response = await feedsRouterListFeedItems(feedId);
            setFeedItems(response);
        } catch (err: any) {
            setError(err.response?.data?.detail || '아이템 로드 실패');
        } finally {
            setLoading(false);
        }
    };

    const markItemRead = async (itemId: number) => {
        try {
            await feedsRouterMarkItemRead(itemId);
            setFeedItems(items =>
                items.map(item =>
                    item.id === itemId ? { ...item, is_read: true } : item
                )
            );
        } catch (err: any) {
            throw new Error(err.response?.data?.detail || '읽음 표시 실패');
        }
    };

    const toggleItemFavorite = async (itemId: number) => {
        try {
            await feedsRouterToggleItemFavorite(itemId);
            setFeedItems(items =>
                items.map(item =>
                    item.id === itemId ? { ...item, is_favorite: !item.is_favorite } : item
                )
            );
        } catch (err: any) {
            throw new Error(err.response?.data?.detail || '즐겨찾기 토글 실패');
        }
    };

    const value: RSSContextType = {
        categories,
        feeds,
        selectedCategory,
        selectedFeed,
        feedItems,
        loading,
        error,
        createCategory,
        updateCategory,
        deleteCategory,
        createFeed,
        deleteFeed,
        selectCategory,
        selectFeed,
        loadFeedItems,
        markItemRead,
        toggleItemFavorite,
        refreshData,
    };

    return (
        <RSSContext.Provider value={value}>
            {children}
        </RSSContext.Provider>
    );
};