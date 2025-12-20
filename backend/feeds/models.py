from typing import Callable, Optional
from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.contrib.postgres.search import SearchVector, SearchQuery, SearchRank

from feeds.managers import RSSFeedWithCountManager, RSSItemManager

User = get_user_model()


class BaseModel(models.Model):
    id: int

    class Meta:
        abstract = True


class RSSCategory(BaseModel):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    visible = models.BooleanField(default=True)
    is_public = models.BooleanField(default=False, help_text="RSS 피드 공개 여부")
    order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["user"]),
            models.Index(fields=["user", "visible"]),
            models.Index(fields=["user", "order"]),
        ]
        ordering = ["order", "id"]

    def __str__(self):
        return self.name


class RSSFeed(BaseModel):
    objects: RSSFeedWithCountManager = RSSFeedWithCountManager()
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    category = models.ForeignKey(
        RSSCategory, on_delete=models.CASCADE, related_name="feeds"
    )
    title = models.CharField(max_length=500, blank=True)
    favicon_url = models.URLField(blank=True, null=True, default="")
    description = models.TextField(blank=True)
    visible = models.BooleanField(default=True)
    is_public = models.BooleanField(default=False, help_text="RSS 피드 공개 여부")
    refresh_interval = models.IntegerField(
        default=60, help_text="자동 새로고침 주기 (분)"
    )
    last_updated = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)
    sources: models.QuerySet["RSSEverythingSource"]

    category_id: int

    class Meta:
        indexes = [
            models.Index(fields=["user"]),
            models.Index(fields=["category"]),
            models.Index(fields=["user", "visible"]),
            models.Index(fields=["category", "visible"]),
        ]

    def __str__(self):
        return self.title

    @property
    def url(self) -> str:
        """첫 번째 소스의 URL 반환 (호환성)"""
        first_source = self.sources.first()
        return first_source.url if first_source else ""

    @url.setter
    def url(self, value: str):
        """url setter (호환성)"""
        pass

    @property
    def custom_headers(self) -> dict:
        """첫 번째 소스의 custom_headers 반환 (호환성)"""
        first_source = self.sources.first()
        return first_source.custom_headers if first_source else {}

    @custom_headers.setter
    def custom_headers(self, value: dict):
        """custom_headers setter (호환성)"""
        pass


class RSSItem(BaseModel):
    objects: RSSItemManager = RSSItemManager()
    feed = models.ForeignKey(RSSFeed, on_delete=models.CASCADE)
    title = models.CharField(max_length=500)
    link = models.URLField()
    description = models.TextField(blank=True)
    description_text = models.TextField(
        blank=True, 
        default="",
        help_text="HTML 태그가 제거된 순수 텍스트 (검색용)"
    )
    author = models.CharField(max_length=255, blank=True, help_text="아이템 작성자")
    categories = models.JSONField(
        default=list, blank=True, help_text="카테고리 목록 (예: ['Tech', 'News'])"
    )
    image = models.URLField(blank=True, default="", help_text="아이템 이미지 URL")
    published_at = models.DateTimeField()
    guid = models.CharField(max_length=500, unique=True)
    is_read = models.BooleanField(default=False)
    is_favorite = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    feed_id: int

    class Meta:
        ordering = ["-published_at"]
        indexes = [
            models.Index(fields=["feed"]),
            models.Index(fields=["feed", "is_read"]),
            models.Index(fields=["feed", "is_favorite"]),
            models.Index(fields=["published_at"]),
            models.Index(fields=["feed", "-published_at"]),
        ]

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        """저장 시 description에서 HTML 태그를 제거하여 description_text에 저장"""
        from feeds.utils.html_utils import strip_html_tags
        
        # description이 변경되었거나 description_text가 비어있으면 업데이트
        if self.description and not self.description_text:
            self.description_text = strip_html_tags(self.description)
        elif self.pk is None:  # 새로 생성되는 경우
            self.description_text = strip_html_tags(self.description) if self.description else ""
        
        super().save(*args, **kwargs)


