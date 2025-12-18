# DRSS - RSS Reader Application

## Architecture Overview

Full-stack RSS reader with Django Ninja backend and Next.js frontend, running in Docker.

```
backend/                    # Django 5.2 + Django Ninja API
├── base/                   # Core config, auth, API routing
│   ├── api.py             # NinjaAPI instance with routers
│   ├── paginations.py     # CursorPagination implementation
│   └── authentications.py # JWTAuth
├── feeds/                  # Main domain
│   ├── router.py          # API endpoints (category, feed, item, source)
│   ├── models.py          # RSSCategory, RSSFeed, RSSItem, RSSEverythingSource
│   ├── services/          # Business logic layer (CategoryService, FeedService, etc.)
│   ├── schemas/           # Ninja Schema definitions
│   └── tasks.py           # Celery tasks for RSS fetching

frontend/                   # Next.js 16 (App Router)
├── app/                   # Route pages
├── src/
│   ├── components/        # React components (FeedViewer, MediaModal, etc.)
│   ├── hooks/             # usePagination, useFeedViewer, useCruising
│   ├── stores/            # Zustand stores (settingsStore)
│   └── services/api.ts    # Auto-generated from OpenAPI (via Orval)
```

## Developer Workflow

### Running the Stack
```bash
docker compose up                    # django (8000), node (3000)
docker compose --profile celery up   # Include Celery worker/beat
docker compose --profile crawler up  # Include browserless/puppeteer
```

### API Code Generation (Critical)
When backend API changes, regenerate frontend types:
```bash
cd frontend && npm run api           # Fetches openapi.json + runs orval
```
This generates `src/services/api.ts` from `backend/openapi.json`.

### Type Checking
```bash
cd frontend && npm run build         # TypeScript strict check
```

## Key Patterns

### Backend: Service Layer Pattern
All business logic goes through services, routers only handle HTTP concerns:
```python
# feeds/router.py
@item_router.get("/category/{category_id}", response=list[ItemSchema])
@paginate(CursorPagination[RSSItem], ordering_field="published_at")
def list_items_by_category(request, category_id: int, ...):
    return ItemService.list_items(request.auth, category_id=category_id, ...)
```

### Backend: CursorPagination
Use `@paginate(CursorPagination[Model], ordering_field="field")` for paginated endpoints. Returns `{ items, has_next, next_cursor, prev_cursor }`.

### Frontend: usePagination Hook
Standard pattern for paginated data fetching:
```tsx
const { items, handleLoadMore, handleLoadNew, hasNext } = usePagination<RSSItem>(
  (args) => feedsRouterListItemsByCategory(categoryId, args),
  (item) => item.published_at,  // cursor field extractor
  `category-${categoryId}`,     // cache key
  filters                        // optional filters
);
```

### Frontend: Zustand Stores
State management via Zustand with persist middleware. See `stores/settingsStore.ts` for pattern.

### Frontend: Component Structure
- Container components use hooks (`FeedViewer` → `useFeedViewer`)
- View components receive props (`FeedViewerView`)
- Performance-critical components wrapped with `React.memo`

## Data Flow

1. **RSS Fetching**: Celery tasks (`feeds/tasks.py`) fetch RSS feeds periodically
2. **API Layer**: Django Ninja routers expose REST endpoints with JWT auth
3. **Frontend Sync**: Orval generates typed API clients from OpenAPI spec
4. **State**: Zustand stores + `usePagination` hook manage frontend state

## Important Files

- `backend/feeds/models.py` - Core domain models
- `backend/base/paginations.py` - Custom cursor pagination
- `frontend/src/hooks/usePagination.ts` - Bidirectional pagination
- `frontend/orval.config.ts` - API client generation config
- `compose.yml` - Docker service definitions
