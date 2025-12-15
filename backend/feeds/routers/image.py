from ninja import Router, Schema
from ninja.responses import Response

router = Router()


class UrlParamSchema(Schema):
    url: str


@router.get("/", auth=None)
def cache_image_get(request, url: str):
    """Image caching has been removed. Return 410 Gone."""
    return Response({"error": "image caching removed"}, status=410)


@router.post("/", auth=None)
def cache_image_post(request, data: UrlParamSchema):
    """Image caching has been removed. Return 410 Gone."""
    return Response({"error": "image caching removed"}, status=410)
from ninja import Router, Schema
from ninja.responses import Response

router = Router()


class UrlParamSchema(Schema):
    url: str


@router.get("/", auth=None)
def cache_image_get(request, url: str):
    """Image caching has been removed. Return 410 Gone."""
    return Response({"error": "image caching removed"}, status=410)


@router.post("/", auth=None)
def cache_image_post(request, data: UrlParamSchema):
    """Image caching has been removed. Return 410 Gone."""
    return Response({"error": "image caching removed"}, status=410)
from typing import Optional
from ninja import Router, Schema

from ninja.responses import Response
from django.conf import settings
from django.core.cache import cache
import hashlib
from feeds.models import CachedImage
from django.db import DatabaseError
from feeds.tasks import cache_image_task

router = Router()


class UrlParamSchema(Schema):
    url: str


class UrlResponse(Schema):
    url: str
    width: Optional[int] = None
    height: Optional[int] = None


class ScheduledResponse(Schema):
    status: str


class ErrorResponse(Schema):
    error: str


@router.get("/", auth=None, response={200: UrlResponse, 404: ErrorResponse})
def cache_image_get(request, url: str):
    """GET: return cached image URL if available; do NOT schedule on GET."""
    # Use hashed cache key to avoid problematic characters in keys
        # Image-caching API has been removed. Return 410 Gone to indicate the endpoint is no
        # longer supported. Clients should fetch images directly and rely on browser caching.
        return Response({"error": "image caching removed"}, status=410)


@router.post("/", auth=None, response={200: UrlResponse, 202: ScheduledResponse})
def cache_image_post(request, data: UrlParamSchema):
    """POST: schedule caching if not present; return 200 with url if already cached, or 202 if scheduled."""
    url = data.url
        # Image-caching API has been removed. Return 410 Gone to indicate the endpoint is no
        # longer supported. Clients should fetch images directly and rely on browser caching.
        return Response({"error": "image caching removed"}, status=410)
