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
)
from feeds.utils.feed_fetcher import fetch_feed_data, extract_favicon_url


class FeedService:
    """피드 관련 비즈니스 로직을 처리하는 서비스"""

    @staticmethod
    def validate_feed(data: FeedValidationRequest) -> dict:
        """RSS 피드 URL 검증"""
        feed = fetch_feed_data(data.url, data.custom_headers)

        title = feed.feed.get("title", "Unknown Title")  # type:ignore
        description = feed.feed.get("description", "")  # type:ignore
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
    def get_user_feeds(user) -> QuerySet[RSSFeed]:
        """사용자의 피드 목록 조회"""
        return (
            RSSFeed.objects.with_item_counts()
            .filter(user=user)
            .prefetch_related("sources")
        )

    @staticmethod
    def create_feed(user, data: FeedCreateSchema) -> RSSFeed:
        """새 피드 생성"""
        from users.services.setting_service import SettingService

        # 글로벌 설정 가져오기
        global_setting = SettingService.get_global_setting()

        # 사용자당 최대 피드 수 체크
        current_feed_count = RSSFeed.objects.filter(user=user).count()
        if current_feed_count >= global_setting.max_feeds_per_user:
            raise HttpError(
                400,
                f"피드 수 제한에 도달했습니다. (최대 {global_setting.max_feeds_per_user}개)"
            )

        category = get_object_or_404(RSSCategory, id=data.category_id, user=user)

        title = data.title or "New Feed"
        favicon_url = ""
        description = data.description or ""

        # refresh_interval: 명시적으로 지정되지 않으면 글로벌 설정 사용
        refresh_interval = data.refresh_interval if data.refresh_interval is not None else global_setting.default_refresh_interval

        with transaction.atomic():
            # RSSFeed 생성 (소스 없이 생성)
            feed = RSSFeed.objects.create(
                user=user,
                category=category,
                title=title,
                favicon_url=favicon_url,
                description=description,
                visible=data.visible,
                refresh_interval=refresh_interval,
                is_public=data.is_public,
            )

        # item_count 추가하여 반환
        feed_with_count = (
            RSSFeed.objects.with_item_counts()
            .filter(id=feed.pk)
            .prefetch_related("sources")
            .first()
        )
        return feed_with_count or feed

    @staticmethod
    def update_feed(user, feed_id: int, data: FeedUpdateSchema) -> RSSFeed:
        """피드 수정"""
        feed = get_object_or_404(RSSFeed, id=feed_id, user=user)

        if data.category_id is not None:
            category = get_object_or_404(RSSCategory, id=data.category_id, user=user)
            feed.category = category
        for key, value in data.dict().items():
            print(key, value)
            if value is not None and key not in ["category_id", "sources"]:
                setattr(feed, key, value)
        feed.save()

        feed_with_count = (
            RSSFeed.objects.with_item_counts()
            .filter(id=feed.pk)
            .prefetch_related("sources")
            .first()
        )
        return feed_with_count or feed

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
