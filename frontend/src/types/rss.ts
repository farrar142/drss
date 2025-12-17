// RSS 관련 타입 정의
export interface RSSCategory {
    id: number;
    name: string;
    description: string;
    visible: boolean;
    order: number;
}

// 소스 타입 정의
export type SourceType = 'rss' | 'page_scraping' | 'detail_page_scraping';

// 피드 소스 스키마 - API의 SourceSchema와 일치
export interface RSSSource {
    id: number;
    feed_id: number;
    source_type: SourceType;
    is_active: boolean;
    url: string;
    custom_headers?: Record<string, unknown>;

    // 스크래핑용 셀렉터
    item_selector?: string;
    title_selector?: string;
    link_selector?: string;
    description_selector?: string;
    date_selector?: string;
    image_selector?: string;

    // 상세 페이지용 셀렉터
    detail_title_selector?: string;
    detail_description_selector?: string;
    detail_content_selector?: string;
    detail_date_selector?: string;
    detail_image_selector?: string;

    // 기타 설정
    exclude_selectors?: string[];
    date_formats?: string[];
    date_locale?: string;
    use_browser?: boolean;
    wait_selector?: string;
    timeout?: number;

    last_crawled_at?: string | null;
    last_error?: string;
}

// 소스 생성용 스키마
export interface RSSSourceCreate {
    source_type: SourceType;
    url: string;
    custom_headers?: Record<string, any>;

    // 스크래핑용 셀렉터
    item_selector?: string;
    title_selector?: string;
    link_selector?: string;
    description_selector?: string;
    date_selector?: string;
    image_selector?: string;

    // 상세 페이지용 셀렉터
    detail_title_selector?: string;
    detail_description_selector?: string;
    detail_content_selector?: string;
    detail_date_selector?: string;
    detail_image_selector?: string;

    // 기타 설정
    exclude_selectors?: string[];
    date_formats?: string[];
    date_locale?: string;
    use_browser?: boolean;
    wait_selector?: string;
    timeout?: number;
}

export interface RSSFeed {
    id: number;
    category_id: number;
    title: string;
    favicon_url?: string;
    description: string;
    visible: boolean;
    refresh_interval?: number;
    last_updated: string;
    item_count: number;
    sources?: RSSSource[];
}

export interface RSSItem {
    id: number;
    feed_id: number;
    title: string;
    link: string;
    description: string;
    author?: string;
    categories?: string[];
    published_at: string;
    is_read: boolean;
    is_favorite: boolean;
}
