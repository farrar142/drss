"""
Feed Service - 피드 관련 비즈니스 로직
"""

from time import struct_time
from datetime import datetime
from typing import Optional

from django.shortcuts import get_object_or_404
from django.db import models, transaction
from django.db.models import Count, QuerySet

from feeds.models import (
    RSSCategory,
    RSSFeed,
    RSSItem,
    RSSEverythingSource,
    FeedTaskResult,
)
from feeds.schemas import (
    FeedCreateSchema,
    FeedUpdateSchema,
    FeedValidationRequest,
    SourceCreateSchema,
    SourceUpdateSchema,
)
from feeds.utils.feed_fetcher import fetch_feed_data, extract_favicon_url


class FeedService:
    """피드 관련 비즈니스 로직을 처리하는 서비스"""

    @staticmethod
    def feed_to_dict(feed: RSSFeed) -> dict:
        """RSSFeed를 딕셔너리 형식으로 변환 (sources 포함)"""
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

    @staticmethod
    def validate_feed(data: FeedValidationRequest) -> dict:
        """RSS 피드 URL 검증"""
        feed = fetch_feed_data(data.url, data.custom_headers)

        title = feed.feed.get("title", "Unknown Title")
        description = feed.feed.get("description", "")
        items_count = len(feed.entries)
        latest_item_date = None

        if feed.entries:
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

    @staticmethod
    def get_user_feeds(user) -> list[dict]:
        """사용자의 피드 목록 조회"""
        feeds = (
            RSSFeed.objects.filter(user=user)
            .prefetch_related("sources")
            .annotate(
                item_count=Count("rssitem", filter=models.Q(rssitem__is_read=False))
            )
        )
        return [FeedService.feed_to_dict(f) for f in feeds]

    @staticmethod
    def create_feed(user, data: FeedCreateSchema) -> dict:
        """새 피드 생성"""
        from feeds.tasks import update_feed_items

        category = get_object_or_404(RSSCategory, id=data.category_id, user=user)

        title = data.title
        favicon_url = ""
        description = data.description
        source_data = data.source

        # 소스가 있고 RSS 타입이며 제목이 제공되지 않은 경우 RSS 피드를 파싱해서 메타데이터 추출
        if source_data and source_data.source_type == "rss" and not title:
            try:
                feed = fetch_feed_data(source_data.url, source_data.custom_headers)
                title = feed.feed.get("title", "Unknown Title")
                description = description or feed.feed.get("description", "")
                favicon_url = extract_favicon_url(
                    source_data.url, source_data.custom_headers
                )
            except Exception:
                if not title:
                    title = "Unknown Feed"
                if not description:
                    description = ""
        elif not title:
            title = data.title or "New Feed"

        with transaction.atomic():
            # RSSFeed 생성
            feed = RSSFeed.objects.create(
                user=user,
                category=category,
                title=title,
                favicon_url=favicon_url,
                description=description,
                visible=data.visible,
                refresh_interval=data.refresh_interval,
            )

            # source가 제공된 경우에만 RSSEverythingSource 생성
            if source_data:
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

        # 소스가 있는 경우에만 피드 아이템 가져오기
        if source_data:
            try:
                update_feed_items.delay(feed.pk).get(timeout=30)
            except Exception:
                pass

        # item_count 추가하여 반환
        feed_with_count = (
            RSSFeed.objects.filter(id=feed.pk)
            .prefetch_related("sources")
            .annotate(
                item_count=Count("rssitem", filter=models.Q(rssitem__is_read=False))
            )
            .first()
        )
        return FeedService.feed_to_dict(feed_with_count)

    @staticmethod
    def update_feed(user, feed_id: int, data: FeedUpdateSchema) -> dict:
        """피드 수정"""
        feed = get_object_or_404(RSSFeed, id=feed_id, user=user)

        if data.category_id is not None:
            category = get_object_or_404(RSSCategory, id=data.category_id, user=user)
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

        feed_with_count = (
            RSSFeed.objects.filter(id=feed.pk)
            .prefetch_related("sources")
            .annotate(
                item_count=Count("rssitem", filter=models.Q(rssitem__is_read=False))
            )
            .first()
        )
        return FeedService.feed_to_dict(feed_with_count)

    @staticmethod
    def delete_feed(user, feed_id: int) -> bool:
        """피드 삭제"""
        feed = get_object_or_404(RSSFeed, id=feed_id, user=user)
        feed.delete()
        return True

    @staticmethod
    def refresh_feed(user, feed_id: int) -> dict:
        """피드 새로고침"""
        from feeds.tasks import update_feed_items

        feed = get_object_or_404(RSSFeed, id=feed_id, user=user)

        task_result = FeedTaskResult.objects.create(
            feed=feed,
            status=FeedTaskResult.Status.PENDING,
        )

        update_feed_items.delay(feed.pk, task_result_id=task_result.id)

        return {
            "success": True,
            "message": "Feed refresh scheduled",
            "task_result_id": task_result.id,
        }

    @staticmethod
    def mark_all_items_read(user, feed_id: int) -> bool:
        """피드의 모든 아이템을 읽음 처리"""
        feed = get_object_or_404(RSSFeed, id=feed_id, user=user)
        RSSItem.objects.filter(feed=feed).update(is_read=True)
        return True

    @staticmethod
    def delete_all_items(user, feed_id: int) -> int:
        """피드의 모든 아이템 삭제"""
        feed = get_object_or_404(RSSFeed, id=feed_id, user=user)
        deleted_count, _ = RSSItem.objects.filter(feed=feed).delete()
        return deleted_count
