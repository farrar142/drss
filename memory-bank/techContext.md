# Technical Context - DRSS

## Technology Stack

### Backend Technologies
- **Framework**: Django 5.2+ with Python 3.13+
- **API Framework**: Django Ninja (FastAPI-style for Django)
- **Database**: PostgreSQL with psycopg2-binary
- **Cache/Message Broker**: Redis 5.0+
- **Task Queue**: Celery 5.6+ with Celery Beat for scheduling
- **Authentication**: PyJWT for token-based auth
- **Web Scraping**: 
  - BeautifulSoup4 for HTML parsing
  - Cloudscraper for anti-bot protection
  - Playwright for browser automation
- **File Storage**: 
  - AWS S3 with boto3
  - MinIO support for self-hosted storage
  - WhiteNoise for static file serving
- **HTTP Server**: Gunicorn with Uvicorn workers for async support

### Frontend Technologies
- **Framework**: Next.js 16+ with React 19
- **Styling**: TailwindCSS 4.1+ with PostCSS
- **State Management**: Zustand 5.0+
- **HTTP Client**: Axios 1.13+
- **UI Components**: 
  - Lucide React for icons
  - Class Variance Authority for component variants
- **Virtualization**: @tanstack/react-virtual for large lists
- **Utilities**: 
  - clsx and tailwind-merge for class management
  - html-react-parser for HTML content rendering
  - file-saver and jszip for export functionality
- **Testing**: Playwright for E2E testing
- **Development**: 
  - TypeScript 5+
  - ESLint 9 with Next.js config
  - OpenAPI TypeScript for API client generation
  - Orval for API code generation

### Mobile Technologies
- **Framework**: React Native with Expo
- **Platform**: Cross-platform iOS/Android

### Infrastructure & Deployment
- **Containerization**: Docker with multi-stage builds
- **Orchestration**: Docker Compose (dev and production configs)
- **Reverse Proxy**: Nginx with compression and caching
- **Environment Management**: dotenv for configuration
- **Process Management**: Gunicorn for production WSGI/ASGI

## Development Environment Setup

### Prerequisites
- Python 3.13+ (managed with pyenv)
- Node.js 18+ with npm
- Docker and Docker Compose
- PostgreSQL (via Docker)
- Redis (via Docker)

### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt  # or use uv for faster installs
python manage.py migrate
python manage.py runserver
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### Full Stack Development
```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down
```

## Key Dependencies

### Backend Dependencies (pyproject.toml)
- **Core**: django, django-ninja, psycopg2-binary
- **Authentication**: pyjwt, django-cors-headers
- **Tasks**: celery, django-celery-results, django-celery-beat, redis
- **Scraping**: feedparser, requests, beautifulsoup4, cloudscraper
- **Storage**: boto3, django-storages, whitenoise, Pillow
- **Server**: uvicorn, gunicorn
- **Utilities**: python-dotenv, returns, python-dateutil, django-redis

### Frontend Dependencies (package.json)
- **Core**: next, react, react-dom
- **Styling**: tailwindcss, postcss, clsx, tailwind-merge, class-variance-authority
- **State**: zustand
- **HTTP**: axios
- **UI**: lucide-react, html-react-parser
- **Virtualization**: @tanstack/react-virtual
- **Utilities**: file-saver, jszip
- **Development**: typescript, eslint, @playwright/test, orval, openapi-typescript

## Configuration Management

### Environment Variables
#### Backend (.env)
```bash
# Database
DATABASE_NAME=drss
DATABASE_USER=postgres
DATABASE_PASSWORD=password
DATABASE_HOST=localhost
DATABASE_PORT=5432

# Redis
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

# Django
SECRET_KEY=your-secret-key
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# Storage (optional)
USE_S3=False
USE_MINIO=False
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_STORAGE_BUCKET_NAME=
```

#### Frontend
- API endpoints configured via environment variables
- Build-time configuration for production optimization

### Docker Configuration
- **Development**: `compose.yml` with hot reload and debugging
- **Production**: `prod.compose.yml` with optimized builds and security

