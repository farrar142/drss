from datetime import datetime
from typing import Optional
from ninja import Schema


class CategorySchema(Schema):
    id: int
    name: str
    description: str
    visible: bool
    order: int


class CategoryCreateSchema(Schema):
    name: str
    description: str = ""
    visible: bool = True


class CategoryUpdateSchema(Schema):
    name: Optional[str] = None
    description: Optional[str] = None
    visible: Optional[bool] = None
    order: Optional[int] = None


class CategoryReorderSchema(Schema):
    category_ids: list[int]  # 순서대로 정렬된 카테고리 ID 리스트


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
    favicon_url: Optional[str] = None
    description: Optional[str] = None
    visible: Optional[bool] = None
    custom_headers: Optional[dict] = None
    refresh_interval: Optional[int] = None


class FeedValidationResponse(Schema):
    title: str
    description: str
    items_count: int
    latest_item_date: Optional[str] = None


class FeedValidationRequest(Schema):
    url: str
    custom_headers: dict = {}


class ItemSchema(Schema):
    id: int
    feed_id: int
    title: str
    link: str
    description: str
    published_at: datetime
    is_read: bool
    is_favorite: bool


class ItemFilterSchema(Schema):
    is_read: Optional[bool] = None
    is_favorite: Optional[bool] = None
    search: str = ""


class PaginatedResponse[T](Schema):
    items: list[T]
    has_next: bool
    next_cursor: Optional[str] = None
