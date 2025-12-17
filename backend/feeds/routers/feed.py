from time import struct_time
from ninja import Router
from django.shortcuts import get_object_or_404
from django.db import models, transaction
from pydantic import HttpUrl
from feeds.models import RSSCategory, RSSFeed, RSSItem, RSSEverythingSource
from base.authentications import JWTAuth
from feeds.utils import fetch_feed_data, extract_favicon_url

from ..schemas import *

router = Router()


def feed_to_schema(feed: RSSFeed) -> dict:
    """RSSFeed를 FeedSchema 형식으로 변환 (sources 포함)"""
    sources = list(feed.sources.all())
    return {
        "id": feed.id,
        "category_id": feed.category_id,
        "title": feed.title,
        "favicon_url": feed.favicon_url,
        "description": feed.description,
        "visible": feed.visible,
        "refresh_interval": feed.refresh_interval,
        "last_updated": feed.last_updated,
        "item_count": getattr(feed, "item_count", 0),
        "sources": [
            {
                "id": s.id,
                "feed_id": s.feed_id,
                "source_type": s.source_type,
                "is_active": s.is_active,
                "url": s.url,
                "custom_headers": s.custom_headers or {},
                "item_selector": s.item_selector or "",
                "title_selector": s.title_selector or "",
                "link_selector": s.link_selector or "",
                "description_selector": s.description_selector or "",
                "date_selector": s.date_selector or "",
                "image_selector": s.image_selector or "",
                "detail_title_selector": s.detail_title_selector or "",
                "detail_description_selector": s.detail_description_selector or "",
                "detail_content_selector": s.detail_content_selector or "",
                "detail_date_selector": s.detail_date_selector or "",
                "detail_image_selector": s.detail_image_selector or "",
                "exclude_selectors": s.exclude_selectors or [],
                "date_formats": s.date_formats or [],
                "date_locale": s.date_locale or "ko_KR",
                "use_browser": s.use_browser,
                "wait_selector": s.wait_selector or "",
                "timeout": s.timeout,
                "last_crawled_at": s.last_crawled_at,
                "last_error": s.last_error or "",
            }
            for s in sources
        ],
    }


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
    from django.db.models import Count, Prefetch

    feeds = (
        RSSFeed.objects.filter(user=request.auth)
        .prefetch_related("sources")
        .annotate(item_count=Count("rssitem", filter=models.Q(rssitem__is_read=False)))
    )
    return [feed_to_schema(f) for f in feeds]


@router.post("", response=FeedSchema, auth=JWTAuth())
def create_feed(request, data: FeedCreateSchema):
    from feeds.tasks import update_feed_items

    category = get_object_or_404(RSSCategory, id=data.category_id, user=request.auth)

    title = data.title
    favicon_url = ""
    description = data.description
    source_data = data.source

    # RSS 타입이고 제목이 제공되지 않은 경우 RSS 피드를 파싱해서 메타데이터 추출
    if source_data.source_type == "rss" and not title:
        try:
            feed = fetch_feed_data(source_data.url, source_data.custom_headers)

            # RSS 피드에서 제목 추출
            title = feed.feed.get("title", "Unknown Title")
            description = description or feed.feed.get("description", "")

            # Favicon 추출 시도
            favicon_url = extract_favicon_url(
                source_data.url, source_data.custom_headers
            )

        except Exception as e:
            # RSS 파싱 실패 시 기본값 사용
            if not title:
                title = "Unknown Feed"
            if not description:
                description = ""
    elif not title:
        title = "New Feed"

    with transaction.atomic():
        # RSSFeed 생성
        feed = RSSFeed.objects.create(
            user=request.auth,
            category=category,
            title=title,
            favicon_url=favicon_url,
            description=description,
            visible=data.visible,
            refresh_interval=data.refresh_interval,
        )

        # RSSEverythingSource 생성
        RSSEverythingSource.objects.create(
            feed=feed,
            source_type=source_data.source_type,
            is_active=True,
            url=source_data.url,
            custom_headers=source_data.custom_headers,
            item_selector=source_data.item_selector,
            title_selector=source_data.title_selector,
            link_selector=source_data.link_selector,
            description_selector=source_data.description_selector,
            date_selector=source_data.date_selector,
            image_selector=source_data.image_selector,
            detail_title_selector=source_data.detail_title_selector,
            detail_description_selector=source_data.detail_description_selector,
            detail_content_selector=source_data.detail_content_selector,
            detail_date_selector=source_data.detail_date_selector,
            detail_image_selector=source_data.detail_image_selector,
            exclude_selectors=source_data.exclude_selectors,
            date_formats=source_data.date_formats,
            date_locale=source_data.date_locale,
            use_browser=source_data.use_browser,
            wait_selector=source_data.wait_selector,
            timeout=source_data.timeout,
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
        .prefetch_related("sources")
        .annotate(item_count=Count("rssitem", filter=models.Q(rssitem__is_read=False)))
        .first()
    )
    return feed_to_schema(feed_with_count)


