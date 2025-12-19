"""
Web Scraper Utilities - 웹 페이지 크롤링 관련 유틸리티 함수
"""

from typing import Optional, TypedDict
from bs4 import BeautifulSoup
from urllib.parse import urljoin
import logging

from feeds.utils.html_parser import (
    extract_text,
    extract_html,
    extract_html_with_css,
    extract_href,
    extract_src
)

# 타입 정의
class CrawledItem(TypedDict):
    """크롤링된 아이템 타입"""
    title: str
    link: str
    description: str
    date: str
    image: str

class ListCrawledItem(CrawledItem):
    """목록 페이지에서 크롤링된 아이템 타입"""
    guid: str
    author: str
    categories: list[str]

logger = logging.getLogger(__name__)

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
    wait_selector: str = "body",
    custom_headers: Optional[dict] = None,
    exclude_selectors: Optional[list] = None,
    follow_links: bool = True,
    existing_guids: Optional[set] = None,
    max_items: int = 20,
    use_html_with_css: bool = True,
    fetch_html_func=None,
) -> list[CrawledItem]:
    """
    상세 페이지 크롤링 공통 로직
    _crawl_detail_pages와 preview_items에서 공통으로 사용하는 로직을 추출

    Args:
        items: 목록 페이지의 아이템 요소들
        base_url: 기본 URL
        item_selector: 아이템 선택자
        title_selector: 제목 선택자
        link_selector: 링크 선택자
        description_selector: 설명 선택자
        date_selector: 날짜 선택자
        image_selector: 이미지 선택자
        detail_title_selector: 상세 페이지 제목 선택자
        detail_description_selector: 상세 페이지 설명 선택자
        detail_content_selector: 상세 페이지 내용 선택자
        detail_date_selector: 상세 페이지 날짜 선택자
        detail_image_selector: 상세 페이지 이미지 선택자
        use_browser: 브라우저 사용 여부
        wait_selector: 대기 선택자
        custom_headers: 커스텀 헤더
        exclude_selectors: 제외할 선택자 목록
        follow_links: 링크 따라가기 여부
        existing_guids: 기존 GUID 집합 (중복 방지)
        max_items: 최대 아이템 수
        use_html_with_css: HTML + CSS 사용 여부
        fetch_html_func: HTML 가져오기 함수 (의존성 주입)

    Returns:
        크롤링된 아이템 목록 (TypedDict 형식)
    """
    from feeds.browser_crawler import fetch_html_with_browser, fetch_html_smart

    if existing_guids is None:
        existing_guids = set()

    new_items = []
    links_to_fetch = []

    # 먼저 목록에서 링크들을 수집
    for item in items[:max_items]:
        if link_selector:
            link_el = item.select_one(link_selector)
        else:
            link_el = item.select_one("a[href]")

        if link_el:
            href = extract_href(link_el, base_url)
            if href:
                # GUID 체크 (existing_guids가 제공된 경우에만)
                if href in existing_guids:
                    continue

                # 목록에서 기본 정보도 가져옴
                title = ""
                if title_selector:
                    title_el = item.select_one(title_selector)
                    if title_el:
                        title = extract_text(title_el)
                if not title:
                    title = extract_text(link_el)

                links_to_fetch.append({"link": href, "list_title": title})

    # 각 상세 페이지 가져오기
    for item_info in links_to_fetch:
        try:
            # fetch_html_func가 제공되지 않으면 기본 함수 사용
            if fetch_html_func:
                detail_result = fetch_html_func(
                    url=item_info["link"],
                    use_browser=use_browser,
                    wait_selector=wait_selector,
                    timeout=30000,
                    custom_headers=custom_headers,
                )
            else:
                # 기본 구현
                if use_browser:
                    result = fetch_html_with_browser(
                        url=item_info["link"],
                        selector=wait_selector,
                        timeout=30000,
                        custom_headers=custom_headers,
                    )
                else:
                    result = fetch_html_smart(
                        url=item_info["link"],
                        use_browser_on_fail=True,
                        custom_headers=custom_headers,
                    )
                detail_result = {
                    "success": result.success,
                    "html": result.html if result.success else None,
                    "url": result.url or item_info["link"],
                    "error": result.error if not result.success else None,
                }

            if not detail_result.get("success") or not detail_result.get("html"):
                continue

            detail_soup = BeautifulSoup(detail_result["html"], "html.parser")

            # exclude_selectors 적용 - 지정된 요소들 제거
            if exclude_selectors:
                for exclude_selector in exclude_selectors:
                    for el in detail_soup.select(exclude_selector):
                        el.decompose()

            # 상세 페이지에서 정보 추출
            title = ""
            if detail_title_selector:
                title_el = detail_soup.select_one(detail_title_selector)
                title = extract_text(title_el) if title_el else ""
            if not title:
                title = item_info["list_title"]
            if not title:
                # 최후의 fallback: 페이지의 <title> 태그 사용
                title_tag = detail_soup.find("title")
                title = extract_text(title_tag) if title_tag else ""

            if not title:
                continue

            # description 추출
            description = ""
            if use_html_with_css:
                if detail_description_selector:
                    desc_el = detail_soup.select_one(detail_description_selector)
                    if desc_el:
                        description = extract_html_with_css(
                            desc_el, detail_soup, item_info["link"]
                        )
                elif detail_content_selector:
                    content_el = detail_soup.select_one(detail_content_selector)
                    if content_el:
                        description = extract_html_with_css(
                            content_el, detail_soup, item_info["link"]
                        )
            else:
                if detail_description_selector:
                    desc_el = detail_soup.select_one(detail_description_selector)
                    if desc_el:
                        description = extract_html(
                            desc_el, item_info["link"]
                        )
                elif detail_content_selector:
                    content_el = detail_soup.select_one(detail_content_selector)
                    if content_el:
                        description = extract_html(
                            content_el, item_info["link"]
                        )

            # 날짜 추출
            date = ""
            if detail_date_selector:
                date_el = detail_soup.select_one(detail_date_selector)
                date = extract_text(date_el) if date_el else ""

            # 이미지 추출
            image = ""
            if detail_image_selector:
                img_el = detail_soup.select_one(detail_image_selector)
                image = extract_src(img_el, item_info["link"]) if img_el else ""

            new_items.append({
                "title": title,
                "link": item_info["link"],
                "description": description,
                "date": date,
                "image": image,
            })
        except Exception as e:
            logger.warning(f"Failed to fetch detail page {item_info['link']}: {e}")
            continue

    return new_items

