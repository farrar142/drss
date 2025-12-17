"""
Item Service - 아이템(게시물) 관련 비즈니스 로직
"""

from typing import Optional
from datetime import datetime

from django.shortcuts import get_object_or_404
from django.db.models import QuerySet, Model

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
    def get_paginated_items[T: Model](
        queryset: QuerySet[T],
        limit: int,
        cursor: Optional[str],
        direction: str,
        field_name: str,
    ) -> dict:
        """커서 기반 페이지네이션"""
        if cursor and cursor != "None":
            cursor_date = datetime.fromisoformat(cursor.replace("Z", "+00:00"))
            if direction == "before":
                queryset = queryset.filter(**{f"{field_name}__lt": cursor_date})
                queryset = queryset.order_by(f"-{field_name}")
            elif direction == "after":
                queryset = queryset.filter(**{f"{field_name}__gt": cursor_date})
                queryset = queryset.order_by(field_name)
        else:
            queryset = queryset.order_by(f"-{field_name}")

        paginated_items = list(queryset[: limit + 1])
        has_next = len(paginated_items) > limit
        items_list = paginated_items[:limit]

        next_cursor = None
        if has_next and items_list:
            next_cursor_field = getattr(items_list[-1], field_name)
            if isinstance(next_cursor_field, str):
                next_cursor = next_cursor_field
            elif hasattr(next_cursor_field, "isoformat"):
                next_cursor = next_cursor_field.isoformat().replace("+00:00", "Z")
            else:
                next_cursor = str(next_cursor_field)

        return {
            "items": items_list,
            "has_next": has_next,
            "next_cursor": next_cursor,
        }

    @staticmethod
    def list_all_items(
        user,
        is_read: Optional[bool] = None,
        is_favorite: Optional[bool] = None,
        search: str = "",
        limit: int = 20,
        cursor: Optional[str] = None,
        direction: str = "before",
    ) -> dict:
        """메인 화면 아이템 목록"""
        items = RSSItem.objects.filter(feed__user=user).filter(
            feed__visible=True, feed__category__visible=True
        )

        if is_read is not None:
            items = items.filter(is_read=is_read)
        if is_favorite is not None:
            items = items.filter(is_favorite=is_favorite)
        if search:
            items = items.filter(title__icontains=search) | items.filter(
                description__icontains=search
            )

        return ItemService.get_paginated_items(
            items, limit, cursor, direction, field_name="published_at"
        )

    @staticmethod
    def list_items_by_category(
        user,
        category_id: int,
        is_read: Optional[bool] = None,
        is_favorite: Optional[bool] = None,
        search: str = "",
        limit: int = 20,
        cursor: Optional[str] = None,
        direction: str = "before",
    ) -> dict:
        """카테고리별 아이템 목록"""
        items = RSSItem.objects.filter(
            feed__user=user,
            feed__category_id=category_id,
            feed__visible=True,
        )

        if is_read is not None:
            items = items.filter(is_read=is_read)
        if is_favorite is not None:
            items = items.filter(is_favorite=is_favorite)
        if search:
            items = items.filter(title__icontains=search) | items.filter(
                description__icontains=search
            )

        return ItemService.get_paginated_items(
            items, limit, cursor, direction, field_name="published_at"
        )

    @staticmethod
    def list_items_by_feed(
        user,
        feed_id: int,
        is_read: Optional[bool] = None,
        is_favorite: Optional[bool] = None,
        search: str = "",
        limit: int = 20,
        cursor: Optional[str] = None,
        direction: str = "before",
    ) -> dict:
        """피드별 아이템 목록"""
        items = RSSItem.objects.filter(feed__user=user, feed_id=feed_id)

        if is_read is not None:
            items = items.filter(is_read=is_read)
        if is_favorite is not None:
            items = items.filter(is_favorite=is_favorite)
        if search:
            items = items.filter(title__icontains=search) | items.filter(
                description__icontains=search
            )

        return ItemService.get_paginated_items(
            items, limit, cursor, direction, field_name="published_at"
        )