class RSSEverythingSource(BaseModel):
    """
    RSSEverything: RSS 피드의 아이템 소스를 정의합니다.
    소스 타입에 따라 클래식 RSS, 페이지 스크래핑, 상세 페이지 스크래핑 방식을 지원합니다.
    RSSFeed와 1:N으로 연결되어 하나의 피드가 여러 소스를 가질 수 있습니다.
    """

    class SourceType(models.TextChoices):
        RSS = "rss", "RSS/Atom (Classic)"
        PAGE_SCRAPING = "page_scraping", "Page Scraping"
        DETAIL_PAGE_SCRAPING = "detail_page_scraping", "Detail Page Scraping"

    # 연결된 RSSFeed (필수) - 1:N 관계로 변경
    feed = models.ForeignKey(
        RSSFeed,
        on_delete=models.CASCADE,
        related_name="sources",
        help_text="연결된 RSS 피드",
    )

    # 소스 타입
    source_type = models.CharField(
        max_length=30,
        choices=SourceType.choices,
        default=SourceType.RSS,
        help_text="소스 타입 (RSS/Atom, 페이지 스크래핑, 상세 페이지 스크래핑)",
    )

    # 활성화 여부
    is_active = models.BooleanField(default=True, help_text="이 소스의 활성화 여부")

    # 기본 정보
    url = models.URLField(help_text="RSS URL 또는 크롤링할 페이지 URL")

    # 커스텀 헤더 (RSS/스크래핑 모두 사용)
    custom_headers = models.JSONField(default=dict, blank=True)

    # 아이템 목록 셀렉터 (메인 페이지에서 아이템들을 찾는 셀렉터) - 스크래핑용
    item_selector = models.CharField(
        max_length=500,
        blank=True,
        help_text="아이템 목록의 CSS 셀렉터 (예: article.post, .news-item)",
    )

    # 각 아이템에서 추출할 정보의 셀렉터 (아이템 내부 상대 셀렉터) - 스크래핑용
    title_selector = models.CharField(
        max_length=500, blank=True, help_text="제목 CSS 셀렉터 (아이템 내부)"
    )
    link_selector = models.CharField(
        max_length=500,
        blank=True,
        help_text="링크 CSS 셀렉터 (아이템 내부, 비워두면 title_selector의 a 태그 사용)",
    )
    description_selector = models.CharField(
        max_length=500, blank=True, help_text="설명 CSS 셀렉터 (아이템 내부)"
    )
    date_selector = models.CharField(
        max_length=500, blank=True, help_text="날짜 CSS 셀렉터 (아이템 내부)"
    )
    image_selector = models.CharField(
        max_length=500, blank=True, help_text="이미지 CSS 셀렉터 (아이템 내부)"
    )
    author_selector = models.CharField(
        max_length=500, blank=True, help_text="작성자 CSS 셀렉터 (아이템 내부)"
    )
    categories_selector = models.CharField(
        max_length=500,
        blank=True,
        help_text="카테고리 CSS 셀렉터 (아이템 내부, 여러 개 선택 가능)",
    )

    # 상세 페이지 설정 (DETAIL_PAGE_SCRAPING 타입에서만 사용)
    detail_title_selector = models.CharField(
        max_length=500, blank=True, help_text="상세 페이지에서 제목 CSS 셀렉터"
    )
    detail_description_selector = models.CharField(
        max_length=500, blank=True, help_text="상세 페이지에서 설명/요약 CSS 셀렉터"
    )
    detail_content_selector = models.CharField(
        max_length=500, blank=True, help_text="상세 페이지에서 본문 CSS 셀렉터"
    )
    detail_date_selector = models.CharField(
        max_length=500, blank=True, help_text="상세 페이지에서 날짜 CSS 셀렉터"
    )
    detail_image_selector = models.CharField(
        max_length=500, blank=True, help_text="상세 페이지에서 이미지 CSS 셀렉터"
    )
    detail_author_selector = models.CharField(
        max_length=500, blank=True, help_text="상세 페이지에서 작성자 CSS 셀렉터"
    )
    detail_categories_selector = models.CharField(
        max_length=500, blank=True, help_text="상세 페이지에서 카테고리 CSS 셀렉터"
    )

    # 제외할 셀렉터 설정
    exclude_selectors = models.JSONField(
        default=list,
        blank=True,
        help_text='제외할 CSS 셀렉터 목록 (예: [".ads", ".sidebar", "script"])',
    )

    # 날짜 파싱 설정 - 스크래핑용
    date_formats = models.JSONField(
        default=list,
        blank=True,
        help_text='날짜 포맷 목록 (예: ["%Y-%m-%d", "%Y.%m.%d %H:%M"])',
    )
    date_locale = models.CharField(
        max_length=20, default="ko_KR", help_text="날짜 로케일 (예: ko_KR, en_US)"
    )

    # 브라우저 크롤링 설정 - 스크래핑용
    use_browser = models.BooleanField(
        default=False, help_text="브라우저 렌더링 사용 여부 (JavaScript 필요 시)"
    )
    wait_selector = models.CharField(
        max_length=500, blank=True, help_text="페이지 로드 완료 확인용 셀렉터"
    )
    timeout = models.IntegerField(default=30000, help_text="타임아웃 (밀리초)")

    last_crawled_at = models.DateTimeField(null=True, blank=True)
    last_error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["feed"]),
            models.Index(fields=["feed", "source_type"]),
            models.Index(fields=["feed", "is_active"]),
        ]
        verbose_name = "RSS Everything Source"
        verbose_name_plural = "RSS Everything Sources"

    def __str__(self):
        return f"{self.get_source_type_display()}: {self.feed.title} ({self.url})"

    feed_id: int
    get_source_type_display: Callable[[], str]

    @property
    def is_rss(self) -> bool:
        return self.source_type == self.SourceType.RSS

    @property
    def is_scraping(self) -> bool:
        return self.source_type in [
            self.SourceType.PAGE_SCRAPING,
            self.SourceType.DETAIL_PAGE_SCRAPING,
        ]

    @property
    def follow_links(self) -> bool:
        """상세 페이지를 따라갈지 여부 (DETAIL_PAGE_SCRAPING 타입일 때만 True)"""
        return self.source_type == self.SourceType.DETAIL_PAGE_SCRAPING


