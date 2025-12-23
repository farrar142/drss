"""
Feed Schemas - 피드 관련 스키마
"""

from datetime import datetime
from typing import Optional
from ninja import Field, Schema,ModelSchema

from feeds.models import RSSFeed
from feeds.schemas.source import SourceSchema



class FeedSchema(ModelSchema):
    """피드 스키마"""

    id: int
    item_count:int = Field(0)
    # category_id: int
    # title: str
    # favicon_url: str = ""
    # description: str
    # visible: bool
    # refresh_interval: int = 60
    # last_updated: datetime
    # item_count: int
    sources: list[SourceSchema] = Field(default=list())
    class Meta:
        model = RSSFeed
        exclude = ["user"]


class FeedCreateSchema(ModelSchema):
    """피드 생성 스키마 - 소스 정보는 선택적"""
    category_id : int
    class Meta:
        model = RSSFeed
        exclude = ["user","category"]
        fields_optional = '__all__'


class FeedUpdateSchema(ModelSchema):
    """피드 수정 스키마"""
    category_id : int
    sources: list[SourceSchema] = Field(default=list())
    class Meta:
        model = RSSFeed
        exclude = ["user","category"]
        fields_optional = '__all__'


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
