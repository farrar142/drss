# Active Context - DRSS

## Current Work Focus
**Memory Bank Creation and Organization** - Establishing comprehensive documentation structure for the DRSS project to enable effective context preservation across sessions.

## Recent Changes
- **Memory Bank Structure**: Created Cline-compatible memory bank with core files:
  - `projectbrief.md`: Foundation document with project scope and requirements
  - `productContext.md`: User problems, solutions, and experience goals
  - `systemPatterns.md`: Architecture patterns and technical decisions
  - `techContext.md`: Technology stack and development setup
  - `activeContext.md`: Current work status and next steps (this file)

## Next Steps
1. **Complete Memory Bank Setup**: Create remaining core files
   - `progress.md`: Current implementation status and what's working
2. **Validate Documentation**: Ensure all critical project information is captured
3. **Establish Update Workflow**: Define when and how to maintain memory bank

## Active Decisions and Considerations

### Documentation Strategy
- **Cline Memory Bank Pattern**: Following structured approach for session continuity
- **Hierarchical Organization**: Core files build upon each other logically
- **Comprehensive Coverage**: All aspects of project captured in appropriate files

### Project Understanding
- **Multi-Source RSS Platform**: Core value is combining traditional RSS with web scraping
- **Background Processing**: Celery-based async processing is critical for user experience
- **Type Safety**: Strong emphasis on API contracts and schema validation
- **User Isolation**: All data strictly scoped to individual users

## Important Patterns and Preferences

### Code Organization
- **Domain-Driven Structure**: Features organized by business domain (feeds, users)
- **Service Layer Pattern**: Business logic separated from API controllers
- **Schema-First API**: Pydantic schemas define API contracts
- **Background Job Tracking**: All async operations logged with detailed results

### Technical Preferences
- **Django Ninja**: Chosen over DRF for FastAPI-style development experience
- **Multi-Source Feeds**: 1:N relationship between feeds and sources is key architectural decision
- **CSS Selector-Based Scraping**: Flexible content extraction approach
- **Browser Automation**: Playwright for JavaScript-heavy sites

### Development Workflow
- **API Code Generation**: Frontend client generated from OpenAPI spec
- **Docker-First**: All development and deployment via containers
- **Type Safety**: TypeScript frontend + Pydantic backend for end-to-end type safety

## Learnings and Project Insights

### Architecture Insights
- **Multi-Source Pattern**: Allows feeds to aggregate content from multiple sources (RSS + scraping)
- **Task Result Tracking**: `FeedTaskResult` model provides comprehensive job monitoring
- **User-Scoped Data**: All models cascade from User for complete data isolation
- **Async Processing**: Heavy lifting (scraping, RSS fetching) moved to background

### Technical Insights
- **Django Ninja Benefits**: Automatic OpenAPI generation + FastAPI-style development
- **Celery Integration**: Database-backed beat scheduler for reliable periodic tasks
- **Redis Multi-Purpose**: Cache, session storage, and message broker in one
- **Next.js App Router**: Server/client component split for optimal performance

### Implementation Insights
- **Source Type Strategy**: Different handlers for RSS vs scraping vs detail scraping
- **Error Handling**: Graceful degradation - individual source failures don't break feeds
- **Content Normalization**: All sources produce standardized `RSSItem` objects
- **Security First**: JWT auth + user isolation + input validation throughout

## Current Implementation Status

### What's Working
- **Core Models**: Complete data model with proper relationships and indexes
- **API Structure**: Django Ninja setup with schema validation
- **Background Processing**: Celery integration with task result tracking
- **Multi-Source Support**: Three source types (RSS, scraping, detail scraping)
- **Frontend Foundation**: Next.js setup with API client generation
- **Development Environment**: Docker Compose for full-stack development

### What Needs Attention
- **Production Deployment**: Optimization and security hardening
- **Error Handling**: User-friendly error messages and recovery
- **Performance**: Caching strategy and query optimization
- **Testing**: Comprehensive test coverage for all components
- **Monitoring**: Production monitoring and alerting setup

## Key Files and Locations

### Backend Core
- `backend/feeds/models.py`: Data models and relationships
- `backend/feeds/router.py`: API endpoints and routing
- `backend/feeds/tasks.py`: Celery background tasks
- `backend/feeds/schemas/`: API request/response schemas
- `backend/feeds/services/`: Business logic layer

### Frontend Core
- `frontend/src/components/`: React components
- `frontend/src/hooks/`: Custom hooks for data fetching
- `frontend/src/stores/`: Zustand state management
- `frontend/app/`: Next.js App Router pages

### Configuration
- `compose.yml`: Development Docker setup
- `prod.compose.yml`: Production Docker setup
- `backend/base/settings.py`: Django configuration
- `frontend/next.config.ts`: Next.js configuration

## Development Context

### Current Environment
- **Python**: 3.13+ with Django 5.2+
- **Node.js**: 18+ with Next.js 16+
- **Database**: PostgreSQL via Docker
- **Cache/Queue**: Redis via Docker
- **Development**: Docker Compose for full stack

### Key Commands
```bash
# Full stack development
docker compose up -d

# API client generation
cd frontend && npm run api

# Database migrations
cd backend && python manage.py migrate

# Background workers
cd backend && celery -A celery_app worker -l info
```

## Project Priorities
1. **Reliability**: Background processing must be robust and monitorable
2. **User Experience**: Simple setup for RSS feeds, intuitive scraping configuration
3. **Performance**: Handle multiple users and feeds efficiently
4. **Security**: Complete user data isolation and input validation
5. **Maintainability**: Clear code organization and comprehensive documentation
