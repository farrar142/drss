from ninja import Schema, Router
from typing import List, Optional
from django.shortcuts import get_object_or_404
from django.db import models
from feeds.models import RSSCategory, RSSFeed, RSSItem
from base.authentications import JWTAuth
import feedparser
import requests
from datetime import datetime
from feeds.utils import fetch_feed_data, extract_favicon_url

router = Router()


class CategorySchema(Schema):
    id: int
    name: str
    description: str


class CategoryCreateSchema(Schema):
    name: str
    description: str = ""


class FeedSchema(Schema):
    id: int
    category_id: int
    url: str
    title: str
    favicon_url: str = ""
    description: str
    visible: bool
    custom_headers: dict = {}
    refresh_interval: int = 60
    last_updated: datetime
    item_count: int


class FeedCreateSchema(Schema):
    category_id: int
    url: str
    title: str = ""
    description: str = ""
    visible: bool = True
    custom_headers: dict = {}
    refresh_interval: int = 60


class FeedUpdateSchema(Schema):
    category_id: Optional[int] = None
    url: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    visible: Optional[bool] = None
    custom_headers: Optional[dict] = None
    refresh_interval: Optional[int] = None


class FeedValidationResponse(Schema):
    title: str
    description: str
    items_count: int
    latest_item_date: str = None


class FeedValidationRequest(Schema):
    url: str
    custom_headers: dict = {}


class ItemSchema(Schema):
    id: int
    feed_id: int
    title: str
    link: str
    description: str
    published_at: str
    is_read: bool
    is_favorite: bool


@router.post("/feeds/validate", response=FeedValidationResponse, auth=JWTAuth())
def validate_feed(request, data: FeedValidationRequest):
    try:
        feed = fetch_feed_data(data.url, data.custom_headers)

        title = feed.feed.get("title", "Unknown Title")
        description = feed.feed.get("description", "")

        items_count = len(feed.entries)
        latest_item_date = None

        if feed.entries:
            # 최신 아이템의 날짜 찾기
            dates = []
            for entry in feed.entries:
                if hasattr(entry, "published_parsed") and entry.published_parsed:
                    dates.append(datetime(*entry.published_parsed[:6]))
                elif hasattr(entry, "updated_parsed") and entry.updated_parsed:
                    dates.append(datetime(*entry.updated_parsed[:6]))

            if dates:
                latest_item_date = max(dates).isoformat()

        return {
            "title": title,
            "description": description,
            "items_count": items_count,
            "latest_item_date": latest_item_date,
        }

    except Exception as e:
        from ninja import HttpError

        raise HttpError(400, f"Failed to validate feed: {str(e)}")


@router.get("/categories", response=List[CategorySchema], auth=JWTAuth())
def list_categories(request):
    categories = RSSCategory.objects.filter(user=request.auth)
    return categories


@router.post("/categories", response=CategorySchema, auth=JWTAuth())
def create_category(request, data: CategoryCreateSchema):
    category = RSSCategory.objects.create(
        user=request.auth, name=data.name, description=data.description
    )
    return category


@router.put("/categories/{category_id}", response=CategorySchema, auth=JWTAuth())
def update_category(request, category_id: int, data: CategoryCreateSchema):
    category = get_object_or_404(RSSCategory, id=category_id, user=request.auth)
    category.name = data.name
    category.description = data.description
    category.save()
    return category


@router.delete("/categories/{category_id}", auth=JWTAuth())
def delete_category(request, category_id: int):
    category = get_object_or_404(RSSCategory, id=category_id, user=request.auth)
    category.delete()
    return {"success": True}


@router.get("/feeds", response=List[FeedSchema], auth=JWTAuth())
def list_feeds(request):
    from django.db.models import Count

    feeds = RSSFeed.objects.filter(user=request.auth).annotate(
        item_count=Count("rssitem", filter=models.Q(rssitem__is_read=False))
    )
    return feeds


