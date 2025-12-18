# DRSS (Dynamic RSS) - Project Brief

## Project Overview
DRSS is a comprehensive RSS feed management and web scraping platform that allows users to subscribe to RSS feeds and scrape web content through a unified interface. The project combines traditional RSS feed consumption with advanced web scraping capabilities to create a flexible content aggregation system.

## Core Requirements

### Primary Goals
1. **RSS Feed Management**: Traditional RSS/Atom feed subscription and management
2. **Web Scraping Integration**: CSS selector-based content extraction from web pages
3. **Multi-Source Support**: Single feeds can aggregate content from multiple sources
4. **User Isolation**: Complete data separation between users
5. **Automated Collection**: Background processing for content updates

### Key Features
- **Category-based Organization**: User-defined categories for feed organization
- **Three Source Types**:
  - RSS: Traditional RSS/Atom feeds
  - Page Scraping: Direct web page content extraction
  - Detail Page Scraping: List page + individual article scraping
- **Browser Rendering**: JavaScript-enabled scraping using Playwright
- **Custom Headers**: Authentication and special request header support
- **Task Monitoring**: Complete tracking of collection job results
- **Read/Favorite Status**: Item-level user interaction tracking

## Technical Architecture

### Stack Requirements
- **Backend**: Django 5.2+ with Django Ninja for API
- **Database**: PostgreSQL for data persistence
- **Cache/Queue**: Redis for caching and message brokering
- **Async Processing**: Celery + Celery Beat for background tasks
- **Frontend**: Next.js 16+ with React 19
- **Mobile**: React Native (Expo)
- **Deployment**: Docker Compose with production optimization

### Core Models
1. **User**: Authentication and data ownership
2. **RSSCategory**: Feed organization (user-scoped)
3. **RSSFeed**: Feed definitions (category-scoped)
4. **RSSItem**: Individual content items (feed-scoped)
5. **RSSEverythingSource**: Source configurations (feed-scoped, 1:N)
6. **FeedTaskResult**: Job execution tracking (feed-scoped)

## Success Criteria
- Users can create categories and organize feeds
- Multiple source types work reliably (RSS, scraping, detail scraping)
- Background processing handles content collection automatically
- Web interface provides intuitive feed and content management
- System scales to handle multiple users and feeds
- Error handling and monitoring provide clear feedback

## Constraints
- All data must be user-scoped for privacy
- Background processing must be reliable and monitorable
- Web scraping must handle JavaScript-rendered content
- API must be type-safe and well-documented
- System must support both development and production deployment

## Out of Scope (Current Phase)
- Real-time notifications
- Social features or sharing
- Advanced analytics or reporting
- Third-party integrations beyond basic web scraping
- Mobile app advanced features beyond basic viewing
