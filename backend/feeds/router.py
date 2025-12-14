from ninja import Schema, Router
from typing import List
from django.shortcuts import get_object_or_404
from feeds.models import RSSCategory, RSSFeed, RSSItem
from base.authentications import JWTAuth
import feedparser
import requests
from datetime import datetime

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


class FeedCreateSchema(Schema):
    category_id: int
    url: str
    title: str = ""
    description: str = ""
    visible: bool = True
    custom_headers: dict = {}
    refresh_interval: int = 60


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
        # Custom headers를 포함한 요청
        headers = {"User-Agent": "RSS Reader/1.0"}
        headers.update(data.custom_headers)

        response = requests.get(data.url, headers=headers, timeout=10)
        response.raise_for_status()

        # RSS 파싱
        feed = feedparser.parse(response.content)

        if feed.bozo:  # 파싱 에러
            raise Exception("Invalid RSS feed")

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
    feeds = RSSFeed.objects.filter(user=request.auth)
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
            # Custom headers를 포함한 요청
            headers = {"User-Agent": "RSS Reader/1.0"}
            headers.update(data.custom_headers)

            response = requests.get(data.url, headers=headers, timeout=10)
            response.raise_for_status()

            # RSS 파싱
            feed = feedparser.parse(response.content)

            if feed.bozo:  # 파싱 에러
                raise Exception("Invalid RSS feed")

            # RSS 피드에서 제목 추출
            title = feed.feed.get("title", "Unknown Title")
            description = description or feed.feed.get("description", "")

            # Favicon 추출 시도
            try:
                from urllib.parse import urlparse

                parsed_url = urlparse(data.url)
                base_url = f"{parsed_url.scheme}://{parsed_url.netloc}"

                # favicon.ico 시도
                favicon_response = requests.get(f"{base_url}/favicon.ico", timeout=5)
                if favicon_response.status_code == 200:
                    favicon_url = f"{base_url}/favicon.ico"
                else:
                    # HTML에서 favicon 링크 찾기 시도
                    html_response = requests.get(base_url, headers=headers, timeout=10)
                    if html_response.status_code == 200:
                        import re

                        html_content = html_response.text
                        # rel="icon" 또는 rel="shortcut icon" 찾기
                        favicon_match = re.search(
                            r'<link[^>]+rel=["\'](?:shortcut )?icon["\'][^>]+href=["\']([^"\']+)["\']',
                            html_content,
                            re.IGNORECASE,
                        )
                        if favicon_match:
                            favicon_href = favicon_match.group(1)
                            if favicon_href.startswith("http"):
                                favicon_url = favicon_href
                            elif favicon_href.startswith("//"):
                                favicon_url = f"{parsed_url.scheme}:{favicon_href}"
                            elif favicon_href.startswith("/"):
                                favicon_url = f"{base_url}{favicon_href}"
                            else:
                                favicon_url = f"{base_url}/{favicon_href}"
            except Exception:
                # Favicon 추출 실패 시 무시
                pass

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
    return feed


@router.delete("/feeds/{feed_id}", auth=JWTAuth())
def delete_feed(request, feed_id: int):
    feed = get_object_or_404(RSSFeed, id=feed_id, user=request.auth)
    feed.delete()
    return {"success": True}


@router.get("/feeds/{feed_id}/items", response=List[ItemSchema], auth=JWTAuth())
def list_feed_items(request, feed_id: int):
    feed = get_object_or_404(RSSFeed, id=feed_id, user=request.auth)
    items = RSSItem.objects.filter(feed=feed)
    return items


@router.put("/items/{item_id}/read", auth=JWTAuth())
def mark_item_read(request, item_id: int):
    item = get_object_or_404(RSSItem, id=item_id, feed__user=request.auth)
    item.is_read = True
    item.save()
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