@router.post("/feeds", response=FeedSchema, auth=JWTAuth())
def create_feed(request, data: FeedCreateSchema):
    category = get_object_or_404(RSSCategory, id=data.category_id, user=request.auth)

    title = data.title
    favicon_url = ""
    description = data.description

    # 제목이 제공되지 않은 경우 RSS 피드를 파싱해서 메타데이터 추출
    if not title:
        try:
            feed = fetch_feed_data(data.url, data.custom_headers)

            # RSS 피드에서 제목 추출
            title = feed.feed.get("title", "Unknown Title")
            description = description or feed.feed.get("description", "")

            # Favicon 추출 시도
            favicon_url = extract_favicon_url(data.url, data.custom_headers)

        except Exception as e:
            # RSS 파싱 실패 시 기본값 사용
            if not title:
                title = "Unknown Feed"
            if not description:
                description = ""

    feed = RSSFeed.objects.create(
        user=request.auth,
        category=category,
        url=data.url,
        title=title,
        favicon_url=favicon_url,
        description=description,
        visible=data.visible,
        custom_headers=data.custom_headers,
        refresh_interval=data.refresh_interval,
    )
    # item_count 추가
    from django.db.models import Count

    feed_with_count = (
        RSSFeed.objects.filter(id=feed.id)
        .annotate(item_count=Count("rssitem", filter=models.Q(rssitem__is_read=False)))
        .first()
    )
    return feed_with_count


@router.put("/feeds/{feed_id}", response=FeedSchema, auth=JWTAuth())
def update_feed(request, feed_id: int, data: FeedUpdateSchema):
    feed = get_object_or_404(RSSFeed, id=feed_id, user=request.auth)

    if data.category_id is not None:
        category = get_object_or_404(
            RSSCategory, id=data.category_id, user=request.auth
        )
        feed.category = category

    if data.url is not None:
        feed.url = data.url
    if data.title is not None:
        feed.title = data.title
    if data.description is not None:
        feed.description = data.description
    if data.visible is not None:
        feed.visible = data.visible
    if data.custom_headers is not None:
        feed.custom_headers = data.custom_headers
    if data.refresh_interval is not None:
        feed.refresh_interval = data.refresh_interval

    feed.save()
    # item_count 추가
    from django.db.models import Count

    feed_with_count = (
        RSSFeed.objects.filter(id=feed.id)
        .annotate(item_count=Count("rssitem", filter=models.Q(rssitem__is_read=False)))
        .first()
    )
    return feed_with_count


@router.post("/feeds/{feed_id}/refresh", auth=JWTAuth())
def refresh_feed(request, feed_id: int):
    from feeds.tasks import update_feed_items

    feed = get_object_or_404(RSSFeed, id=feed_id, user=request.auth)
    # 비동기로 실행
    update_feed_items.delay(feed.id)
    return {"success": True, "message": "Feed refresh scheduled"}


@router.put("/feeds/{feed_id}/mark-all-read", auth=JWTAuth())
def mark_all_feed_items_read(request, feed_id: int):
    feed = get_object_or_404(RSSFeed, id=feed_id, user=request.auth)
    RSSItem.objects.filter(feed=feed).update(is_read=True)
    return {"success": True}


@router.delete("/feeds/{feed_id}", auth=JWTAuth())
def delete_feed(request, feed_id: int):
    feed = get_object_or_404(RSSFeed, id=feed_id, user=request.auth)
    feed.delete()
    return {"success": True}


@router.put("/items/{item_id}/favorite", auth=JWTAuth())
def toggle_item_favorite(request, item_id: int):
    item = get_object_or_404(RSSItem, id=item_id, feed__user=request.auth)
    item.is_favorite = not item.is_favorite
    item.save()
    return {"success": True, "is_favorite": item.is_favorite}


class ItemFilterSchema(Schema):
    is_read: bool = None
    is_favorite: bool = None
    search: str = ""


@router.get("/items", response=List[ItemSchema], auth=JWTAuth())
def list_all_items(
    request, is_read: bool = None, is_favorite: bool = None, search: str = ""
):
    items = RSSItem.objects.filter(feed__user=request.auth)

    if is_read is not None:
        items = items.filter(is_read=is_read)
    if is_favorite is not None:
        items = items.filter(is_favorite=is_favorite)
    if search:
        items = items.filter(title__icontains=search) | items.filter(
            description__icontains=search
        )

    return items.order_by("-published_at")


@router.get("/categories/{category_id}/stats", auth=JWTAuth())
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
