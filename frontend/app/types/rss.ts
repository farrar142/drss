// RSS 관련 타입 정의
export interface RSSCategory {
    id: number;
    name: string;
    description: string;
    visible: boolean;
}

export interface RSSFeed {
    id: number;
    category_id: number;
    url: string;
    title: string;
    favicon_url?: string;
    description: string;
    visible: boolean;
    custom_headers?: Record<string, any>;
    refresh_interval?: number;
    last_updated: string;
    item_count: number;
}

export interface RSSItem {
    id: number;
    feed_id: number;
    title: string;
    link: string;
    description: string;
    published_at: string;
    is_read: boolean;
    is_favorite: boolean;
}
