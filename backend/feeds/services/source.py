"""
Source Service - RSS Everything 소스 관련 비즈니스 로직
"""

from typing import Callable, Optional
import logging

from django.shortcuts import get_object_or_404
from bs4 import BeautifulSoup
from urllib.parse import urljoin
import re
from ninja import Schema

from feeds.models import RSSFeed, RSSEverythingSource, FeedTaskResult, RSSItem
from feeds.schemas.source import (
    PreviewItemResponse,
    SourceCreateSchema,
    SourceUpdateSchema,
)
from feeds.utils.html_parser import (
    generate_selector,
    extract_text,
    extract_html,
    extract_href,
    extract_src,
)
from feeds.services.crawler import CrawlerService
from feeds.schemas import CrawlRequest

logger = logging.getLogger(__name__)


# API 응답 스키마 정의
class ExtractedElementSchema(Schema):
    """추출된 요소 정보"""

    tag: str
    text: str
    html: str
    href: Optional[str] = None
    src: Optional[str] = None
    selector: str


class ExtractElementsResponse(Schema):
    """extract_elements 함수 응답 타입"""

    success: bool
    elements: list[ExtractedElementSchema]
    count: int
    error: Optional[str] = None


class PreviewItemSchema(Schema):
    """미리보기 아이템 정보"""

    title: str
    link: str
    description: str
    date: str
    image: str


class PreviewItemsResponse(Schema):
    """crawl 함수 응답 타입"""

    success: bool
    items: list[PreviewItemSchema]
    count: int
    error: Optional[str] = None


class FetchHtmlResponse(Schema):
    """fetch_html 함수 응답 타입"""

    success: bool
    html: Optional[str] = None
    url: str
    error: Optional[str] = None


