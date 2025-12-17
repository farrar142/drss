from typing import Optional
from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()


class RSSCategory(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    visible = models.BooleanField(default=True)
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


class RSSFeed(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    category = models.ForeignKey(RSSCategory, on_delete=models.CASCADE)
    url = models.URLField(unique=True)
    title = models.CharField(max_length=200, blank=True)
    favicon_url = models.URLField(blank=True)
    description = models.TextField(blank=True)
    visible = models.BooleanField(default=True)
    custom_headers = models.JSONField(default=dict, blank=True)
    refresh_interval = models.IntegerField(
        default=60, help_text="자동 새로고침 주기 (분)"
    )
    last_updated = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)
    rss_everything_source: "Optional[RSSEverythingSource]"

    class Meta:
        indexes = [
            models.Index(fields=["user"]),
            models.Index(fields=["category"]),
            models.Index(fields=["user", "visible"]),
            models.Index(fields=["category", "visible"]),
        ]

    def __str__(self):
        return self.title


class RSSItem(models.Model):
    feed = models.ForeignKey(RSSFeed, on_delete=models.CASCADE)
    title = models.CharField(max_length=200)
    link = models.URLField()
    description = models.TextField(blank=True)
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


class RSSEverythingSource(models.Model):
    """
    RSSEverything: 일반 웹 페이지를 RSS 피드로 변환하기 위한 설정
    사용자가 선택한 CSS 셀렉터를 기반으로 페이지에서 아이템을 추출합니다.
    RSSFeed와 1:1로 연결되어 피드 업데이트 시 크롤링을 수행합니다.
    """

    # 연결된 RSSFeed (필수)
    feed = models.OneToOneField(
        RSSFeed,
        on_delete=models.CASCADE,
        related_name="rss_everything_source",
        help_text="연결된 RSS 피드",
    )

    # 기본 정보
    url = models.URLField(help_text="크롤링할 페이지 URL")

    # 아이템 목록 셀렉터 (메인 페이지에서 아이템들을 찾는 셀렉터)
    item_selector = models.CharField(
        max_length=500,
        help_text="아이템 목록의 CSS 셀렉터 (예: article.post, .news-item)",
    )

    # 각 아이템에서 추출할 정보의 셀렉터 (아이템 내부 상대 셀렉터)
    title_selector = models.CharField(
        max_length=500, help_text="제목 CSS 셀렉터 (아이템 내부)"
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

    # 상세 페이지 설정 (선택사항 - 링크를 따라가서 상세 내용 추출)
    follow_links = models.BooleanField(
        default=False, help_text="각 아이템의 링크를 따라가서 상세 내용을 가져올지 여부"
    )
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

    # 제외할 셀렉터 설정
    exclude_selectors = models.JSONField(
        default=list,
        blank=True,
        help_text='제외할 CSS 셀렉터 목록 (예: [".ads", ".sidebar", "script"])',
    )

    # 날짜 파싱 설정
    date_formats = models.JSONField(
        default=list,
        blank=True,
        help_text='날짜 포맷 목록 (예: ["%Y-%m-%d", "%Y.%m.%d %H:%M"])',
    )
    date_locale = models.CharField(
        max_length=20, default="ko_KR", help_text="날짜 로케일 (예: ko_KR, en_US)"
    )

    # 브라우저 크롤링 설정
    use_browser = models.BooleanField(
        default=True, help_text="브라우저 렌더링 사용 여부 (JavaScript 필요 시)"
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
        ]


class FeedTaskResult(models.Model):
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
        verbose_name = "RSS Everything Source"
        verbose_name_plural = "RSS Everything Sources"

    def __str__(self):
        return f"RSSEverything: {self.feed.title} ({self.url})"