## API Architecture

### Django Ninja Setup
- **Auto-documentation**: OpenAPI spec at `/api/docs`
- **Type Safety**: Pydantic schemas for request/response validation
- **Authentication**: JWT middleware for protected endpoints
- **Error Handling**: Standardized error responses

### API Code Generation
```bash
# Frontend API client generation
cd frontend
npm run get-api      # Fetch OpenAPI spec from backend
npm run generate-api # Generate TypeScript client with Orval
```

### Schema Organization
- **Request/Response Schemas**: Defined in `backend/feeds/schemas/`
- **Service Layer**: Business logic in `backend/feeds/services/`
- **Router Layer**: API endpoints in `backend/feeds/router.py`

## Database Configuration

### PostgreSQL Setup
- **Connection Pooling**: Configured via Django settings
- **Migrations**: Django's built-in migration system
- **Indexing**: Strategic indexes for performance
- **Constraints**: Foreign key relationships with cascade deletion

### Redis Configuration
- **Cache Backend**: Django-Redis for caching
- **Session Storage**: Redis-based sessions
- **Celery Broker**: Message queue for background tasks
- **Result Backend**: Task result storage

## Background Processing

### Celery Configuration
- **Broker**: Redis for message passing
- **Workers**: Separate processes for task execution
- **Beat Scheduler**: Database-backed periodic task scheduling
- **Monitoring**: Task result tracking in database

### Task Organization
- **Feed Collection**: Periodic tasks for content gathering
- **Error Handling**: Comprehensive error capture and retry logic
- **Result Tracking**: All task executions logged in `FeedTaskResult`

## Security Configuration

### Authentication
- **JWT Tokens**: Stateless authentication
- **Token Expiration**: Configurable token lifetime
- **Refresh Tokens**: Secure token renewal

### CORS & CSRF
- **CORS**: Configured for cross-origin requests
- **CSRF**: Django's built-in protection
- **Secure Cookies**: Production security settings

### Input Validation
- **Pydantic Schemas**: API input validation
- **Django Forms**: Additional validation layers
- **SQL Injection**: ORM-based query protection

## Performance Optimization

### Caching Strategy
- **Redis Cache**: Frequently accessed data
- **HTTP Caching**: Static asset caching
- **Database Query Optimization**: Select related and prefetch related

### Static File Handling
- **WhiteNoise**: Static file serving in production
- **S3/MinIO**: Optional cloud storage for media files
- **CDN**: Content delivery network support

## Testing Strategy

### Backend Testing
- **Unit Tests**: Django TestCase for models and services
- **API Tests**: Django Ninja test client for endpoints
- **Integration Tests**: Full workflow testing

### Frontend Testing
- **E2E Tests**: Playwright for user workflow testing
- **Component Tests**: React component testing
- **API Contract Tests**: OpenAPI schema validation

## Deployment Architecture

### Development Deployment
- **Docker Compose**: Multi-service local development
- **Hot Reload**: File watching for development
- **Debug Mode**: Enhanced error reporting

### Production Deployment
- **Multi-stage Builds**: Optimized Docker images
- **Non-root Users**: Security hardening
- **Resource Limits**: CPU and memory constraints
- **Health Checks**: Application monitoring

### Monitoring & Logging
- **Application Logs**: Structured logging with context
- **Task Monitoring**: Celery task execution tracking
- **Error Tracking**: Comprehensive error capture
- **Performance Metrics**: Database and cache performance

## Development Workflow

### Code Organization
- **Domain-Driven**: Features organized by business domain
- **Service Layer**: Business logic separation
- **Schema-First**: API design with OpenAPI
- **Type Safety**: TypeScript and Pydantic for type checking

### Version Control
- **Git Workflow**: Feature branches with pull requests
- **Commit Standards**: Conventional commit messages
- **Code Review**: Required reviews for main branch

### Continuous Integration
- **Automated Testing**: Test suite execution on commits
- **Code Quality**: Linting and formatting checks
- **Security Scanning**: Dependency vulnerability checks
