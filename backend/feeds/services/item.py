"""
Item Service - 아이템(게시물) 관련 비즈니스 로직
"""

from typing import Optional
import logging

from django.shortcuts import get_object_or_404, aget_object_or_404
from django.db.models import QuerySet, Q
from django.contrib.postgres.search import SearchVector, SearchQuery, SearchRank

from feeds.models import RSSItem
from feeds.schemas.source import CrawlRequest
from feeds.services.crawler import CrawlerService

logger = logging.getLogger(__name__)


class ItemService:
    """아이템 관련 비즈니스 로직을 처리하는 서비스"""

    @staticmethod
    async def toggle_favorite(user, item_id: int) -> dict:
        """아이템 즐겨찾기 토글"""
        item = await aget_object_or_404(RSSItem, id=item_id, feed__user=user)
        item.is_favorite = not item.is_favorite
        await item.asave()
        return {"success": True, "is_favorite": item.is_favorite}

    @staticmethod
    async def toggle_read(user, item_id: int) -> dict:
        """아이템 읽음 상태 토글"""
        item = await aget_object_or_404(RSSItem, id=item_id, feed__user=user)
        item.is_read = not item.is_read
        await item.asave()
        return {"success": True, "is_read": item.is_read}

    @staticmethod
    async def refresh_item(user, item_id: int) -> tuple[RSSItem, list[str]]:
        """
        아이템을 새로고침 (상세 페이지 다시 크롤링)

        소스가 연결되어 있고 상세 페이지 스크래핑 설정이 있는 경우에만 가능
        """

        item = await aget_object_or_404(
            RSSItem.objects.select_related("source"), id=item_id, feed__user=user
        )

        # 소스 확인: 아이템에 직접 연결된 소스 또는 피드의 첫 번째 소스 사용
        source = item.source
        if not source:
            source = await item.feed.sources.afirst()

        if not source:
            return item, []

        if source.source_type != source.SourceType.DETAIL_PAGE_SCRAPING:
            return item, []

        new_item = CrawlerService.crawl_detail_page(
            CrawlRequest.from_orm(source), item.link
        )

        if not new_item:
            return item, []

        # 비교할 필드 목록 (업데이트 가능한 콘텐츠 필드만)
        comparable_fields = [
            "title",
            "description",
            "description_text",
            "author",
            "image",
            "published_at",
        ]

        updated_fields = []
        for field in comparable_fields:
            old_value = getattr(item, field)
            new_value = getattr(new_item, field)
            if old_value != new_value:
                setattr(item, field, new_value)
                updated_fields.append(field)

        if updated_fields:
            await item.asave(update_fields=updated_fields)

        return item, updated_fields

    @staticmethod
    def list_all_items(
        user,
        is_read: Optional[bool] = None,
        is_favorite: Optional[bool] = None,
        search: str = "",
    ) -> QuerySet[RSSItem]:
        """메인 화면 아이템 목록"""
        items = (
            RSSItem.objects.search(search)
            .select_related("feed")
            .filter(feed__user=user)
            .filter(feed__visible=True, feed__category__visible=True)
        )

        if is_read is not None:
            items = items.filter(is_read=is_read)
        if is_favorite is not None:
            items = items.filter(is_favorite=is_favorite)

        return items

    @staticmethod
    def list_items_by_category(
        user,
        category_id: int,
        is_read: Optional[bool] = None,
        is_favorite: Optional[bool] = None,
        search: str = "",
    ) -> QuerySet[RSSItem]:
        """카테고리별 아이템 목록"""
        items = (
            RSSItem.objects.search(search)
            .select_related("feed")
            .filter(
                feed__user=user,
                feed__category_id=category_id,
                feed__visible=True,
            )
        )

        if is_read is not None:
            items = items.filter(is_read=is_read)
        if is_favorite is not None:
            items = items.filter(is_favorite=is_favorite)

        return items

    @staticmethod
    def list_items_by_feed(
        user,
        feed_id: int,
        is_read: Optional[bool] = None,
        is_favorite: Optional[bool] = None,
        search: str = "",
    ) -> QuerySet[RSSItem]:
        """피드별 아이템 목록"""
        items = (
            RSSItem.objects.search(search)
            .select_related("feed")
            .filter(feed__user=user, feed_id=feed_id)
        )

        if is_read is not None:
            items = items.filter(is_read=is_read)
        if is_favorite is not None:
            items = items.filter(is_favorite=is_favorite)

        # items = ItemService._apply_search_filter(items, search)

        return items

    @staticmethod
    async def delete_item(user, item_id: int) -> bool:
        """특정 아이템 삭제"""
        item = await aget_object_or_404(RSSItem, id=item_id, feed__user=user)
        await item.adelete()
        return True