class FeedTaskResult(BaseModel):
    """
    피드 수집 Task의 실행 결과를 저장합니다.
    성공/실패 여부, 수집된 아이템 수, 에러 메시지 등을 기록합니다.
    """

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        RUNNING = "running", "Running"
        SUCCESS = "success", "Success"
        FAILURE = "failure", "Failure"

    feed = models.ForeignKey(
        RSSFeed,
        on_delete=models.CASCADE,
        related_name="task_results",
        help_text="관련 피드",
    )
    task_id = models.CharField(
        max_length=255,
        blank=True,
        help_text="Celery Task ID",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    items_found = models.IntegerField(
        default=0,
        help_text="발견된 총 아이템 수",
    )
    items_created = models.IntegerField(
        default=0,
        help_text="새로 생성된 아이템 수",
    )
    error_message = models.TextField(
        blank=True,
        help_text="에러 메시지 (실패 시)",
    )
    started_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Task 시작 시간",
    )
    completed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Task 완료 시간",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["feed"]),
            models.Index(fields=["feed", "-created_at"]),
            models.Index(fields=["status"]),
            models.Index(fields=["task_id"]),
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.feed.title} - {self.status} ({self.created_at})"

    @property
    def duration_seconds(self) -> float | None:
        """Task 실행 시간 (초)"""
        if self.started_at and self.completed_at:
            return (self.completed_at - self.started_at).total_seconds()
        return None
