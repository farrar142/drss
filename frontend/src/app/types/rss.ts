// RSS 관련 타입 정의
export interface RSSCategory {
    id: number;
    name: string;
    description: string;
}

export interface RSSFeed {
    id: number;
    category_id: number;
    url: string;
    title: string;
    description: string;
    visible: boolean;
    last_updated: string;
}

export interface RSSItem {
    id: number;
    title: string;
    link: string;
    description: string;
    published_at: string;
    is_read: boolean;
    is_favorite: boolean;
}