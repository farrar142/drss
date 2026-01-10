# System Patterns - DRSS

## Architecture Overview

### Multi-Tier Architecture
```
Frontend (Next.js) ←→ API (Django Ninja) ←→ Database (PostgreSQL)
                              ↓
                         Background Jobs (Celery)
                              ↓
                         Message Broker (Redis)
```

### Key Architectural Decisions

#### 1. API-First Design
- **Django Ninja**: Type-safe API with automatic OpenAPI documentation
- **Schema Validation**: Pydantic models ensure data integrity
- **Separation of Concerns**: Clear boundary between frontend and backend
- **Code Generation**: Frontend API client generated from OpenAPI spec

#### 2. Background Processing Pattern
- **Celery Integration**: All content collection happens asynchronously
- **Task Result Tracking**: Every job execution is logged in `FeedTaskResult`
- **Scheduled Tasks**: Celery Beat handles periodic feed updates
- **Error Handling**: Comprehensive error capture and user feedback

#### 3. Multi-Source Feed Pattern
- **1:N Relationship**: `RSSFeed` → `RSSEverythingSource`
- **Source Type Strategy**: Different handlers for RSS, scraping, detail scraping
- **Unified Output**: All sources produce standardized `RSSItem` objects
- **Independent Processing**: Each source can fail without affecting others

## Data Model Patterns

### User-Scoped Data Hierarchy
```
User
├── RSSCategory (user-scoped)
│   └── RSSFeed (category-scoped)
│       ├── RSSItem (feed-scoped)
│       ├── RSSEverythingSource (feed-scoped)
│       └── FeedTaskResult (feed-scoped)
```

### Key Model Relationships
- **Cascade Deletion**: User deletion removes all related data
- **Soft Dependencies**: Feeds can exist without active sources
- **Status Tracking**: Items track read/favorite status per user
- **Audit Trail**: Task results provide complete execution history

## Processing Patterns

### Content Collection Pipeline
1. **Source Discovery**: Identify active sources for processing
2. **Content Extraction**: Type-specific extraction (RSS/scraping)
3. **Data Normalization**: Convert to standard `RSSItem` format
4. **Deduplication**: Prevent duplicate items using GUID
5. **Storage**: Persist items with proper relationships
6. **Result Logging**: Record success/failure in `FeedTaskResult`

### Error Handling Strategy
- **Graceful Degradation**: Individual source failures don't break feeds
- **Detailed Logging**: All errors captured with context
- **User Feedback**: Clear error messages in UI
- **Retry Logic**: Automatic retry for transient failures

## Frontend Patterns

### Component Architecture
- **Server Components**: Static content and initial data loading
- **Client Components**: Interactive UI and real-time updates
- **Custom Hooks**: Reusable logic for data fetching and state management
- **Context Providers**: Global state for authentication and app settings

### State Management
- **Zustand**: Lightweight state management for client-side data
- **Server State**: Next.js handles server-side rendering and caching
- **Local Storage**: Persist user preferences and UI state
- **Optimistic Updates**: Immediate UI feedback with server sync

## Security Patterns

### Authentication & Authorization
- **JWT Tokens**: Stateless authentication for API access
- **User Isolation**: All queries filtered by authenticated user
- **CORS Configuration**: Controlled cross-origin access
- **CSRF Protection**: Django's built-in CSRF middleware

### Data Protection
- **Input Validation**: Pydantic schemas validate all API inputs
- **SQL Injection Prevention**: Django ORM prevents direct SQL
- **XSS Protection**: Template auto-escaping and CSP headers
- **Secure Headers**: Production security headers via middleware

## Performance Patterns

### Database Optimization
- **Strategic Indexing**: Indexes on frequently queried fields
- **Query Optimization**: Select related data to minimize queries
- **Connection Pooling**: Efficient database connection management
- **Pagination**: Large datasets handled with cursor-based pagination

### Caching Strategy
- **Redis Cache**: Frequently accessed data cached in Redis
- **HTTP Caching**: Static assets cached with appropriate headers
- **Query Caching**: Database query results cached when appropriate
- **CDN Integration**: Static files served via CDN (S3/MinIO)

### Background Processing
- **Queue Management**: Celery queues prevent system overload
- **Rate Limiting**: Respectful scraping with delays between requests
- **Resource Limits**: Memory and CPU limits prevent resource exhaustion
- **Monitoring**: Task execution monitoring and alerting

## Integration Patterns

### Web Scraping Integration
- **Pluggable Scrapers**: Different scraping strategies for different source types
- **Browser Automation**: Playwright for JavaScript-heavy sites
- **Fallback Mechanisms**: Multiple extraction strategies per source
- **Content Cleaning**: HTML sanitization and content normalization

## Development Patterns

### Code Organization
- **Domain-Driven Structure**: Code organized by business domain (feeds, users)
- **Service Layer**: Business logic separated from API controllers
- **Schema Definitions**: Centralized API schema definitions
- **Utility Modules**: Shared utilities and helper functions

### Testing Strategy
- **Unit Tests**: Individual component and function testing
- **Integration Tests**: API endpoint and database integration testing
- **E2E Tests**: Full user workflow testing with Playwright
- **Schema Validation**: API contract testing with OpenAPI

### Deployment Patterns
- **Containerization**: Docker containers for consistent environments
- **Multi-Stage Builds**: Optimized production images
- **Environment Configuration**: Environment-specific settings
- **Health Checks**: Application health monitoring and alerting

## Scalability Patterns

### Horizontal Scaling
- **Stateless Design**: Application servers can be scaled horizontally
- **Database Replication**: Read replicas for improved performance
- **Load Balancing**: Traffic distribution across multiple instances
- **Queue Scaling**: Celery workers can be scaled independently

### Vertical Scaling
- **Resource Optimization**: Efficient memory and CPU usage
- **Connection Pooling**: Database connection optimization
- **Caching Layers**: Multiple levels of caching for performance
- **Background Processing**: Heavy work moved to background queues
