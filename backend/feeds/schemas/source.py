"""
Source Schemas - RSS Everything 소스 관련 스키마
"""

from datetime import datetime
from typing import Optional, Literal
from ninja import Schema
# from pydantic import BaseModel, Field
from ninja import Schema as BaseModel, Field

# Source 타입 정의
SourceType = Literal["rss", "page_scraping", "detail_page_scraping"]

# Browser 서비스 타입 정의
BrowserServiceType = Literal["realbrowser", "browserless"]


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
    browser_service: BrowserServiceType = "realbrowser"
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
    author_selector: str = ""
    categories_selector: str = ""

    # 상세 페이지용 셀렉터
    detail_title_selector: str = ""
    detail_description_selector: str = ""
    detail_content_selector: str = ""
    detail_date_selector: str = ""
    detail_image_selector: str = ""
    detail_author_selector: str = ""
    detail_categories_selector: str = ""

    # 기타 설정
    exclude_selectors: list[str] = []
    date_formats: list[str] = []
    date_locale: str = "ko_KR"
    use_browser: bool = False
    browser_service: BrowserServiceType = "realbrowser"
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
    author_selector: Optional[str] = None
    categories_selector: Optional[str] = None

    # 상세 페이지용 셀렉터
    detail_title_selector: Optional[str] = None
    detail_description_selector: Optional[str] = None
    detail_content_selector: Optional[str] = None
    detail_date_selector: Optional[str] = None
    detail_image_selector: Optional[str] = None
    detail_author_selector: Optional[str] = None
    detail_categories_selector: Optional[str] = None

    # 기타 설정
    exclude_selectors: Optional[list[str]] = None
    date_formats: Optional[list[str]] = None
    date_locale: Optional[str] = None
    use_browser: Optional[bool] = None
    browser_service: Optional[BrowserServiceType] = None
    wait_selector: Optional[str] = None
    timeout: Optional[int] = None


# ============== RSS Everything 관련 스키마 ==============


class FetchHTMLRequest(BaseModel):
    """HTML 가져오기 요청"""

    url: str
    use_browser: bool = True
    browser_service: BrowserServiceType = "realbrowser"
    wait_selector: str = "body"
    timeout: int = 30000
    custom_headers: dict = Field(default_factory=dict)


class FetchHTMLResponse(BaseModel):
    """HTML 가져오기 응답"""

    success: bool
    html: Optional[str] = None
    url: str
    error: Optional[str] = None


class ElementInfo(BaseModel):
    """추출된 요소 정보"""

    tag: str
    text: str
    html: str
    href: Optional[str] = None
    src: Optional[str] = None
    selector: str


class ExtractElementsRequest(BaseModel):
    """요소 추출 요청"""

    html: str
    selector: str
    base_url: str


class ExtractElementsResponse(BaseModel):
    """요소 추출 응답"""

    success: bool
    elements: list[ElementInfo] = []
    count: int = 0
    error: Optional[str] = None


class PreviewItem(BaseModel):
    """미리보기 아이템"""

    title: str
    link: str
    description: str = ""
    date: str = ""
    image: str = ""


class PreviewItemRequest(BaseModel):
    """아이템 미리보기 요청"""

    url: str
    item_selector: str
    title_selector: str = ""
    link_selector: str = ""
    description_selector: str = ""
    date_selector: str = ""
    image_selector: str = ""
    use_browser: bool = True
    browser_service: BrowserServiceType = "realbrowser"
    wait_selector: str = "body"
    custom_headers: dict = Field(default_factory=dict)
    exclude_selectors: list[str] = Field(default_factory=list)
    follow_links: bool = False
    detail_title_selector: str = ""
    detail_description_selector: str = ""
    detail_content_selector: str = ""
    detail_date_selector: str = ""
    detail_image_selector: str = ""


class PreviewItemResponse(BaseModel):
    """아이템 미리보기 응답"""

    success: bool
    items: list[PreviewItem] = []
    count: int = 0
    error: Optional[str] = None


