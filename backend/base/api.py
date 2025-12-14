from ninja import NinjaAPI

from .authentications import JWTAuth
from feeds.router import router as feeds_router

api = NinjaAPI(auth=JWTAuth(), urls_namespace="api")

api.add_router("/feeds", feeds_router)
