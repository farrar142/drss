"""
Source Service - RSS Everything 소스 관련 비즈니스 로직
"""

from typing import Optional
import logging

from django.shortcuts import get_object_or_404
from bs4 import BeautifulSoup
from urllib.parse import urljoin
import re

from feeds.models import RSSFeed, RSSEverythingSource, FeedTaskResult
from feeds.browser_crawler import fetch_html_with_browser, fetch_html_smart
from feeds.schemas import SourceCreateSchema, SourceUpdateSchema

logger = logging.getLogger(__name__)


class SourceService:
    """RSS Everything 소스 관련 비즈니스 로직"""

    # ============== Helper Functions ==============

    @staticmethod
    def generate_selector(soup: BeautifulSoup, element) -> str:
        """요소에 대한 고유한 CSS 셀렉터 생성"""
        parts = []
        current = element

        while current and current.name:
            if current.name == "[document]":
                break

            selector = current.name

            if current.get("id"):
                selector = f"#{current.get('id')}"
                parts.insert(0, selector)
                break

            classes = current.get("class", [])
            if classes:
                stable_classes = [
                    c for c in classes if not re.match(r"^[a-z]+-[a-f0-9]+$", c, re.I)
                ]
                if stable_classes:
                    selector += "." + ".".join(stable_classes[:2])

            if current.parent:
                siblings = [
                    s for s in current.parent.children if s.name == current.name
                ]
                if len(siblings) > 1:
                    index = siblings.index(current) + 1
                    selector += f":nth-of-type({index})"

            parts.insert(0, selector)
            current = current.parent

        return " > ".join(parts)

    @staticmethod
    def extract_text(element) -> str:
        """요소에서 텍스트 추출"""
        if element is None:
            return ""
        return element.get_text(strip=True)

    @staticmethod
    def extract_css_from_html(soup: BeautifulSoup, base_url: str = "") -> str:
        """HTML 문서에서 모든 CSS를 추출"""
        import requests

        css_parts = []

        for style_tag in soup.find_all("style"):
            css_text = style_tag.get_text()
            if css_text.strip():
                css_parts.append(css_text)

        link_tags = soup.find_all("link", rel="stylesheet")
        for link_tag in link_tags[:5]:
            href = link_tag.get("href")
            if not href:
                continue

            css_url = urljoin(base_url, href)

            try:
                response = requests.get(css_url, timeout=3)
                if response.status_code == 200:
                    css_parts.append(f"/* From: {css_url} */\n{response.text}")
            except Exception as e:
                logger.debug(f"Failed to fetch CSS from {css_url}: {e}")
                continue

        return "\n".join(css_parts)

    @staticmethod
    def extract_html_with_css(element, soup: BeautifulSoup, base_url: str = "") -> str:
        """요소의 HTML 블록과 함께 CSS를 추출"""
        if element is None:
            return ""

        css = SourceService.extract_css_from_html(soup, base_url)
        html = SourceService.extract_html(element, base_url)

        if css.strip():
            return f"<style>{css}</style>\n{html}"

        return html

    @staticmethod
    def extract_html(element, base_url: str = "") -> str:
        """요소의 HTML 블록 전체를 추출 (상대 URL을 절대 URL로 변환)"""
        if element is None:
            return ""

        from copy import copy

        element_copy = copy(element)

        if base_url:
            for img in element_copy.find_all("img"):
                for attr in ["src", "data-src", "data-lazy-src"]:
                    if img.get(attr):
                        img[attr] = urljoin(base_url, img[attr])

            for a in element_copy.find_all("a"):
                if a.get("href"):
                    a["href"] = urljoin(base_url, a["href"])

            for media in element_copy.find_all(["video", "source", "audio"]):
                if media.get("src"):
                    media["src"] = urljoin(base_url, media["src"])

        return str(element_copy)

    @staticmethod
    def extract_href(element, base_url: str) -> str:
        """요소에서 href 추출"""
        if element is None:
            return ""

        href = element.get("href")
        if not href:
            a_tag = element.find("a")
            if a_tag:
                href = a_tag.get("href")

        if href:
            return urljoin(base_url, href)
        return ""

    @staticmethod
    def extract_src(element, base_url: str) -> str:
        """요소에서 이미지 src 추출"""
        if element is None:
            return ""

        src = (
            element.get("src")
            or element.get("data-src")
            or element.get("data-lazy-src")
        )
        if not src:
            img_tag = element.find("img")
            if img_tag:
                src = (
                    img_tag.get("src")
                    or img_tag.get("data-src")
                    or img_tag.get("data-lazy-src")
                )

        if src:
            return urljoin(base_url, src)
        return ""

    # ============== Service Methods ==============

    @staticmethod
    def fetch_html(
        url: str,
        use_browser: bool = True,
        wait_selector: str = "body",
        timeout: int = 30000,
        custom_headers: dict = None,
    ) -> dict:
        """URL에서 HTML을 가져옴"""
        try:
            if use_browser:
                result = fetch_html_with_browser(
                    url=url,
                    selector=wait_selector,
                    timeout=timeout,
                    custom_headers=custom_headers,
                )
            else:
                result = fetch_html_smart(
                    url=url,
                    use_browser_on_fail=True,
                    browser_selector=wait_selector,
                    custom_headers=custom_headers,
                )

            if result.success:
                return {
                    "success": True,
                    "html": result.html,
                    "url": result.url or url,
                }
            else:
                return {
                    "success": False,
                    "url": url,
                    "error": result.error,
                }
        except Exception as e:
            logger.exception(f"Failed to fetch HTML from {url}")
            return {
                "success": False,
                "url": url,
                "error": str(e),
            }

    @staticmethod
    def extract_elements(html: str, selector: str, base_url: str) -> dict:
        """HTML에서 CSS 셀렉터로 요소들을 추출"""
        try:
            soup = BeautifulSoup(html, "html.parser")
            elements = soup.select(selector)

            result_elements = []
            for el in elements[:50]:
                href = SourceService.extract_href(el, base_url)
                src = SourceService.extract_src(el, base_url)

                result_elements.append(
                    {
                        "tag": el.name,
                        "text": SourceService.extract_text(el)[:500],
                        "html": str(el)[:2000],
                        "href": href if href else None,
                        "src": src if src else None,
                        "selector": SourceService.generate_selector(soup, el),
                    }
                )

            return {
                "success": True,
                "elements": result_elements,
                "count": len(elements),
            }
        except Exception as e:
            logger.exception(f"Failed to extract elements with selector: {selector}")
            return {
                "success": False,
                "error": str(e),
            }

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
        wait_selector: str = "body",
        custom_headers: dict = None,
        exclude_selectors: list = None,
        follow_links: bool = False,
        detail_title_selector: str = "",
        detail_description_selector: str = "",
        detail_content_selector: str = "",
        detail_date_selector: str = "",
        detail_image_selector: str = "",
    ) -> dict:
        """설정된 셀렉터로 아이템들을 미리보기"""
        try:
            # HTML 가져오기
            fetch_result = SourceService.fetch_html(
                url=url,
                use_browser=use_browser,
                wait_selector=wait_selector,
                timeout=30000,
                custom_headers=custom_headers,
            )

            if not fetch_result["success"] or not fetch_result.get("html"):
                return {
                    "success": False,
                    "error": fetch_result.get("error") or "Failed to fetch HTML",
                }

            soup = BeautifulSoup(fetch_result["html"], "html.parser")

            # exclude_selectors 적용
            if exclude_selectors:
                for exclude_selector in exclude_selectors:
                    for el in soup.select(exclude_selector):
                        el.decompose()

            items = soup.select(item_selector)
            preview_items = []

            if follow_links:
                # 상세 페이지 파싱 모드
                links_to_fetch = []
                for item in items[:10]:
                    if link_selector:
                        link_el = item.select_one(link_selector)
                    else:
                        link_el = item.select_one("a[href]")

                    if link_el:
                        link = SourceService.extract_href(link_el, url)
                        if link:
                            title_el = (
                                item.select_one(title_selector)
                                if title_selector
                                else None
                            )
                            title = (
                                SourceService.extract_text(title_el) if title_el else ""
                            )
                            if not title and link_el:
                                title = SourceService.extract_text(link_el)
                            links_to_fetch.append({"link": link, "list_title": title})

                # 각 상세 페이지 가져오기
                for item_info in links_to_fetch:
                    try:
                        detail_result = SourceService.fetch_html(
                            url=item_info["link"],
                            use_browser=use_browser,
                            wait_selector=wait_selector,
                            timeout=30000,
                            custom_headers=custom_headers,
                        )

                        if not detail_result["success"] or not detail_result.get(
                            "html"
                        ):
                            continue

                        detail_soup = BeautifulSoup(
                            detail_result["html"], "html.parser"
                        )

                        # 상세 페이지에서 정보 추출
                        title = ""
                        if detail_title_selector:
                            title_el = detail_soup.select_one(detail_title_selector)
                            title = (
                                SourceService.extract_text(title_el) if title_el else ""
                            )
                        if not title:
                            title = item_info["list_title"]
                        if not title:
                            title_tag = detail_soup.find("title")
                            title = (
                                SourceService.extract_text(title_tag)
                                if title_tag
                                else ""
                            )

                        description = ""
                        if detail_description_selector:
                            desc_el = detail_soup.select_one(
                                detail_description_selector
                            )
                            description = (
                                SourceService.extract_html_with_css(
                                    desc_el, detail_soup, item_info["link"]
                                )
                                if desc_el
                                else ""
                            )
                        elif detail_content_selector:
                            content_el = detail_soup.select_one(detail_content_selector)
                            description = (
                                SourceService.extract_html_with_css(
                                    content_el, detail_soup, item_info["link"]
                                )
                                if content_el
                                else ""
                            )

                        date = ""
                        if detail_date_selector:
                            date_el = detail_soup.select_one(detail_date_selector)
                            date = (
                                SourceService.extract_text(date_el) if date_el else ""
                            )

                        image = ""
                        if detail_image_selector:
                            img_el = detail_soup.select_one(detail_image_selector)
                            image = (
                                SourceService.extract_src(img_el, item_info["link"])
                                if img_el
                                else ""
                            )

                        if title:
                            preview_items.append(
                                {
                                    "title": title,
                                    "link": item_info["link"],
                                    "description": description,
                                    "date": date,
                                    "image": image,
                                }
                            )
                    except Exception as e:
                        logger.warning(
                            f"Failed to fetch detail page {item_info['link']}: {e}"
                        )
                        continue
            else:
                # 목록 페이지 직접 파싱 모드
                for item in items[:20]:
                    title_el = (
                        item.select_one(title_selector) if title_selector else None
                    )
                    title = SourceService.extract_text(title_el) if title_el else ""

                    if link_selector:
                        link_el = item.select_one(link_selector)
                    else:
                        link_el = title_el
                    link = SourceService.extract_href(link_el, url) if link_el else ""

                    desc_el = (
                        item.select_one(description_selector)
                        if description_selector
                        else None
                    )
                    description = (
                        SourceService.extract_html(desc_el, url) if desc_el else ""
                    )

                    date_el = item.select_one(date_selector) if date_selector else None
                    date = SourceService.extract_text(date_el) if date_el else ""

                    img_el = item.select_one(image_selector) if image_selector else None
                    image = SourceService.extract_src(img_el, url) if img_el else ""

                    if title:
                        preview_items.append(
                            {
                                "title": title,
                                "link": link,
                                "description": description,
                                "date": date,
                                "image": image,
                            }
                        )

            return {
                "success": True,
                "items": preview_items,
                "count": len(items),
            }
        except Exception as e:
            logger.exception(f"Failed to preview items from {url}")
            return {
                "success": False,
                "error": str(e),
            }

    @staticmethod
    def get_user_sources(user) -> list:
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