class RSSEverythingCreateRequest(BaseModel):
    """RSSEverything 소스 생성 요청"""

    feed_id: int
    url: str
    source_type: str = "rss"
    custom_headers: dict = Field(default_factory=dict)
    item_selector: str = ""
    title_selector: str = ""
    link_selector: str = ""
    description_selector: str = ""
    date_selector: str = ""
    image_selector: str = ""
    author_selector: str = ""
    categories_selector: str = ""
    follow_links: bool = False
    detail_title_selector: str = ""
    detail_description_selector: str = ""
    detail_content_selector: str = ""
    detail_date_selector: str = ""
    detail_image_selector: str = ""
    detail_author_selector: str = ""
    detail_categories_selector: str = ""
    exclude_selectors: list[str] = Field(default_factory=list)
    date_formats: list[str] = Field(default_factory=list)
    date_locale: str = "ko_KR"
    use_browser: bool = True
    browser_service: BrowserServiceType = "realbrowser"
    wait_selector: str = "body"
    timeout: int = 30000


class RSSEverythingUpdateRequest(BaseModel):
    """RSSEverything 소스 수정 요청"""

    url: Optional[str] = None
    source_type: Optional[str] = None
    custom_headers: Optional[dict] = None
    is_active: Optional[bool] = None
    item_selector: Optional[str] = None
    title_selector: Optional[str] = None
    link_selector: Optional[str] = None
    description_selector: Optional[str] = None
    date_selector: Optional[str] = None
    image_selector: Optional[str] = None
    author_selector: Optional[str] = None
    categories_selector: Optional[str] = None
    follow_links: Optional[bool] = None
    detail_title_selector: Optional[str] = None
    detail_description_selector: Optional[str] = None
    detail_content_selector: Optional[str] = None
    detail_date_selector: Optional[str] = None
    detail_image_selector: Optional[str] = None
    detail_author_selector: Optional[str] = None
    detail_categories_selector: Optional[str] = None
    exclude_selectors: Optional[list[str]] = None
    date_formats: Optional[list[str]] = None
    date_locale: Optional[str] = None
    use_browser: Optional[bool] = None
    browser_service: Optional[BrowserServiceType] = None
    wait_selector: Optional[str] = None
    timeout: Optional[int] = None


class RSSEverythingSchema(BaseModel):
    """RSSEverything 소스 스키마"""

    id: int
    feed_id: int
    url: str
    source_type: str
    is_active: bool
    item_selector: str
    title_selector: str
    link_selector: str
    description_selector: str
    date_selector: str
    image_selector: str
    author_selector: str
    categories_selector: str
    follow_links: bool
    detail_title_selector: str
    detail_description_selector: str
    detail_content_selector: str
    detail_date_selector: str
    detail_image_selector: str
    detail_author_selector: str
    detail_categories_selector: str
    exclude_selectors: list[str]
    date_formats: list[str]
    date_locale: str
    use_browser: bool
    browser_service: BrowserServiceType
    wait_selector: str
    timeout: int
    custom_headers: dict
    last_crawled_at: Optional[datetime]
    last_error: str
    created_at: datetime
    updated_at: datetime

    @staticmethod
    def from_orm(obj) -> "RSSEverythingSchema":
        return RSSEverythingSchema(
            id=obj.id,
            feed_id=obj.feed_id,
            url=obj.url,
            source_type=obj.source_type,
            is_active=obj.is_active,
            item_selector=obj.item_selector or "",
            title_selector=obj.title_selector or "",
            link_selector=obj.link_selector or "",
            description_selector=obj.description_selector or "",
            date_selector=obj.date_selector or "",
            image_selector=obj.image_selector or "",
            author_selector=obj.author_selector or "",
            categories_selector=obj.categories_selector or "",
            follow_links=obj.source_type == "detail_page_scraping",
            detail_title_selector=obj.detail_title_selector or "",
            detail_description_selector=obj.detail_description_selector or "",
            detail_content_selector=obj.detail_content_selector or "",
            detail_date_selector=obj.detail_date_selector or "",
            detail_image_selector=obj.detail_image_selector or "",
            detail_author_selector=obj.detail_author_selector or "",
            detail_categories_selector=obj.detail_categories_selector or "",
            exclude_selectors=obj.exclude_selectors or [],
            date_formats=obj.date_formats or [],
            date_locale=obj.date_locale or "ko_KR",
            use_browser=obj.use_browser,
            browser_service=obj.browser_service or "realbrowser",
            wait_selector=obj.wait_selector or "",
            timeout=obj.timeout,
            custom_headers=obj.custom_headers or {},
            last_crawled_at=(
                obj.last_crawled_at.isoformat() if obj.last_crawled_at else None
            ),
            last_error=obj.last_error or "",
            created_at=obj.created_at.isoformat(),
            updated_at=obj.updated_at.isoformat(),
        )


class RefreshResponse(BaseModel):
    """새로고침 응답"""

    success: bool
    task_result_id: int
    message: str