def crawl_list_page_items(
    items: list,
    base_url: str,
    title_selector: str = "",
    link_selector: str = "",
    description_selector: str = "",
    date_selector: str = "",
    image_selector: str = "",
    author_selector: str = "",
    categories_selector: str = "",
    existing_guids: Optional[set] = None,
    max_items: int = 20,
) -> list[ListCrawledItem]:
    """
    목록 페이지에서 직접 아이템을 크롤링

    Args:
        items: 아이템 요소들
        base_url: 기본 URL
        title_selector: 제목 선택자
        link_selector: 링크 선택자
        description_selector: 설명 선택자
        date_selector: 날짜 선택자
        image_selector: 이미지 선택자
        author_selector: 작성자 선택자
        categories_selector: 카테고리 선택자
        existing_guids: 기존 GUID 집합 (중복 방지)
        max_items: 최대 아이템 수

    Returns:
        크롤링된 아이템 목록 (TypedDict 형식)
    """
    if existing_guids is None:
        existing_guids = set()

    new_items = []

    for item in items[:max_items]:
        # 제목 추출
        title = ""
        title_el = (
            item.select_one(title_selector) if title_selector else None
        )
        if title_el:
            title = title_el.get_text(strip=True)

        # title_selector가 없으면 link_selector에서 제목 추출
        if not title and link_selector:
            link_el = item.select_one(link_selector)
            if link_el:
                title = link_el.get_text(strip=True)

        if not title:
            continue

        # 링크 추출
        link = ""
        if link_selector:
            link_el = item.select_one(link_selector)
        else:
            link_el = title_el

        if link_el:
            href = link_el.get("href")
            if not href:
                a_tag = link_el.find("a")
                if a_tag:
                    href = a_tag.get("href")
            if href:
                link = urljoin(base_url, href)

        # GUID 생성
        guid = link if link else f"{base_url}#{title[:100]}"
        if guid in existing_guids:
            continue

        # 설명 추출 (HTML 블록으로)
        description = ""
        if description_selector:
            desc_el = item.select_one(description_selector)
            if desc_el:
                description = extract_html(desc_el, base_url)

        # 날짜 추출
        date = ""
        if date_selector:
            date_el = item.select_one(date_selector)
            if date_el:
                date = date_el.get_text(strip=True)

        # 작성자 추출
        author = ""
        if author_selector:
            author_el = item.select_one(author_selector)
            if author_el:
                author = author_el.get_text(strip=True)[:255]

        # 카테고리 추출
        categories = []
        if categories_selector:
            cat_els = item.select(categories_selector)
            categories = [
                el.get_text(strip=True) for el in cat_els if el.get_text(strip=True)
            ][:10]

        # 이미지 추출
        image = ""
        if image_selector:
            img_el = item.select_one(image_selector)
            if img_el:
                image = extract_src(img_el, base_url)

        new_items.append({
            "title": title,
            "link": link,
            "description": description,
            "date": date,
            "guid": guid,
            "author": author,
            "categories": categories,
            "image": image,
        })

    return new_items
