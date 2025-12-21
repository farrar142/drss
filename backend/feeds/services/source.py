"""
Source Service - RSS Everything 소스 관련 비즈니스 로직
"""

from typing import Optional
import logging

from django.shortcuts import get_object_or_404
from bs4 import BeautifulSoup
from urllib.parse import urljoin
import re
from ninja import Schema

from feeds.models import RSSFeed, RSSEverythingSource, FeedTaskResult
from feeds.browser_crawler import fetch_html_with_browser, fetch_html_smart
from feeds.utils.html_parser import (
    generate_selector,
    extract_text,
    extract_css_from_html,
    extract_html_with_css,
    extract_html,
    extract_href,
    extract_src,
)
from feeds.utils.web_scraper import crawl_detail_page_items, CrawledItem, ListCrawledItem
from feeds.schemas import SourceCreateSchema, SourceUpdateSchema

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
    """preview_items 함수 응답 타입"""
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

    # ============== Helper Functions ==============

    # HTML 파싱 관련 함수들은 feeds.utils.html_parser로 이동됨
    # 아래 메서드들은 호환성을 위해 유지되지만, 새로운 코드에서는 직접 html_parser를 사용하세요

    # ============== Service Methods ==============

    @staticmethod
    def fetch_html(
        url: str,
        use_browser: bool = True,
        browser_service: str = "realbrowser",
        wait_selector: str = "body",
        timeout: int = 30000,
        custom_headers: Optional[dict] = None,
        use_cache: bool = True,
    ) -> FetchHtmlResponse:
        """URL에서 HTML을 가져옴"""
        try:
            if use_browser:
                result = fetch_html_with_browser(
                    url=url,
                    selector=wait_selector,
                    timeout=timeout,
                    custom_headers=custom_headers,
                    service=browser_service,
                    use_cache=use_cache,
                )
            else:
                result = fetch_html_smart(
                    url=url,
                    use_browser_on_fail=True,
                    browser_selector=wait_selector,
                    custom_headers=custom_headers,
                    use_cache=use_cache,
                )

            if result.success:
                return FetchHtmlResponse(
                    success=True,
                    html=result.html,
                    url=result.url or url,
                )
            else:
                return FetchHtmlResponse(
                    success=False,
                    url=url,
                    error=result.error,
                )
        except Exception as e:
            logger.exception(f"Failed to fetch HTML from {url}")
            return FetchHtmlResponse(
                success=False,
                url=url,
                error=str(e),
            )

    @staticmethod
    def extract_elements(html: str, selector: str, base_url: str) -> ExtractElementsResponse:
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
    def crawl_detail_page_items(
        items: list,
        base_url: str,
        item_selector: str = "",
        title_selector: str = "",
        link_selector: str = "",
        description_selector: str = "",
        date_selector: str = "",
        image_selector: str = "",
        detail_title_selector: str = "",
        detail_description_selector: str = "",
        detail_content_selector: str = "",
        detail_date_selector: str = "",
        detail_image_selector: str = "",
        use_browser: bool = True,
        browser_service: str = "realbrowser",
        wait_selector: str = "body",
        custom_headers: Optional[dict] = None,
        exclude_selectors: Optional[list] = None,
        follow_links: bool = True,
        existing_guids: Optional[set] = None,
        max_items: int = 20,
        use_html_with_css: bool = True,
    ) -> list[CrawledItem]:
        """
        상세 페이지 크롤링 공통 로직
        web_scraper.crawl_detail_page_items를 사용하도록 리팩토링
        """
        # web_scraper 모듈 사용
        return crawl_detail_page_items(
            items=items,
            base_url=base_url,
            item_selector=item_selector,
            title_selector=title_selector,
            link_selector=link_selector,
            description_selector=description_selector,
            date_selector=date_selector,
            image_selector=image_selector,
            detail_title_selector=detail_title_selector,
            detail_description_selector=detail_description_selector,
            detail_content_selector=detail_content_selector,
            detail_date_selector=detail_date_selector,
            detail_image_selector=detail_image_selector,
            use_browser=use_browser,
            browser_service=browser_service,
            wait_selector=wait_selector,
            custom_headers=custom_headers,
            exclude_selectors=exclude_selectors,
            follow_links=follow_links,
            existing_guids=existing_guids,
            max_items=max_items,
            use_html_with_css=use_html_with_css,
            fetch_html_func=SourceService.fetch_html,
        )

    @staticmethod
    def preview_items(
        url: str,
        item_selector: str,
        title_selector: str = "",
        link_selector: str = "",
        description_selector: str = "",
        date_selector: str = "",
        image_selector: str = "",
        use_browser: bool = True,
        browser_service: str = "realbrowser",
        wait_selector: str = "body",
        custom_headers: Optional[dict] = None,
        exclude_selectors: Optional[list] = None,
        follow_links: bool = False,
        detail_title_selector: str = "",
        detail_description_selector: str = "",
        detail_content_selector: str = "",
        detail_date_selector: str = "",
        detail_image_selector: str = "",
    ) -> PreviewItemsResponse:
        """설정된 셀렉터로 아이템들을 미리보기"""
        try:
            # HTML 가져오기
            fetch_result = SourceService.fetch_html(
                url=url,
                use_browser=use_browser,
                browser_service=browser_service,
                wait_selector=wait_selector,
                timeout=30000,
                custom_headers=custom_headers,
            )

            if not fetch_result.success or not fetch_result.html:
                return PreviewItemsResponse(
                    success=False,
                    items=[],
                    count=0,
                    error=fetch_result.error or "Failed to fetch HTML",
                )

            soup = BeautifulSoup(fetch_result.html, "html.parser")

            # exclude_selectors 적용
            if exclude_selectors:
                for exclude_selector in exclude_selectors:
                    for el in soup.select(exclude_selector):
                        el.decompose()

            items = soup.select(item_selector)
            preview_items = []

            if follow_links:
                # 상세 페이지 파싱 모드 - 공통 함수 사용
                crawled_items = SourceService.crawl_detail_page_items(
                    items=items[:5],
                    base_url=url,
                    item_selector=item_selector,
                    title_selector=title_selector,
                    link_selector=link_selector,
                    description_selector=description_selector,
                    date_selector=date_selector,
                    image_selector=image_selector,
                    detail_title_selector=detail_title_selector,
                    detail_description_selector=detail_description_selector,
                    detail_content_selector=detail_content_selector,
                    detail_date_selector=detail_date_selector,
                    detail_image_selector=detail_image_selector,
                    use_browser=use_browser,
                    browser_service=browser_service,
                    wait_selector=wait_selector,
                    custom_headers=custom_headers,
                    exclude_selectors=exclude_selectors,
                    follow_links=True,
                    existing_guids=None,
                    max_items=10,
                    use_html_with_css=True,
                )

                # 결과 변환
                for item in crawled_items:
                    if item["title"]:
                        preview_items.append(
                            PreviewItemSchema(
                                title=item["title"],
                                link=item["link"],
                                description=item["description"],
                                date=item["date"],
                                image=item["image"],
                            )
                        )
            else:
                # 목록 페이지 직접 파싱 모드
                for item in items[:20]:
                    title_el = (
                        item.select_one(title_selector) if title_selector else None
                    )
                    title = extract_text(title_el) if title_el else ""

                    if link_selector:
                        link_el = item.select_one(link_selector)
                    else:
                        link_el = title_el
                    link = extract_href(link_el, url) if link_el else ""

                    desc_el = (
                        item.select_one(description_selector)
                        if description_selector
                        else None
                    )
                    description = (
                        extract_html(desc_el, url) if desc_el else ""
                    )

                    date_el = item.select_one(date_selector) if date_selector else None
                    date = extract_text(date_el) if date_el else ""

                    img_el = item.select_one(image_selector) if image_selector else None
                    image = extract_src(img_el, url) if img_el else ""

                    if title:
                        preview_items.append(
                            PreviewItemSchema(
                                title=title,
                                link=link,
                                description=description,
                                date=date,
                                image=image,
                            )
                        )

            return PreviewItemsResponse(
                success=True,
                items=preview_items,
                count=len(items),
            )
        except Exception as e:
            logger.exception(f"Failed to preview items from {url}")
            return PreviewItemsResponse(
                success=False,
                items=[],
                count=0,
                error=str(e),
            )

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
            detail_content_selector=data.get("detail_content_selector", ""),
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
            "detail_content_selector",
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
        source = get_object_or_404(RSSEverythingSource, id=source_id, feed__user=user)
        source.feed.delete()
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
            feed=feed,
            source_type=data.source_type,
            is_active=True,
            url=data.url,
            custom_headers=data.custom_headers,
            item_selector=data.item_selector,
            title_selector=data.title_selector,
            link_selector=data.link_selector,
            description_selector=data.description_selector,
            date_selector=data.date_selector,
            image_selector=data.image_selector,
            detail_title_selector=data.detail_title_selector,
            detail_description_selector=data.detail_description_selector,
            detail_content_selector=data.detail_content_selector,
            detail_date_selector=data.detail_date_selector,
            detail_image_selector=data.detail_image_selector,
            exclude_selectors=data.exclude_selectors,
            date_formats=data.date_formats,
            date_locale=data.date_locale,
            use_browser=data.use_browser,
            browser_service=data.browser_service,
            wait_selector=data.wait_selector,
            timeout=data.timeout,
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
    ) -> dict:
        """
        페이지네이션을 사용하여 여러 페이지를 순회하며 크롤링
        
        Args:
            source_id: 소스 설정을 가져올 소스 ID
            url_template: URL 템플릿 (예: "https://example.com?page={page}")
            variables: 변수 목록 [{"name": "page", "start": 1, "end": 10, "step": 1}]
            delay_ms: 각 요청 사이의 딜레이 (밀리초)
        
        Returns:
            dict: {success, total_pages, total_items_found, total_items_created, errors, message}
        """
        import time
        import itertools
        from feeds.models import RSSItem
        from feeds.utils.html_utils import strip_html_tags
        from feeds.utils.date_parser import parse_date
        from django.utils import timezone as django_timezone

        # 소스 가져오기
        source = get_object_or_404(RSSEverythingSource, id=source_id, feed__user=user)
        feed = source.feed

        # 변수별 값 범위 생성
        variable_ranges = []
        for var in variables:
            name = var.get("name", "page")
            start = var.get("start", 1)
            end = var.get("end", 1)
            step = var.get("step", 1)
            values = list(range(start, end + 1, step))
            variable_ranges.append((name, values))

        # 모든 조합 생성 (여러 변수가 있을 경우 Cartesian product)
        if len(variable_ranges) == 1:
            name, values = variable_ranges[0]
            url_combinations = [(url_template.replace(f"{{{name}}}", str(v)),) for v in values]
        else:
            # 여러 변수의 조합
            names = [vr[0] for vr in variable_ranges]
            value_lists = [vr[1] for vr in variable_ranges]
            combinations = list(itertools.product(*value_lists))
            url_combinations = []
            for combo in combinations:
                url = url_template
                for name, value in zip(names, combo):
                    url = url.replace(f"{{{name}}}", str(value))
                url_combinations.append((url,))

        total_pages = len(url_combinations)
        total_items_found = 0
        total_items_created = 0
        errors = []

        # 기존 GUID 목록 가져오기
        existing_guids = set(
            RSSItem.objects.filter(feed=feed).values_list("guid", flat=True)
        )

        logger.info(f"Starting pagination crawl for source {source_id}: {total_pages} pages")

        for i, (url,) in enumerate(url_combinations):
            try:
                logger.info(f"Crawling page {i + 1}/{total_pages}: {url}")

                # HTML 가져오기
                fetch_result = SourceService.fetch_html(
                    url=url,
                    use_browser=source.use_browser,
                    browser_service=source.browser_service or "realbrowser",
                    wait_selector=source.wait_selector or "body",
                    timeout=source.timeout or 30000,
                    custom_headers=source.custom_headers,
                    use_cache=False,  # 페이지네이션은 캐시 사용 안함
                )

                if not fetch_result.success or not fetch_result.html:
                    errors.append(f"Page {i + 1} ({url}): {fetch_result.error or 'Failed to fetch'}")
                    continue

                soup = BeautifulSoup(fetch_result.html, "html.parser")

                # exclude_selectors 적용
                if source.exclude_selectors:
                    for exclude_selector in source.exclude_selectors:
                        for el in soup.select(exclude_selector):
                            el.decompose()

                # 아이템 추출
                items = soup.select(source.item_selector) if source.item_selector else []
                total_items_found += len(items)

                # 아이템 파싱 및 저장
                new_items = []
                for item in items:
                    # 링크 추출
                    link = None
                    if source.link_selector:
                        link_el = item.select_one(source.link_selector)
                        if link_el:
                            link = link_el.get("href")
                    else:
                        link_el = item.select_one("a")
                        if link_el:
                            link = link_el.get("href")

                    if not link:
                        continue

                    link = urljoin(url, link)
                    guid = link[:499]

                    if guid in existing_guids:
                        continue

                    existing_guids.add(guid)

                    # 제목 추출
                    title = ""
                    if source.title_selector:
                        title_el = item.select_one(source.title_selector)
                        if title_el:
                            title = extract_text(title_el)[:199]

                    # 설명 추출
                    description = ""
                    if source.description_selector:
                        desc_el = item.select_one(source.description_selector)
                        if desc_el:
                            description = str(desc_el)

                    # 날짜 추출
                    date_str = ""
                    if source.date_selector:
                        date_el = item.select_one(source.date_selector)
                        if date_el:
                            date_str = extract_text(date_el)

                    # 이미지 추출
                    image = ""
                    if source.image_selector:
                        img_el = item.select_one(source.image_selector)
                        if img_el:
                            image = img_el.get("src") or img_el.get("data-src") or ""
                            if image:
                                image = urljoin(url, image)

                    # 날짜 파싱
                    published_at = django_timezone.now()
                    if date_str and source.date_formats:
                        parsed_date = parse_date(date_str, source.date_formats)
                        if parsed_date:
                            published_at = parsed_date

                    new_items.append(RSSItem(
                        feed=feed,
                        source=source,
                        title=title or "No Title",
                        link=link,
                        description=description,
                        description_text=strip_html_tags(description),
                        published_at=published_at,
                        guid=guid,
                        author="",
                        categories=[],
                        image=image,
                    ))

                # Bulk create
                if new_items:
                    created = RSSItem.objects.bulk_create(new_items)
                    total_items_created += len(created)
                    logger.info(f"Page {i + 1}: created {len(created)} items")

                # 딜레이
                if i < len(url_combinations) - 1 and delay_ms > 0:
                    time.sleep(delay_ms / 1000.0)

            except Exception as e:
                logger.exception(f"Error crawling page {i + 1}: {url}")
                errors.append(f"Page {i + 1} ({url}): {str(e)}")

        # 피드 업데이트
        if total_items_created > 0:
            feed.last_updated = django_timezone.now()
            feed.save()

        return {
            "success": len(errors) == 0 or total_items_created > 0,
            "total_pages": total_pages,
            "total_items_found": total_items_found,
            "total_items_created": total_items_created,
            "errors": errors,
            "message": f"Crawled {total_pages} pages, found {total_items_found} items, created {total_items_created} new items"
            + (f", {len(errors)} errors" if errors else ""),
        }
