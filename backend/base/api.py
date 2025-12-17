from ninja import NinjaAPI

from .authentications import JWTAuth
from users.router import router as auth_router
from feeds.router import (
    feed_router,
    category_router,
    item_router,
    source_router,
    task_result_router,
)

api = NinjaAPI(auth=JWTAuth(), urls_namespace="api")

api.add_router("/feeds", feed_router)
api.add_router("/categories", category_router)
api.add_router("/items", item_router)
api.add_router("/auth", auth_router)
api.add_router("/rss-everything", source_router)
api.add_router("/task-results", task_result_router)


@api.get("/health", auth=None)
def health_check(request):
    return {"status": "ok"}
