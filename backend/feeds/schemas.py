from datetime import datetime
from typing import Optional, Literal
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


# Source 타입 정의
SourceType = Literal["rss", "page_scraping", "detail_page_scraping"]


class SourceSchema(Schema):
    """소스 스키마"""

    id: int
    feed_id: int
    source_type: SourceType
    is_active: bool
    url: str
    custom_headers: dict = {}

    # 스크래핑용 셀렉터
    item_selector: str = ""
    title_selector: str = ""
    link_selector: str = ""
    description_selector: str = ""
    date_selector: str = ""
    image_selector: str = ""

    # 상세 페이지용 셀렉터
    detail_title_selector: str = ""
    detail_description_selector: str = ""
    detail_content_selector: str = ""
    detail_date_selector: str = ""
    detail_image_selector: str = ""

    # 기타 설정
    exclude_selectors: list[str] = []
    date_formats: list[str] = []
    date_locale: str = "ko_KR"
    use_browser: bool = False
    wait_selector: str = ""
    timeout: int = 30000

    last_crawled_at: Optional[datetime] = None
    last_error: str = ""


class SourceCreateSchema(Schema):
    """소스 생성 스키마"""

    source_type: SourceType = "rss"
    url: str
    custom_headers: dict = {}

    # 스크래핑용 셀렉터
    item_selector: str = ""
    title_selector: str = ""
    link_selector: str = ""
    description_selector: str = ""
    date_selector: str = ""
    image_selector: str = ""

    # 상세 페이지용 셀렉터
    detail_title_selector: str = ""
    detail_description_selector: str = ""
    detail_content_selector: str = ""
    detail_date_selector: str = ""
    detail_image_selector: str = ""

    # 기타 설정
    exclude_selectors: list[str] = []
    date_formats: list[str] = []
    date_locale: str = "ko_KR"
    use_browser: bool = False
    wait_selector: str = ""
    timeout: int = 30000


class SourceUpdateSchema(Schema):
    """소스 업데이트 스키마"""

    source_type: Optional[SourceType] = None
    is_active: Optional[bool] = None
    url: Optional[str] = None
    custom_headers: Optional[dict] = None

    # 스크래핑용 셀렉터
    item_selector: Optional[str] = None
    title_selector: Optional[str] = None
    link_selector: Optional[str] = None
    description_selector: Optional[str] = None
    date_selector: Optional[str] = None
    image_selector: Optional[str] = None

    # 상세 페이지용 셀렉터
    detail_title_selector: Optional[str] = None
    detail_description_selector: Optional[str] = None
    detail_content_selector: Optional[str] = None
    detail_date_selector: Optional[str] = None
    detail_image_selector: Optional[str] = None

    # 기타 설정
    exclude_selectors: Optional[list[str]] = None
    date_formats: Optional[list[str]] = None
    date_locale: Optional[str] = None
    use_browser: Optional[bool] = None
    wait_selector: Optional[str] = None
    timeout: Optional[int] = None


class FeedSchema(Schema):
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
    """피드 생성 스키마 - 소스 정보 포함"""

    category_id: int
    title: str = ""
    description: str = ""
    visible: bool = True
    refresh_interval: int = 60

    # 첫 번째 소스 정보
    source: SourceCreateSchema


class FeedUpdateSchema(Schema):
    category_id: Optional[int] = None
    title: Optional[str] = None
    favicon_url: Optional[str] = None
    description: Optional[str] = None
    visible: Optional[bool] = None
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
