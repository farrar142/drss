from os import name
from ninja import Router
from django.shortcuts import get_object_or_404
from feeds.models import RSSCategory, RSSFeed, RSSItem
from base.authentications import JWTAuth

from ..schemas import *

router = Router()


@router.get("/", response=list[CategorySchema], auth=JWTAuth())
def list_categories(request):
    categories = RSSCategory.objects.filter(user=request.auth)
    return categories


@router.post("/", response=CategorySchema, auth=JWTAuth())
def create_category(request, data: CategoryCreateSchema):
    category = RSSCategory.objects.create(
        user=request.auth, name=data.name, description=data.description
    )
    return category


@router.put("/{category_id}", response=CategorySchema, auth=JWTAuth())
def update_category(request, category_id: int, data: CategoryCreateSchema):
    category = get_object_or_404(RSSCategory, id=category_id, user=request.auth)
    category.name = data.name
    category.description = data.description
    category.save()
    return category


@router.delete("/{category_id}", auth=JWTAuth())
def delete_category(request, category_id: int):
    category = get_object_or_404(RSSCategory, id=category_id, user=request.auth)
    category.delete()
    return {"success": True}


@router.post("/{category_id}/refresh", auth=JWTAuth())
def refresh_category_feeds(request, category_id: int):
    from feeds.tasks import update_feeds_by_category

    category = get_object_or_404(RSSCategory, id=category_id, user=request.auth)
    # 비동기로 실행
    update_feeds_by_category.delay(category.pk)
    return {"success": True, "message": "Category feeds refresh scheduled"}


@router.get("/{category_id}/stats", auth=JWTAuth())
def get_category_stats(request, category_id: int):
    category = get_object_or_404(RSSCategory, id=category_id, user=request.auth)
    feeds = RSSFeed.objects.filter(category=category)

    total_items = RSSItem.objects.filter(feed__in=feeds).count()
    unread_items = RSSItem.objects.filter(feed__in=feeds, is_read=False).count()
    favorite_items = RSSItem.objects.filter(feed__in=feeds, is_favorite=True).count()

    return {
        "total_items": total_items,
        "unread_items": unread_items,
        "favorite_items": favorite_items,
    }
