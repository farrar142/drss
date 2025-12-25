"""
Source Schemas - RSS Everything 소스 관련 스키마
"""

from curses.ascii import RS
from datetime import datetime
from typing import Optional, Literal
from ninja import Schema

# from pydantic import BaseModel, Field
from ninja import Schema as BaseModel, Field, ModelSchema
from feeds.models import RSSEverythingSource

# Source 타입 정의

# Browser 서비스 타입 정의


# ============== RSS Everything 관련 스키마 ==============


class FetchHTMLRequest(BaseModel):
    """HTML 가져오기 요청"""

    url: str
    use_browser: bool = True
    browser_service: RSSEverythingSource.BrowserService = (
        RSSEverythingSource.BrowserService.REALBROWSER
    )
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
    published_at: datetime = Field(default_factory=datetime.now)
    image: str = ""


class CrawlRequest(BaseModel):
    """아이템 미리보기 요청"""

    url: str
    item_selector: str
    title_selector: str = ""
    link_selector: str = ""
    description_selector: str = ""
    date_selector: str = ""
    image_selector: str = ""
    author_selector: str = ""
    use_browser: bool = True
    browser_service: RSSEverythingSource.BrowserService = (
        RSSEverythingSource.BrowserService.REALBROWSER
    )
    wait_selector: str = "body"
    custom_headers: dict = Field(default_factory=dict)
    exclude_selectors: list[str] = Field(default_factory=list)
    follow_links: bool = False
    detail_title_selector: str = ""
    detail_description_selector: str = ""
    detail_date_selector: str = ""
    detail_image_selector: str = ""
    detail_author_selector: str = ""
    date_formats: list[str] = Field(default_factory=list)
    date_locale: str = "ko_KR"
    source_type: RSSEverythingSource.SourceType = RSSEverythingSource.SourceType.RSS
    timeout: int = 30000


class PreviewItemResponse(BaseModel):
    """아이템 미리보기 응답"""

    success: bool
    items: list[PreviewItem] = []
    count: int = 0
    error: Optional[str] = None


class SourceCreateSchema(ModelSchema):
    """RSSEverything 소스 생성 요청"""

    date_formats: list[str] = Field(default_factory=list)
    exclude_selectors: list[str] = Field(default_factory=list)
    source_type: RSSEverythingSource.SourceType = RSSEverythingSource.SourceType.RSS
    browser_service: RSSEverythingSource.BrowserService = (
        RSSEverythingSource.BrowserService.REALBROWSER
    )

    class Meta:
        model = RSSEverythingSource
        exclude = [
            "id",
            "is_active",
            "last_crawled_at",
            "last_error",
            "created_at",
            "updated_at",
            "date_formats",
            "exclude_selectors",
            "source_type",
            "browser_service",
        ]


class SourceUpdateSchema(ModelSchema):
    """RSSEverything 소스 수정 요청"""

    date_formats: list[str] = Field(default_factory=list)
    exclude_selectors: list[str] = Field(default_factory=list)
    source_type: RSSEverythingSource.SourceType = RSSEverythingSource.SourceType.RSS
    browser_service: RSSEverythingSource.BrowserService = (
        RSSEverythingSource.BrowserService.REALBROWSER
    )

    class Meta:
        model = RSSEverythingSource
        exclude = [
            "id",
            "is_active",
            "last_crawled_at",
            "last_error",
            "created_at",
            "updated_at",
            "date_formats",
            "exclude_selectors",
            "source_type",
            "browser_service",
        ]
        fields_optional = "__all__"


class SourceSchema(ModelSchema):
    """RSSEverything 소스 스키마"""

    date_formats: list[str] = Field(default_factory=list)
    exclude_selectors: list[str] = Field(default_factory=list)
    source_type: RSSEverythingSource.SourceType = RSSEverythingSource.SourceType.RSS
    browser_service: RSSEverythingSource.BrowserService = (
        RSSEverythingSource.BrowserService.REALBROWSER
    )

    class Meta:
        model = RSSEverythingSource
        fields = "__all__"
        exclude = [
            "date_formats",
            "exclude_selectors",
            "source_type",
            "browser_service",
        ]


class RefreshResponse(BaseModel):
    """새로고침 응답"""

    success: bool
    task_result_id: int
    message: str


class PaginationCrawlRequest(BaseModel):
    """페이지네이션 크롤링 요청

    URL 템플릿에 {변수명} 형태로 변수를 지정하면
    해당 변수를 start부터 end까지 순회하며 크롤링합니다.

    예시:
    - url_template: "https://example.com/posts?page={page}"
    - variables: [{"name": "page", "start": 1, "end": 10}]

    여러 변수도 가능:
    - url_template: "https://example.com/posts?page={page}&category={cat}"
    - variables: [
        {"name": "page", "start": 1, "end": 5},
        {"name": "cat", "start": 1, "end": 3}
      ]
    """

    source_id: int  # 소스 설정을 가져올 소스 ID
    url_template: str  # URL 템플릿 (예: https://example.com?page={page})
    variables: list[dict]  # [{"name": "page", "start": 1, "end": 10, "step": 1}]
    delay_ms: int = 1000  # 각 요청 사이의 딜레이 (밀리초)


class PaginationCrawlResponse(BaseModel):
    """페이지네이션 크롤링 응답 (비동기 task 스케줄링)"""

    success: bool
    task_id: str = ""
    task_result_id: int = 0
    message: str = ""
