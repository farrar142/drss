"""
Item Service - 아이템(게시물) 관련 비즈니스 로직
"""

from typing import Optional

from django.shortcuts import get_object_or_404
from django.db.models import QuerySet, Q
from django.contrib.postgres.search import SearchVector, SearchQuery, SearchRank

from feeds.models import RSSItem


class ItemService:
    """아이템 관련 비즈니스 로직을 처리하는 서비스"""

    @staticmethod
    def toggle_favorite(user, item_id: int) -> dict:
        """아이템 즐겨찾기 토글"""
        item = get_object_or_404(RSSItem, id=item_id, feed__user=user)
        item.is_favorite = not item.is_favorite
        item.save()
        return {"success": True, "is_favorite": item.is_favorite}

    @staticmethod
    def toggle_read(user, item_id: int) -> dict:
        """아이템 읽음 상태 토글"""
        item = get_object_or_404(RSSItem, id=item_id, feed__user=user)
        item.is_read = not item.is_read
        item.save()
        return {"success": True, "is_read": item.is_read}


    @staticmethod
    def list_all_items(
        user,
        is_read: Optional[bool] = None,
        is_favorite: Optional[bool] = None,
        search: str = "",
    ) -> QuerySet[RSSItem]:
        """메인 화면 아이템 목록"""
        items = RSSItem.objects.search(search).filter(feed__user=user).filter(
            feed__visible=True, feed__category__visible=True
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
        items = RSSItem.objects.search(search).filter(
            feed__user=user,
            feed__category_id=category_id,
            feed__visible=True,
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
        items = RSSItem.objects.search(search).filter(feed__user=user, feed_id=feed_id)

        if is_read is not None:
            items = items.filter(is_read=is_read)
        if is_favorite is not None:
            items = items.filter(is_favorite=is_favorite)

        # items = ItemService._apply_search_filter(items, search)

        return items
