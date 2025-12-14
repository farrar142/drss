from ninja import NinjaAPI

from .authentications import JWTAuth

api = NinjaAPI(auth=JWTAuth(), urls_namespace="api")
