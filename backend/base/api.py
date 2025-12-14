from ninja import NinjaAPI

from .authentications import JWTAuth
from feeds.router import router as feeds_router
from users.router import router as auth_router

api = NinjaAPI(auth=JWTAuth(), urls_namespace="api")

api.add_router("/feeds", feeds_router)
api.add_router("/auth", auth_router)
