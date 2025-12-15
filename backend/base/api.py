from ninja import NinjaAPI

from .authentications import JWTAuth
from users.router import router as auth_router
from feeds.routers.feed import router as feeds_router
from feeds.routers.category import router as category_router
from feeds.routers.item import router as item_router
from feeds.routers.image import router as image_router

api = NinjaAPI(auth=JWTAuth(), urls_namespace="api")

api.add_router("/feeds", feeds_router)
api.add_router("/categories", category_router)
api.add_router("/items", item_router)
api.add_router("/auth", auth_router)
api.add_router("/images", image_router)
