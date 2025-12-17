"""
Feed Schemas - 피드 관련 스키마
"""

from datetime import datetime
from typing import Optional
from ninja import Schema

from .source import SourceSchema, SourceCreateSchema


class FeedSchema(Schema):
    """피드 스키마"""

    id: int
    category_id: int
    title: str
    favicon_url: str = ""
    description: str
    visible: bool
    refresh_interval: int = 60
    last_updated: datetime
    item_count: int
    sources: list[SourceSchema] = []


class FeedCreateSchema(Schema):
    """피드 생성 스키마 - 소스 정보는 선택적"""

    category_id: int
    title: str = ""
    description: str = ""
    visible: bool = True
    refresh_interval: int = 60

    # 첫 번째 소스 정보 (선택적)
    source: Optional[SourceCreateSchema] = None


class FeedUpdateSchema(Schema):
    """피드 수정 스키마"""

    category_id: Optional[int] = None
    title: Optional[str] = None
    favicon_url: Optional[str] = None
    description: Optional[str] = None
    visible: Optional[bool] = None
    refresh_interval: Optional[int] = None


class FeedValidationRequest(Schema):
    """피드 검증 요청"""

    url: str
    custom_headers: dict = {}


class FeedValidationResponse(Schema):
    """피드 검증 응답"""

    title: str
    description: str
    items_count: int
    latest_item_date: Optional[str] = None
