"""
Item Schemas - 아이템(게시물) 관련 스키마
"""

from datetime import datetime
from typing import Optional
from ninja import Schema


class ItemSchema(Schema):
    """아이템 스키마"""

    id: int
    feed_id: int
    title: str
    link: str
    description: str
    author: str = ""
    categories: list[str] = []
    published_at: datetime
    is_read: bool
    is_favorite: bool


class ItemFilterSchema(Schema):
    """아이템 필터 스키마"""

    is_read: Optional[bool] = None
    is_favorite: Optional[bool] = None
    search: str = ""


class PaginatedResponse[T](Schema):
    """페이지네이션 응답"""

    items: list[T]
    has_next: bool
    next_cursor: Optional[str] = None
