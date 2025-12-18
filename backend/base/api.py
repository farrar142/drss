from ninja import NinjaAPI, Redoc

from .authentications import JWTAuth
from users.router import router as auth_router
from feeds.routers import (
    feed_router,
    category_router,
    item_router,
    rss_everything_router,
    task_results_router,
    periodic_task_router,
)

api = NinjaAPI(auth=JWTAuth(), urls_namespace="api")

api.add_router("/feeds", feed_router)
api.add_router("/categories", category_router)
api.add_router("/items", item_router)
api.add_router("/auth", auth_router)
api.add_router("/rss-everything", rss_everything_router)
api.add_router("/task-results", task_results_router)
api.add_router("/periodic-tasks", periodic_task_router)


@api.get("/health", auth=None)
def health_check(request):
    return {"status": "ok"}
