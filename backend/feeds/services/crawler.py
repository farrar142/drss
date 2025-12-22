"""
Crawler Service - 소스 타입별 크롤링 로직을 통합 관리
"""

from logging import getLogger
from time import struct_time
from datetime import datetime, timezone
from typing import Any, Callable, Optional, Tuple, List, Set
from urllib.parse import urljoin
from bs4 import BeautifulSoup
from django.utils import timezone as django_timezone

from base.utils import Maybe
from feeds.schemas.source import CrawlRequest
from feeds.utils.date_parser import parse_date
from feeds.utils.html_parser import extract_src, extract_html
from feeds.utils.html_utils import strip_html_tags
from feeds.browser_crawler import fetch_html_with_browser, fetch_html_smart


from feeds.models import RSSEverythingSource, RSSFeed, RSSItem

logger = getLogger(__name__)


class CrawlerService:
    """소스 타입별 크롤링 로직을 통합 관리하는 서비스"""

    # ==========================================
    # HTML 가져오기 (공통)
    # ==========================================

    @staticmethod
    def fetch_html(
        url: str,
        use_browser: bool = True,
        browser_service: str = "realbrowser",
        wait_selector: str = "body",
        timeout: int = 30000,
        custom_headers: Optional[dict] = None,
        use_cache: bool = True,
    ):
        """URL에서 HTML을 가져옴"""
        if use_browser:
            return fetch_html_with_browser(
                url=url,
                selector=wait_selector,
                timeout=timeout,
                custom_headers=custom_headers,
                service=browser_service,
                use_cache=use_cache,
            )
        else:
            return fetch_html_smart(
                url=url,
                use_browser_on_fail=True,
                browser_selector=wait_selector,
                custom_headers=custom_headers,
                browser_service=browser_service,
            )

    @staticmethod
    def fetch_html_for_source(
        option: CrawlRequest, url: Optional[str] = None, use_cache: bool = True
    ):
        """소스 설정을 사용하여 HTML 가져오기"""
        target_url = url or option.url
        return CrawlerService.fetch_html(
            url=target_url,
            use_browser=option.use_browser,
            browser_service=option.browser_service or "realbrowser",
            wait_selector=option.wait_selector or "body",
            timeout=option.timeout or 30000,
            custom_headers=option.custom_headers,
            use_cache=use_cache,
        )

    # ==========================================
    # 아이템 파싱 (공통)
    # ==========================================

    @staticmethod
    def parse_list_page_items(
        option: CrawlRequest,
        soup: BeautifulSoup,
        existing_guids: Set[str],
        max_items: int = 30,
    ) -> list[RSSItem]:
        """
        목록 페이지에서 아이템을 파싱하여 RSSItem 객체 리스트 반환
        PAGE_SCRAPING과 페이지네이션 크롤링에서 공통으로 사용
        """
        from feeds.models import RSSItem

        # exclude_selectors 적용
        if option.exclude_selectors:
            for exclude_selector in option.exclude_selectors:
                for el in soup.select(exclude_selector):
                    el.decompose()

        # 아이템 선택
        items = soup.select(option.item_selector) if option.item_selector else []

        # web_scraper 모듈 사용하여 아이템 추출
        crawled_items = []

        for item in items[:max_items]:
            # 제목 추출
            title = ""
            title_el = (
                item.select_one(option.title_selector)
                if option.title_selector
                else None
            )
            if title_el:
                title = title_el.get_text(strip=True)

            # title_selector가 없으면 link_selector에서 제목 추출
            if not title and option.link_selector:
                link_el = item.select_one(option.link_selector)
                if link_el:
                    title = link_el.get_text(strip=True)

            if not title:
                continue

            # 링크 추출
            link = ""
            if option.link_selector:
                link_el = item.select_one(option.link_selector)
            else:
                link_el = title_el

            if link_el:
                href = link_el.get("href")
                if not href:
                    a_tag = link_el.find("a")
                    if a_tag:
                        href = a_tag.get("href")
                if href:
                    link = urljoin(option.url, Maybe.of(href).instanceof(str))

            # GUID 생성
            guid = link if link else f"{option.url}#{title[:100]}"
            if guid in existing_guids:
                continue

            # 설명 추출 (HTML 블록으로)
            description = ""
            if option.description_selector:
                desc_el = item.select_one(option.description_selector)
                if desc_el:
                    description = extract_html(desc_el, option.url)

            # 날짜 추출
            date = ""
            if option.date_selector:
                date_el = item.select_one(option.date_selector)
                if date_el:
                    date = date_el.get_text(strip=True)

            # 작성자 추출
            author = ""
            if option.author_selector:
                author_el = item.select_one(option.author_selector)
                if author_el:
                    author = author_el.get_text(strip=True)[:255]

            # 이미지 추출
            image = ""
            if option.image_selector:
                img_el = item.select_one(option.image_selector)
                if img_el:
                    image = extract_src(img_el, option.url)

            crawled_items.append(
                {
                    "title": title,
                    "link": link,
                    "description": description,
                    "date": date,
                    "guid": guid,
                    "author": author,
                    "image": image,
                }
            )

        # 딕셔너리 → RSSItem 객체 변환
        new_items = []
        for item in crawled_items:
            # 날짜 파싱
            published_at = django_timezone.now()
            if item["date"] and option.date_formats:
                parsed_date = parse_date(item["date"], option.date_formats)
                if parsed_date:
                    published_at = parsed_date

            new_items.append(
                RSSItem(
                    title=item["title"][:199],
                    link=item["link"],
                    description=item["description"],
                    description_text=strip_html_tags(item["description"]),
                    published_at=published_at,
                    guid=item["guid"][:499],
                    author=item["author"],
                    image=item["image"],
                )
            )

        return new_items

    @staticmethod
    def parse_detail_page(
        option: CrawlRequest,
        soup: BeautifulSoup,
        detail_url: str,
        list_data: dict = dict(),
    ) -> dict:
        """
        상세 페이지에서 정보를 파싱하여 딕셔너리 반환
        """
        # 제목
        title = list_data.get("title", "")
        if option.detail_title_selector:
            title_el = soup.select_one(option.detail_title_selector)
            if title_el:
                title = title_el.get_text(strip=True)[:199]

        # 설명/컨텐츠
        description = ""
        if option.detail_content_selector:
            content_el = soup.select_one(option.detail_content_selector)
            if content_el:
                description = str(content_el)
        elif option.detail_description_selector:
            desc_el = soup.select_one(option.detail_description_selector)
            if desc_el:
                description = str(desc_el)

        # 날짜
        date_str = list_data.get("date", "")
        if option.detail_date_selector:
            date_el = soup.select_one(option.detail_date_selector)
            if date_el:
                date_str = date_el.get_text(strip=True)

        # 이미지
        image = list_data.get("image", "")
        if option.detail_image_selector:
            img_el = soup.select_one(option.detail_image_selector)
            if img_el:
                image = img_el.get("src") or img_el.get("data-src") or ""
                if image:
                    image = urljoin(detail_url, image)  # type:ignore

        # 이미지가 없으면 description에서 추출
        if not image and description:
            desc_soup = BeautifulSoup(description, "html.parser")
            img_tag = desc_soup.find("img")
            if img_tag and img_tag.get("src"):
                image = urljoin(detail_url, img_tag.get("src"))  # type:ignore

        # 날짜 파싱
        published_at = django_timezone.now()
        if date_str and option.date_formats:
            parsed_date = parse_date(date_str, option.date_formats)
            if parsed_date:
                published_at = parsed_date

        return {
            "title": title or "No Title",
            "link": detail_url,
            "description": description,
            "description_text": strip_html_tags(description),
            "published_at": published_at,
            "guid": detail_url[:499],
            "author": "",
            "image": image,
        }

    # ==========================================
    # RSS 소스 크롤링
    # ==========================================

    @staticmethod
    def crawl_rss_source(
        html: str,
        source: Optional[Any] = None,
        existing_guids: Set[str] = set(),
        max_items: int = 30,
    ) -> Tuple[int, list[RSSItem]]:
        """
        RSS/Atom 소스에서 아이템 크롤링

        Returns:
            (items_found, new_items): 발견된 아이템 수와 새 RSSItem 객체 리스트
        """
        from feeds.models import RSSItem
        import feedparser
        from feedparser import FeedParserDict

        feed_data = feedparser.parse(html)

        new_items = []
        for entry in feed_data.entries[:max_items]:
            if not isinstance(entry, FeedParserDict):
                continue

            # GUID 생성
            guid = (
                getattr(entry, "id", None) or getattr(entry, "guid", None) or entry.link
            )
            if guid in existing_guids:
                continue
            guid = str(guid)[:499]

            # 제목
            title = getattr(entry, "title", "No Title")
            if not isinstance(title, str):
                continue
            title = title[:199]

            # 설명
            description = ""
            if hasattr(entry, "description"):
                description = entry.description
            elif hasattr(entry, "summary"):
                description = entry.summary

            # 링크
            link = getattr(entry, "link", "")
            if not isinstance(link, str):
                continue

            # 발행일
            published_at = django_timezone.now()
            if hasattr(entry, "published_parsed") and entry.published_parsed:
                if isinstance(entry.published_parsed, struct_time):
                    published_at = datetime(
                        *entry.published_parsed[:6], tzinfo=timezone.utc
                    )
            elif hasattr(entry, "updated_parsed") and entry.updated_parsed:
                if isinstance(entry.updated_parsed, struct_time):
                    published_at = datetime(
                        *entry.updated_parsed[:6], tzinfo=timezone.utc
                    )

            # 작성자
            author = ""
            if hasattr(entry, "author"):
                author = str(entry.author)[:255] if entry.author else ""
            elif hasattr(entry, "author_detail") and entry.author_detail:
                author = str(getattr(entry.author_detail, "name", ""))[:255]

            # 이미지
            image = ""
            if hasattr(entry, "enclosures") and entry.enclosures:
                for enclosure in entry.enclosures:
                    if (
                        hasattr(enclosure, "type")
                        and enclosure.type
                        and "image" in enclosure.type
                    ):
                        image = getattr(enclosure, "href", "")
                        break

            # RSS에 이미지가 없으면 description에서 추출
            if not image and description and isinstance(description, str):
                desc_soup = BeautifulSoup(description, "html.parser")
                img_tag = desc_soup.find("img")
                if img_tag and img_tag.get("src"):
                    image = img_tag.get("src")

            new_items.append(
                RSSItem(
                    source=source,
                    title=title,
                    link=link,
                    description=description,
                    description_text=strip_html_tags(description),  # type:ignore
                    author=author,
                    image=image,
                    published_at=published_at,
                    guid=guid,
                )
            )

        return len(feed_data.entries), new_items

    # ==========================================
    # 페이지 스크래핑 소스 크롤링
    # ==========================================

    @staticmethod
    def crawl_page_scraping_source(
        option: CrawlRequest,
        soup: BeautifulSoup,
        existing_guids: Set[str] = set(),
        callback: Callable[[RSSItem], None] = lambda x: None,
        max_items: int = 30,
    ) -> Tuple[int, list[RSSItem]]:
        """
        페이지 스크래핑 소스에서 아이템 크롤링

        Args:
            feed: RSSFeed 객체
            source: RSSEverythingSource 객체
            existing_guids: 기존 GUID 집합
            url: 크롤링할 URL (없으면 source.url 사용)
            use_cache: 캐시 사용 여부

        Returns:
            (items_found, new_items): 발견된 아이템 수와 새 RSSItem 객체 리스트
        """
        # 아이템 파싱
        new_items = CrawlerService.parse_list_page_items(
            option, soup, existing_guids, max_items
        )

        # feed 설정
        for item in new_items:
            callback(item)

        items_found = (
            len(soup.select(option.item_selector)) if option.item_selector else 0
        )

        return items_found, new_items

    # ==========================================
    # 상세 페이지 스크래핑 - 목록 URL 추출
    # ==========================================

    @staticmethod
    def extract_detail_urls(
        option: CrawlRequest,
        soup: BeautifulSoup,
        existing_guids: Set[str],
        max_items: int = 30,
    ) -> list:
        """
        메인 페이지에서 상세 페이지 URL들을 추출

        Returns:
            [{"detail_url": str, "list_data": dict}, ...]
        """
        # HTML 가져오기

        # exclude_selectors 적용
        if option.exclude_selectors:
            for exclude_selector in option.exclude_selectors:
                for el in soup.select(exclude_selector):
                    el.decompose()

        items = soup.select(option.item_selector) if option.item_selector else []

        detail_tasks_data = []
        for item in items[:max_items]:
            # 링크 추출
            link = None
            if option.link_selector:
                link_el = item.select_one(option.link_selector)
                if link_el:
                    link = link_el.get("href")
            else:
                link_el = item.select_one("a")
                if link_el:
                    link = link_el.get("href")

            if not link:
                continue

            link = urljoin(option.url, link)  # type:ignore

            # 이미 존재하면 스킵
            if link[:499] in existing_guids:
                continue

            # 목록에서 추출 가능한 정보
            list_data = {"title": "", "date": "", "image": ""}

            if option.title_selector:
                title_el = item.select_one(option.title_selector)
                if title_el:
                    list_data["title"] = title_el.get_text(strip=True)[:199]

            if option.date_selector:
                date_el = item.select_one(option.date_selector)
                if date_el:
                    list_data["date"] = date_el.get_text(strip=True)

            if option.image_selector:
                img_el = item.select_one(option.image_selector)
                if img_el:
                    list_data["image"] = Maybe.of(
                        img_el.get("src") or img_el.get("data-src") or ""
                    ).instanceof(
                        str
                    )  # type:ignore
                    if list_data["image"]:
                        list_data["image"] = urljoin(option.url, list_data["image"])

            detail_tasks_data.append(
                {
                    "detail_url": link,
                    "list_data": list_data,
                }
            )

        return detail_tasks_data

    @staticmethod
    def crawl_detail_page(
        option: CrawlRequest, detail_url: str, list_data: dict = dict()
    ):
        """
        단일 상세 페이지 크롤링하여 RSSItem 생성

        Returns:
            RSSItem 객체 또는 None
        """
        from feeds.models import RSSItem

        # HTML 가져오기
        result = CrawlerService.fetch_html_for_source(option, url=detail_url)

        if not result.success or not result.html:
            raise Exception(result.error or "Failed to fetch HTML")

        soup = BeautifulSoup(result.html, "html.parser")

        # exclude_selectors 적용
        if option.exclude_selectors:
            for exclude_selector in option.exclude_selectors:
                for el in soup.select(exclude_selector):
                    el.decompose()

        # 상세 페이지 파싱
        parsed = CrawlerService.parse_detail_page(option, soup, detail_url, list_data)

        # RSSItem 생성
        return RSSItem(
            title=parsed["title"],
            link=parsed["link"],
            description=parsed["description"],
            description_text=parsed["description_text"],
            published_at=parsed["published_at"],
            guid=parsed["guid"],
            author=parsed["author"],
            image=parsed["image"],
        )

    @staticmethod
    def crawl_detail_scraping_source(
        option: CrawlRequest,
        soup: BeautifulSoup,
        existing_guids: Set[str] = set(),
        callback: Callable[[RSSItem], None] = lambda x: None,
        max_items: int = 30,
    ):
        detail_item_urls = CrawlerService.extract_detail_urls(
            option, soup, existing_guids, max_items=max_items
        )
        print("Detail URLs to crawl:", len(detail_item_urls))
        new_items: list[RSSItem] = []
        for detail_task in detail_item_urls:
            detail_url = detail_task["detail_url"]
            list_data = detail_task["list_data"]
            try:
                item = CrawlerService.crawl_detail_page(option, detail_url, list_data)
                if item:
                    callback(item)
                    new_items.append(item)
            except Exception as e:
                logger.error(f"Failed to crawl detail page {detail_url}: {e}")
            callback(item)
        return len(detail_item_urls), new_items

    # ==========================================
    # 페이지네이션 크롤링
    # ==========================================

    @staticmethod
    def generate_pagination_urls(url_template: str, variables: list) -> list:
        """
        URL 템플릿과 변수로 페이지네이션 URL 목록 생성

        Args:
            url_template: URL 템플릿 (예: "https://example.com?page={page}")
            variables: 변수 목록 [{"name": "page", "start": 1, "end": 10, "step": 1}]

        Returns:
            URL 문자열 리스트
        """
        import itertools

        if not variables:
            return [url_template]

        # 변수별 값 범위 생성
        variable_ranges = []
        for var in variables:
            name = var.get("name", "page")
            start = var.get("start", 1)
            end = var.get("end", 1)
            step = var.get("step", 1)
            values = list(range(start, end + 1, step))
            variable_ranges.append((name, values))

        # 모든 조합 생성
        if len(variable_ranges) == 1:
            name, values = variable_ranges[0]
            return [url_template.replace(f"{{{name}}}", str(v)) for v in values]
        else:
            names = [vr[0] for vr in variable_ranges]
            value_lists = [vr[1] for vr in variable_ranges]
            combinations = list(itertools.product(*value_lists))
            urls = []
            for combo in combinations:
                url = url_template
                for name, value in zip(names, combo):
                    url = url.replace(f"{{{name}}}", str(value))
                urls.append(url)
            return urls
