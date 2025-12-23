"""
Category Schemas - 카테고리 관련 스키마
"""

from typing import Optional, TYPE_CHECKING
from ninja import Schema

if TYPE_CHECKING:
    from .feed import FeedSchema


class CategorySchema(Schema):
    """카테고리 스키마"""

    id: int
    name: str
    description: str
    visible: bool
    is_public: bool
    order: int


class CategoryWithFeedsSchema(Schema):
    """카테고리 + 피드 목록 스키마 (초기 로딩용)"""

    id: int
    name: str
    description: str
    visible: bool
    is_public: bool
    order: int
    feeds: list["FeedSchema"] = []


class CategoryCreateSchema(Schema):
    """카테고리 생성 스키마"""

    name: str
    description: str = ""
    visible: bool = True
    is_public: bool = False


class CategoryUpdateSchema(Schema):
    """카테고리 수정 스키마"""

    name: Optional[str] = None
    description: Optional[str] = None
    visible: Optional[bool] = None
    is_public: Optional[bool] = None
    order: Optional[int] = None


class CategoryReorderSchema(Schema):
    """카테고리 순서 변경 스키마"""

    category_ids: list[int]  # 순서대로 정렬된 카테고리 ID 리스트


# Forward reference 해결
from .feed import FeedSchema

CategoryWithFeedsSchema.model_rebuild()
