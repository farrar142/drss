import { CategorySchema, FeedSchema, ItemSchema, SourceCreateSchema, SourceSchema } from "@/services/api";

// RSS 관련 타입 정의
export type RSSCategory = CategorySchema;

// 소스 타입 정의
export type SourceType = 'rss' | 'page_scraping' | 'detail_page_scraping';

// 브라우저 서비스 타입 정의
export type BrowserServiceType = 'realbrowser' | 'browserless';

// 피드 소스 스키마 - API의 SourceSchema와 일치
export type RSSSource = SourceSchema;

// 소스 생성용 스키마
export type RSSSourceCreate = SourceCreateSchema

export type RSSFeed = FeedSchema

export type RSSItem = ItemSchema;