@router.put("/{feed_id}", response=FeedSchema, auth=JWTAuth())
def update_feed(request, feed_id: int, data: FeedUpdateSchema):
    feed = get_object_or_404(RSSFeed, id=feed_id, user=request.auth)

    if data.category_id is not None:
        category = get_object_or_404(
            RSSCategory, id=data.category_id, user=request.auth
        )
        feed.category = category

    if data.title is not None:
        feed.title = data.title
    if data.description is not None:
        feed.description = data.description
    if data.visible is not None:
        feed.visible = data.visible
    if data.refresh_interval is not None:
        feed.refresh_interval = data.refresh_interval
    if getattr(data, "favicon_url", None) is not None:
        feed.favicon_url = data.favicon_url

    feed.save()

    # item_count 추가
    from django.db.models import Count

    feed_with_count = (
        RSSFeed.objects.filter(id=feed.pk)
        .prefetch_related("sources")
        .annotate(item_count=Count("rssitem", filter=models.Q(rssitem__is_read=False)))
        .first()
    )
    return feed_to_schema(feed_with_count)


# ============== Source 관련 API ==============


@router.post("/{feed_id}/sources", response=SourceSchema, auth=JWTAuth())
def add_source(request, feed_id: int, data: SourceCreateSchema):
    """피드에 새 소스 추가"""
    feed = get_object_or_404(RSSFeed, id=feed_id, user=request.auth)

    source = RSSEverythingSource.objects.create(
        feed=feed,
        source_type=data.source_type,
        is_active=True,
        url=data.url,
        custom_headers=data.custom_headers,
        item_selector=data.item_selector,
        title_selector=data.title_selector,
        link_selector=data.link_selector,
        description_selector=data.description_selector,
        date_selector=data.date_selector,
        image_selector=data.image_selector,
        detail_title_selector=data.detail_title_selector,
        detail_description_selector=data.detail_description_selector,
        detail_content_selector=data.detail_content_selector,
        detail_date_selector=data.detail_date_selector,
        detail_image_selector=data.detail_image_selector,
        exclude_selectors=data.exclude_selectors,
        date_formats=data.date_formats,
        date_locale=data.date_locale,
        use_browser=data.use_browser,
        wait_selector=data.wait_selector,
        timeout=data.timeout,
    )
    return source


@router.put("/{feed_id}/sources/{source_id}", response=SourceSchema, auth=JWTAuth())
def update_source(request, feed_id: int, source_id: int, data: SourceUpdateSchema):
    """소스 업데이트"""
    feed = get_object_or_404(RSSFeed, id=feed_id, user=request.auth)
    source = get_object_or_404(RSSEverythingSource, id=source_id, feed=feed)

    for field, value in data.dict(exclude_unset=True).items():
        if value is not None:
            setattr(source, field, value)

    source.save()
    return source


@router.delete("/{feed_id}/sources/{source_id}", auth=JWTAuth())
def delete_source(request, feed_id: int, source_id: int):
    """소스 삭제"""
    feed = get_object_or_404(RSSFeed, id=feed_id, user=request.auth)
    source = get_object_or_404(RSSEverythingSource, id=source_id, feed=feed)

    # 마지막 소스는 삭제 불가
    if feed.sources.count() <= 1:
        from ninja.errors import HttpError

        raise HttpError(400, "Cannot delete the last source of a feed")

    source.delete()
    return {"success": True}


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