class SourceService:
    """RSS Everything 소스 관련 비즈니스 로직"""

    @staticmethod
    def extract_elements(
        html: str, selector: str, base_url: str
    ) -> ExtractElementsResponse:
        """HTML에서 CSS 셀렉터로 요소들을 추출"""
        try:
            soup = BeautifulSoup(html, "html.parser")
            elements = soup.select(selector)

            result_elements = []
            for el in elements[:50]:
                href = extract_href(el, base_url)
                src = extract_src(el, base_url)

                result_elements.append(
                    ExtractedElementSchema(
                        tag=el.name,
                        text=extract_text(el)[:500],
                        html=str(el)[:2000],
                        href=href if href else None,
                        src=src if src else None,
                        selector=generate_selector(soup, el),
                    )
                )

            return ExtractElementsResponse(
                success=True,
                elements=result_elements,
                count=len(elements),
            )
        except Exception as e:
            logger.exception(f"Failed to extract elements with selector: {selector}")
            return ExtractElementsResponse(
                success=False,
                elements=[],
                count=0,
                error=str(e),
            )

    @staticmethod
    def crawl(
        option: CrawlRequest,
        feed: Optional[RSSFeed] = None,
        source: Optional[RSSEverythingSource] = None,
        existing_guids: set[str] = set(),
        max_items: int = 30,
    ) -> tuple[int, list[RSSItem]]:
        result = CrawlerService.fetch_html(
            url=option.url,
            use_browser=option.use_browser,
            browser_service=option.browser_service,
            wait_selector=option.wait_selector,
            custom_headers=option.custom_headers,
        )
        if not result.success:
            raise Exception(f"Failed to fetch HTML: {result.error}")
        if not result.html:
            raise Exception("Fetched HTML is empty")
        html = result.html
        soup = BeautifulSoup(html, "html.parser")
        if option.source_type == "rss":
            entries, result = CrawlerService.crawl_rss_source(
                html, None, existing_guids, max_items
            )
        elif option.source_type == "detail_page_scraping":
            entries, result = CrawlerService.crawl_detail_scraping_source(
                option, soup, existing_guids, max_items=max_items
            )
        elif option.source_type == "page_scraping":
            entries, result = CrawlerService.crawl_page_scraping_source(
                option, soup, existing_guids, max_items=max_items
            )
        else:
            raise Exception(f"Unknown source type: {option.source_type}")
        for entry in result:
            if feed:
                entry.feed = feed
            if source:
                entry.source = source
        return entries, result

    @staticmethod
    def get_user_sources(user) -> list[RSSEverythingSource]:
        """사용자의 소스 목록 조회"""
        return list(RSSEverythingSource.objects.filter(feed__user=user))

    @staticmethod
    def get_source(user, source_id: int) -> RSSEverythingSource:
        """소스 상세 조회"""
        return get_object_or_404(RSSEverythingSource, id=source_id, feed__user=user)

    @staticmethod
    def create_source(user, feed_id: int, data: dict) -> RSSEverythingSource:
        """기존 피드에 새 소스 추가"""
        feed = get_object_or_404(RSSFeed, id=feed_id, user=user)

        source_type = data.get("source_type", "rss")
        if data.get("follow_links") and source_type not in ["detail_page_scraping"]:
            source_type = "detail_page_scraping"

        source = RSSEverythingSource.objects.create(
            feed=feed,
            source_type=source_type,
            is_active=True,
            url=data.get("url", ""),
            custom_headers=data.get("custom_headers", {}),
            item_selector=data.get("item_selector", ""),
            title_selector=data.get("title_selector", ""),
            link_selector=data.get("link_selector", ""),
            description_selector=data.get("description_selector", ""),
            date_selector=data.get("date_selector", ""),
            image_selector=data.get("image_selector", ""),
            detail_title_selector=data.get("detail_title_selector", ""),
            detail_description_selector=data.get("detail_description_selector", ""),
            detail_date_selector=data.get("detail_date_selector", ""),
            detail_image_selector=data.get("detail_image_selector", ""),
            exclude_selectors=data.get("exclude_selectors", []),
            date_formats=data.get("date_formats", []),
            date_locale=data.get("date_locale", "ko_KR"),
            use_browser=data.get("use_browser", True),
            browser_service=data.get("browser_service", "realbrowser"),
            wait_selector=data.get("wait_selector", "body"),
            timeout=data.get("timeout", 30000),
        )

        return source

    @staticmethod
    def update_source(user, source_id: int, data: dict) -> RSSEverythingSource:
        """소스 수정"""
        source = get_object_or_404(RSSEverythingSource, id=source_id, feed__user=user)

        update_fields = []

        if data.get("url") is not None:
            source.url = data["url"]
            update_fields.append("url")

        if data.get("source_type") is not None:
            source.source_type = data["source_type"]
            update_fields.append("source_type")

        if data.get("custom_headers") is not None:
            source.custom_headers = data["custom_headers"]
            update_fields.append("custom_headers")

        if data.get("is_active") is not None:
            source.is_active = data["is_active"]
            update_fields.append("is_active")

        if data.get("follow_links") is not None:
            source.source_type = (
                "detail_page_scraping" if data["follow_links"] else "page_scraping"
            )
            update_fields.append("source_type")

        for field in [
            "item_selector",
            "title_selector",
            "link_selector",
            "description_selector",
            "date_selector",
            "image_selector",
            "detail_title_selector",
            "detail_description_selector",
            "detail_date_selector",
            "detail_image_selector",
            "exclude_selectors",
            "date_formats",
            "date_locale",
            "use_browser",
            "browser_service",
            "wait_selector",
            "timeout",
        ]:
            if data.get(field) is not None:
                setattr(source, field, data[field])
                update_fields.append(field)

        if update_fields:
            source.save(update_fields=update_fields + ["updated_at"])

        return source

    @staticmethod
    def delete_source(user, source_id: int) -> bool:
        """소스 삭제 - 연결된 피드도 함께 삭제"""
        get_object_or_404(RSSEverythingSource, id=source_id, feed__user=user)
        return True

    @staticmethod
    def refresh_source(user, source_id: int) -> dict:
        """소스 새로고침"""
        from feeds.tasks import update_feed_items

        source = get_object_or_404(RSSEverythingSource, id=source_id, feed__user=user)

        task_result = FeedTaskResult.objects.create(
            feed=source.feed,
            status=FeedTaskResult.Status.PENDING,
        )

        update_feed_items.delay(source.feed_id, task_result_id=task_result.id)

        return {
            "success": True,
            "task_result_id": task_result.id,
            "message": "Refresh task started",
        }

    @staticmethod
    def add_source_to_feed(
        user, feed_id: int, data: SourceCreateSchema
    ) -> RSSEverythingSource:
        """피드에 새 소스 추가"""
        feed = get_object_or_404(RSSFeed, id=feed_id, user=user)

        source = RSSEverythingSource.objects.create(
            feed=feed, is_active=True, **data.dict()
        )
        return source

    @staticmethod
    def update_feed_source(
        user, feed_id: int, source_id: int, data: SourceUpdateSchema
    ) -> RSSEverythingSource:
        """피드의 소스 업데이트"""
        feed = get_object_or_404(RSSFeed, id=feed_id, user=user)
        source = get_object_or_404(RSSEverythingSource, id=source_id, feed=feed)

        for field, value in data.dict(exclude_unset=True).items():
            if value is not None:
                setattr(source, field, value)

        source.save()
        return source

    @staticmethod
    def delete_feed_source(user, feed_id: int, source_id: int) -> bool:
        """피드의 소스 삭제"""
        from ninja.errors import HttpError

        feed = get_object_or_404(RSSFeed, id=feed_id, user=user)
        source = get_object_or_404(RSSEverythingSource, id=source_id, feed=feed)

        if feed.sources.count() <= 1:
            raise HttpError(400, "Cannot delete the last source of a feed")

        source.delete()
        return True

    @staticmethod
    def crawl_with_pagination(
        user,
        source_id: int,
        url_template: str,
        variables: list[dict],
        delay_ms: int = 1000,
        keep_query_params: bool = True,
    ) -> dict:
        """
        페이지네이션을 사용하여 여러 페이지를 순회하며 크롤링 (비동기 task 호출)

        Args:
            source_id: 소스 설정을 가져올 소스 ID
            url_template: URL 템플릿 (예: "https://example.com?page={page}")
            variables: 변수 목록 [{"name": "page", "start": 1, "end": 10, "step": 1}]
            delay_ms: 각 요청 사이의 딜레이 (밀리초)

        Returns:
            dict: {success, task_id, task_result_id, message}
        """
        from feeds.models import FeedTaskResult
        from feeds.tasks import crawl_paginated_task

        # 소스 가져오기 (권한 확인)
        source = get_object_or_404(RSSEverythingSource, id=source_id, feed__user=user)
        feed = source.feed

        # Task 결과 레코드 생성
        task_result = FeedTaskResult.objects.create(
            feed=feed,
            status=FeedTaskResult.Status.PENDING,
        )

        # Celery task 호출
        task = crawl_paginated_task.delay(
            source_id=source_id,
            url_template=url_template,
            variables=variables,
            delay_ms=delay_ms,
            task_result_id=task_result.id,
            keep_query_params=keep_query_params,
        )

        # Task ID 업데이트
        task_result.task_id = task.id
        task_result.save(update_fields=["task_id"])

        return {
            "success": True,
            "task_id": task.id,
            "task_result_id": task_result.id,
            "message": f"Pagination crawl task scheduled",
        }
