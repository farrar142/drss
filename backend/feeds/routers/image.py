from ninja import Router, Schema

from ninja.responses import Response
from django.conf import settings
from feeds.models import CachedImage
from django.db import DatabaseError
from feeds.tasks import cache_image_task

router = Router()


class UrlParamSchema(Schema):
    url: str


class UrlResponse(Schema):
    url: str


class ScheduledResponse(Schema):
    status: str


class ErrorResponse(Schema):
    error: str


@router.get("/", auth=None, response={200: UrlResponse, 404: ErrorResponse})
def cache_image_get(request, url: str):
    """GET: return cached image URL if available; do NOT schedule on GET."""
    try:
        ci = CachedImage.objects.filter(original_url=url).first()
    except DatabaseError:
        # DB not available -> behave as not found
        return Response({"error": "not found"}, status=404)

    if not ci:
        return Response({"error": "not found"}, status=404)

    abs_url = request.build_absolute_uri(ci.url())
    return {"url": abs_url}


@router.post("/", auth=None, response={200: UrlResponse, 202: ScheduledResponse})
def cache_image_post(request, data: UrlParamSchema):
    """POST: schedule caching if not present; return 200 with url if already cached, or 202 if scheduled."""
    url = data.url
    try:
        ci = CachedImage.objects.filter(original_url=url).first()
    except DatabaseError:
        cache_image_task.delay(url)
        headers = {"Location": request.build_absolute_uri(f"/api/feeds/cache-image?url={url}")}
        return Response({"status": "scheduled"}, status=202, headers=headers)

    if ci:
        abs_url = request.build_absolute_uri(ci.url())
        return {"url": abs_url}

    cache_image_task.delay(url)
    headers = {"Location": request.build_absolute_uri(f"/api/feeds/cache-image?url={url}")}
    return Response({"status": "scheduled"}, status=202, headers=headers)
