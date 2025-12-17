from time import struct_time
from ninja import Router
from django.shortcuts import get_object_or_404
from django.db import models
from pydantic import HttpUrl
from feeds.models import RSSCategory, RSSFeed, RSSItem
from base.authentications import JWTAuth
from feeds.utils import fetch_feed_data, extract_favicon_url

from ..schemas import *

router = Router()


@router.post("/validate", response=FeedValidationResponse, auth=JWTAuth())
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
                    if not isinstance(entry.published_parsed, struct_time):
                        continue
                    dates.append(datetime(*entry.published_parsed[:6]))
                elif hasattr(entry, "updated_parsed") and entry.updated_parsed:
                    if not isinstance(entry.updated_parsed, struct_time):
                        continue
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
        from ninja.errors import HttpError

        raise HttpError(400, f"Failed to validate feed: {str(e)}")


@router.get("", response=list[FeedSchema], auth=JWTAuth())
def list_feeds(request):
    from django.db.models import Count

    feeds = RSSFeed.objects.filter(user=request.auth).annotate(
        item_count=Count("rssitem", filter=models.Q(rssitem__is_read=False))
    )
    return feeds


@router.post("", response=FeedSchema, auth=JWTAuth())
def create_feed(request, data: FeedCreateSchema):
    from feeds.tasks import update_feed_items

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

    # 피드 생성 후 즉시 아이템 가져오기 (동기적으로 대기)
    try:
        update_feed_items.delay(feed.pk).get(timeout=30)
    except Exception as e:
        # 타임아웃이나 에러 발생 시에도 피드는 생성됨
        pass

    # item_count 추가
    from django.db.models import Count

    feed_with_count = (
        RSSFeed.objects.filter(id=feed.pk)
        .annotate(item_count=Count("rssitem", filter=models.Q(rssitem__is_read=False)))
        .first()
    )
    return feed_with_count


@router.put("/{feed_id}", response=FeedSchema, auth=JWTAuth())
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
    if getattr(data, "favicon_url", None) is not None:
        feed.favicon_url = data.favicon_url

    feed.save()
    # item_count 추가
    from django.db.models import Count

    feed_with_count = (
        RSSFeed.objects.filter(id=feed.pk)
        .annotate(item_count=Count("rssitem", filter=models.Q(rssitem__is_read=False)))
        .first()
    )
    return feed_with_count


@router.post("/{feed_id}/refresh", auth=JWTAuth())
def refresh_feed(request, feed_id: int):
    from feeds.tasks import update_feed_items
    from feeds.models import FeedTaskResult

    feed = get_object_or_404(RSSFeed, id=feed_id, user=request.auth)
    
    # FeedTaskResult 먼저 생성
    task_result = FeedTaskResult.objects.create(
        feed=feed,
        status=FeedTaskResult.Status.PENDING,
    )
    
    # 비동기로 실행 (task_result_id 전달)
    update_feed_items.delay(feed.pk, task_result_id=task_result.id)
    
    return {
        "success": True,
        "message": "Feed refresh scheduled",
        "task_result_id": task_result.id,
    }


@router.put("/{feed_id}/mark-all-read", auth=JWTAuth())
def mark_all_feed_items_read(request, feed_id: int):
    feed = get_object_or_404(RSSFeed, id=feed_id, user=request.auth)
    RSSItem.objects.filter(feed=feed).update(is_read=True)
    return {"success": True}


@router.delete("/{feed_id}/items", auth=JWTAuth())
def delete_all_feed_items(request, feed_id: int):
    feed = get_object_or_404(RSSFeed, id=feed_id, user=request.auth)
    deleted_count, _ = RSSItem.objects.filter(feed=feed).delete()
    return {"success": True, "deleted_count": deleted_count}


@router.delete("/{feed_id}", auth=JWTAuth())
def delete_feed(request, feed_id: int):
    feed = get_object_or_404(RSSFeed, id=feed_id, user=request.auth)
    feed.delete()
    return {"success": True}
