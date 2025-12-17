"""
RSSEverything Router: 웹 페이지를 RSS 피드로 변환하는 기능
"""

from ninja import Router
from django.shortcuts import get_object_or_404
from django.utils import timezone
from typing import Optional
from pydantic import BaseModel, Field
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
import re
import logging

from feeds.models import RSSCategory, RSSFeed, RSSEverythingSource
from base.authentications import JWTAuth
from feeds.browser_crawler import fetch_html_with_browser, fetch_html_smart, WaitUntil

logger = logging.getLogger(__name__)

router = Router()


# ============== Schemas ==============


class FetchHTMLRequest(BaseModel):
    """HTML 가져오기 요청"""

    url: str
    use_browser: bool = True
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
    selector: str  # 이 요소를 찾기 위한 CSS 셀렉터


class ExtractElementsRequest(BaseModel):
    """요소 추출 요청"""

    html: str
    selector: str
    base_url: str  # 상대 URL 변환용


class ExtractElementsResponse(BaseModel):
    """요소 추출 응답"""

    success: bool
    elements: list[ElementInfo] = []
    count: int = 0
    error: Optional[str] = None


class PreviewItemRequest(BaseModel):
    """아이템 미리보기 요청 - 선택한 셀렉터로 아이템 추출 테스트"""

    url: str
    item_selector: str
    title_selector: str = ""
    link_selector: str = ""
    description_selector: str = ""
    date_selector: str = ""
    image_selector: str = ""
    use_browser: bool = True
    wait_selector: str = "body"
    custom_headers: dict = Field(default_factory=dict)
    exclude_selectors: list[str] = Field(default_factory=list)

    # 상세 페이지 파싱 옵션
    follow_links: bool = False
    detail_title_selector: str = ""
    detail_description_selector: str = ""
    detail_content_selector: str = ""
    detail_date_selector: str = ""
    detail_image_selector: str = ""


class PreviewItem(BaseModel):
    """미리보기 아이템"""

    title: str
    link: str
    description: str = ""
    date: str = ""
    image: str = ""


class PreviewItemResponse(BaseModel):
    """아이템 미리보기 응답"""

    success: bool
    items: list[PreviewItem] = []
    count: int = 0
    error: Optional[str] = None


class RSSEverythingCreateRequest(BaseModel):
    """RSSEverything 소스 생성 요청"""

    # RSSFeed 생성에 필요한 정보
    name: str  # Feed 이름
    url: str  # 크롤링할 URL
    category_id: int  # Feed가 속할 카테고리 (필수)

    # RSSFeed 옵션
    refresh_interval: int = 60
    custom_headers: dict = Field(default_factory=dict)

    # 셀렉터 설정
    item_selector: str
    title_selector: str = ""
    link_selector: str = ""
    description_selector: str = ""
    date_selector: str = ""
    image_selector: str = ""

    follow_links: bool = False
    detail_title_selector: str = ""
    detail_description_selector: str = ""
    detail_content_selector: str = ""
    detail_date_selector: str = ""
    detail_image_selector: str = ""

    exclude_selectors: list[str] = Field(default_factory=list)
    date_formats: list[str] = Field(default_factory=list)
    date_locale: str = "ko_KR"

    use_browser: bool = True
    wait_selector: str = "body"
    timeout: int = 30000


class RSSEverythingUpdateRequest(BaseModel):
    """RSSEverything 소스 수정 요청"""

    item_selector: Optional[str] = None
    title_selector: Optional[str] = None
    link_selector: Optional[str] = None
    description_selector: Optional[str] = None
    date_selector: Optional[str] = None
    image_selector: Optional[str] = None

    follow_links: Optional[bool] = None
    detail_title_selector: Optional[str] = None
    detail_description_selector: Optional[str] = None
    detail_content_selector: Optional[str] = None
    detail_date_selector: Optional[str] = None
    detail_image_selector: Optional[str] = None

    exclude_selectors: Optional[list[str]] = None
    date_formats: Optional[list[str]] = None
    date_locale: Optional[str] = None

    use_browser: Optional[bool] = None
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

    follow_links: bool  # source_type이 detail_page_scraping이면 True
    detail_title_selector: str
    detail_description_selector: str
    detail_content_selector: str
    detail_date_selector: str
    detail_image_selector: str

    exclude_selectors: list[str]
    date_formats: list[str]
    date_locale: str

    use_browser: bool
    wait_selector: str
    timeout: int
    custom_headers: dict

    last_crawled_at: Optional[str]
    last_error: str
    created_at: str
    updated_at: str

    @staticmethod
    def from_orm(obj: RSSEverythingSource) -> "RSSEverythingSchema":
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
            follow_links=obj.source_type == "detail_page_scraping",
            detail_title_selector=obj.detail_title_selector or "",
            detail_description_selector=obj.detail_description_selector or "",
            detail_content_selector=obj.detail_content_selector or "",
            detail_date_selector=obj.detail_date_selector or "",
            detail_image_selector=obj.detail_image_selector or "",
            exclude_selectors=obj.exclude_selectors or [],
            date_formats=obj.date_formats or [],
            date_locale=obj.date_locale or "ko_KR",
            use_browser=obj.use_browser,
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


# ============== Helper Functions ==============


def generate_selector(soup: BeautifulSoup, element) -> str:
    """요소에 대한 고유한 CSS 셀렉터 생성"""
    parts = []
    current = element

    while current and current.name:
        if current.name == "[document]":
            break

        selector = current.name

        # ID가 있으면 사용
        if current.get("id"):
            selector = f"#{current.get('id')}"
            parts.insert(0, selector)
            break

        # 클래스가 있으면 사용
        classes = current.get("class", [])
        if classes:
            # 동적으로 생성된 것 같은 클래스 필터링
            stable_classes = [
                c for c in classes if not re.match(r"^[a-z]+-[a-f0-9]+$", c, re.I)
            ]
            if stable_classes:
                selector += "." + ".".join(stable_classes[:2])  # 최대 2개 클래스

        # 형제 중 인덱스 계산
        if current.parent:
            siblings = [s for s in current.parent.children if s.name == current.name]
            if len(siblings) > 1:
                index = siblings.index(current) + 1
                selector += f":nth-of-type({index})"

        parts.insert(0, selector)
        current = current.parent

    return " > ".join(parts)


def extract_text(element) -> str:
    """요소에서 텍스트 추출"""
    if element is None:
        return ""
    return element.get_text(strip=True)


def extract_css_from_html(soup: BeautifulSoup, base_url: str = "") -> str:
    """
    HTML 문서에서 모든 CSS를 추출합니다.
    - inline <style> 태그
    - 외부 <link rel="stylesheet"> 파일 (다운로드)
    """
    import requests

    css_parts = []

    # 1. inline <style> 태그 추출
    for style_tag in soup.find_all("style"):
        css_text = style_tag.get_text()
        if css_text.strip():
            css_parts.append(css_text)

    # 2. 외부 CSS 파일 다운로드 (최대 5개, 타임아웃 3초)
    link_tags = soup.find_all("link", rel="stylesheet")
    for link_tag in link_tags[:5]:  # 최대 5개만
        href = link_tag.get("href")
        if not href:
            continue

        # 절대 URL로 변환
        css_url = urljoin(base_url, href)

        try:
            response = requests.get(css_url, timeout=3)
            if response.status_code == 200:
                css_parts.append(f"/* From: {css_url} */\n{response.text}")
        except Exception as e:
            logger.debug(f"Failed to fetch CSS from {css_url}: {e}")
            continue

    return "\n".join(css_parts)


def extract_html_with_css(element, soup: BeautifulSoup, base_url: str = "") -> str:
    """
    요소의 HTML 블록과 함께 CSS를 추출하여 <style> 태그로 포함합니다.
    """
    if element is None:
        return ""

    # CSS 추출
    css = extract_css_from_html(soup, base_url)

    # HTML 추출 (URL 변환 포함)
    html = extract_html(element, base_url)

    # CSS가 있으면 <style> 태그와 함께 반환
    if css.strip():
        return f"<style>{css}</style>\n{html}"

    return html


def extract_html(element, base_url: str = "") -> str:
    """
    요소의 HTML 블록 전체를 추출 (이미지 등의 상대 URL을 절대 URL로 변환)
    """
    if element is None:
        return ""

    # 복사본을 만들어서 URL 변환
    from copy import copy

    element_copy = copy(element)

    # 상대 URL을 절대 URL로 변환
    if base_url:
        # img src 변환
        for img in element_copy.find_all("img"):
            for attr in ["src", "data-src", "data-lazy-src"]:
                if img.get(attr):
                    img[attr] = urljoin(base_url, img[attr])

        # a href 변환
        for a in element_copy.find_all("a"):
            if a.get("href"):
                a["href"] = urljoin(base_url, a["href"])

        # video/source src 변환
        for media in element_copy.find_all(["video", "source", "audio"]):
            if media.get("src"):
                media["src"] = urljoin(base_url, media["src"])

    return str(element_copy)


def extract_href(element, base_url: str) -> str:
    """요소에서 href 추출 (상대 URL을 절대 URL로 변환)"""
    if element is None:
        return ""

    # 직접 href가 있는 경우
    href = element.get("href")
    if not href:
        # 내부에서 a 태그 찾기
        a_tag = element.find("a")
        if a_tag:
            href = a_tag.get("href")

    if href:
        return urljoin(base_url, href)
    return ""


def extract_src(element, base_url: str) -> str:
    """요소에서 이미지 src 추출"""
    if element is None:
        return ""

    # 직접 src가 있는 경우 (img 태그)
    src = element.get("src") or element.get("data-src") or element.get("data-lazy-src")
    if not src:
        # 내부에서 img 태그 찾기
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


# ============== API Endpoints ==============


@router.post("/fetch-html", response=FetchHTMLResponse, auth=JWTAuth())
def fetch_html(request, data: FetchHTMLRequest):
    """
    URL에서 HTML을 가져옵니다.
    브라우저 렌더링을 사용하여 JavaScript로 생성된 콘텐츠도 가져올 수 있습니다.
    """
    try:
        if data.use_browser:
            result = fetch_html_with_browser(
                url=data.url,
                selector=data.wait_selector,
                timeout=data.timeout,
                custom_headers=data.custom_headers if data.custom_headers else None,
            )
        else:
            result = fetch_html_smart(
                url=data.url,
                use_browser_on_fail=True,
                browser_selector=data.wait_selector,
                custom_headers=data.custom_headers if data.custom_headers else None,
            )

        if result.success:
            return FetchHTMLResponse(
                success=True,
                html=result.html,
                url=result.url or data.url,
            )
        else:
            return FetchHTMLResponse(
                success=False,
                url=data.url,
                error=result.error,
            )
    except Exception as e:
        logger.exception(f"Failed to fetch HTML from {data.url}")
        return FetchHTMLResponse(
            success=False,
            url=data.url,
            error=str(e),
        )


@router.post("/extract-elements", response=ExtractElementsResponse, auth=JWTAuth())
def extract_elements(request, data: ExtractElementsRequest):
    """
    HTML에서 CSS 셀렉터로 요소들을 추출합니다.
    프론트엔드에서 사용자가 선택한 요소의 정보를 확인하는 데 사용됩니다.
    """
    try:
        soup = BeautifulSoup(data.html, "html.parser")
        elements = soup.select(data.selector)

        result_elements = []
        for el in elements[:50]:  # 최대 50개
            href = extract_href(el, data.base_url)
            src = extract_src(el, data.base_url)

            result_elements.append(
                ElementInfo(
                    tag=el.name,
                    text=extract_text(el)[:500],  # 텍스트 최대 500자
                    html=str(el)[:2000],  # HTML 최대 2000자
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
        logger.exception(f"Failed to extract elements with selector: {data.selector}")
        return ExtractElementsResponse(
            success=False,
            error=str(e),
        )


@router.post("/preview-items", response=PreviewItemResponse, auth=JWTAuth())
def preview_items(request, data: PreviewItemRequest):
    """
    설정된 셀렉터로 아이템들을 미리보기합니다.
    실제 저장하기 전에 셀렉터가 올바르게 작동하는지 확인할 수 있습니다.

    follow_links=True인 경우:
    - 목록 페이지에서 링크 수집
    - 각 상세 페이지에서 detail_*_selector로 내용 추출
    """
    try:
        # HTML 가져오기
        if data.use_browser:
            result = fetch_html_with_browser(
                url=data.url,
                selector=data.wait_selector,
                timeout=30000,
                custom_headers=data.custom_headers if data.custom_headers else None,
            )
        else:
            result = fetch_html_smart(
                url=data.url,
                use_browser_on_fail=True,
                custom_headers=data.custom_headers if data.custom_headers else None,
            )

        if not result.success or not result.html:
            return PreviewItemResponse(
                success=False,
                error=result.error or "Failed to fetch HTML",
            )

        soup = BeautifulSoup(result.html, "html.parser")

        # exclude_selectors 적용 - 지정된 요소들 제거
        if data.exclude_selectors:
            for exclude_selector in data.exclude_selectors:
                for el in soup.select(exclude_selector):
                    el.decompose()

        items = soup.select(data.item_selector)

        preview_items = []

        if data.follow_links:
            # 상세 페이지 파싱 모드
            # 먼저 목록에서 링크들을 수집
            links_to_fetch = []
            for item in items[:10]:  # 상세 페이지는 최대 10개만
                if data.link_selector:
                    link_el = item.select_one(data.link_selector)
                else:
                    link_el = item.select_one("a[href]")

                if link_el:
                    link = extract_href(link_el, data.url)
                    if link:
                        # 목록에서 기본 정보도 가져옴
                        title_el = (
                            item.select_one(data.title_selector)
                            if data.title_selector
                            else None
                        )
                        title = extract_text(title_el) if title_el else ""
                        # title_selector가 없으면 link_selector에서 제목 추출 시도
                        if not title and link_el:
                            title = extract_text(link_el)
                        links_to_fetch.append({"link": link, "list_title": title})

            # 각 상세 페이지 가져오기
            for item_info in links_to_fetch:
                try:
                    if data.use_browser:
                        detail_result = fetch_html_with_browser(
                            url=item_info["link"],
                            selector=data.wait_selector,
                            timeout=30000,
                            custom_headers=(
                                data.custom_headers if data.custom_headers else None
                            ),
                        )
                    else:
                        detail_result = fetch_html_smart(
                            url=item_info["link"],
                            use_browser_on_fail=True,
                            custom_headers=(
                                data.custom_headers if data.custom_headers else None
                            ),
                        )

                    if not detail_result.success or not detail_result.html:
                        continue

                    detail_soup = BeautifulSoup(detail_result.html, "html.parser")

                    # 상세 페이지에서 정보 추출
                    title = ""
                    if data.detail_title_selector:
                        title_el = detail_soup.select_one(data.detail_title_selector)
                        title = extract_text(title_el) if title_el else ""
                    if not title:
                        title = item_info["list_title"]  # fallback to list title
                    if not title:
                        # 최후의 fallback: 페이지의 <title> 태그 사용
                        title_tag = detail_soup.find("title")
                        title = extract_text(title_tag) if title_tag else ""

                    # description은 HTML 블록 + CSS로 저장
                    description = ""
                    if data.detail_description_selector:
                        desc_el = detail_soup.select_one(
                            data.detail_description_selector
                        )
                        description = (
                            extract_html_with_css(
                                desc_el, detail_soup, item_info["link"]
                            )
                            if desc_el
                            else ""
                        )
                    elif data.detail_content_selector:
                        content_el = detail_soup.select_one(
                            data.detail_content_selector
                        )
                        description = (
                            extract_html_with_css(
                                content_el, detail_soup, item_info["link"]
                            )
                            if content_el
                            else ""
                        )

                    date = ""
                    if data.detail_date_selector:
                        date_el = detail_soup.select_one(data.detail_date_selector)
                        date = extract_text(date_el) if date_el else ""

                    image = ""
                    if data.detail_image_selector:
                        img_el = detail_soup.select_one(data.detail_image_selector)
                        image = extract_src(img_el, item_info["link"]) if img_el else ""

                    if title:
                        preview_items.append(
                            PreviewItem(
                                title=title,
                                link=item_info["link"],
                                description=description,
                                date=date,
                                image=image,
                            )
                        )
                except Exception as e:
                    logger.warning(
                        f"Failed to fetch detail page {item_info['link']}: {e}"
                    )
                    continue
        else:
            # 목록 페이지 직접 파싱 모드
            for item in items[:20]:  # 최대 20개 미리보기
                # 제목 추출
                title_el = (
                    item.select_one(data.title_selector)
                    if data.title_selector
                    else None
                )
                title = extract_text(title_el) if title_el else ""

                # 링크 추출
                if data.link_selector:
                    link_el = item.select_one(data.link_selector)
                else:
                    link_el = title_el  # link_selector가 없으면 title에서 링크 추출
                link = extract_href(link_el, data.url) if link_el else ""

                # 설명 추출 (HTML 블록으로)
                desc_el = (
                    item.select_one(data.description_selector)
                    if data.description_selector
                    else None
                )
                description = extract_html(desc_el, data.url) if desc_el else ""

                # 날짜 추출
                date_el = (
                    item.select_one(data.date_selector) if data.date_selector else None
                )
                date = extract_text(date_el) if date_el else ""

                # 이미지 추출
                img_el = (
                    item.select_one(data.image_selector)
                    if data.image_selector
                    else None
                )
                image = extract_src(img_el, data.url) if img_el else ""

                if title:  # 제목이 있는 경우만 추가
                    preview_items.append(
                        PreviewItem(
                            title=title,
                            link=link,
                            description=description,
                            date=date,
                            image=image,
                        )
                    )

        return PreviewItemResponse(
            success=True,
            items=preview_items,
            count=len(items),
        )
    except Exception as e:
        logger.exception(f"Failed to preview items from {data.url}")
        return PreviewItemResponse(
            success=False,
            error=str(e),
        )


@router.get("", response=list[RSSEverythingSchema], auth=JWTAuth())
def list_sources(request):
    """사용자의 RSSEverything 소스 목록 조회"""
    sources = RSSEverythingSource.objects.filter(feed__user=request.auth)
    return [RSSEverythingSchema.from_orm(s) for s in sources]


@router.get("/{source_id}", response=RSSEverythingSchema, auth=JWTAuth())
def get_source(request, source_id: int):
    """RSSEverything 소스 상세 조회"""
    source = get_object_or_404(
        RSSEverythingSource, id=source_id, feed__user=request.auth
    )
    return RSSEverythingSchema.from_orm(source)


@router.post("", response=RSSEverythingSchema, auth=JWTAuth())
def create_source(request, data: RSSEverythingCreateRequest):
    """
    새 RSSEverything 소스 생성
    RSSFeed를 먼저 생성하고, RSSEverythingSource를 연결합니다.
    """
    from django.db import transaction
    from feeds.utils import extract_favicon_url

    category = get_object_or_404(RSSCategory, id=data.category_id, user=request.auth)

    # Favicon 추출
    favicon_url = extract_favicon_url(data.url)

    # source_type 결정
    source_type = "detail_page_scraping" if data.follow_links else "page_scraping"

    # 트랜잭션으로 RSSFeed와 RSSEverythingSource를 함께 생성
    with transaction.atomic():
        # RSSFeed 먼저 생성
        feed = RSSFeed.objects.create(
            user=request.auth,
            category=category,
            title=data.name,
            favicon_url=favicon_url,
            description=f"RSS Everything: {data.url}",
            refresh_interval=data.refresh_interval,
        )

        # RSSEverythingSource 생성 (feed 연결)
        source = RSSEverythingSource.objects.create(
            feed=feed,
            source_type=source_type,
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

    return RSSEverythingSchema.from_orm(source)


@router.put("/{source_id}", response=RSSEverythingSchema, auth=JWTAuth())
def update_source(request, source_id: int, data: RSSEverythingUpdateRequest):
    """RSSEverything 소스 수정"""
    source = get_object_or_404(
        RSSEverythingSource, id=source_id, feed__user=request.auth
    )

    update_fields = []

    # follow_links가 변경되면 source_type도 변경
    if data.follow_links is not None:
        source.source_type = (
            "detail_page_scraping" if data.follow_links else "page_scraping"
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
        value = getattr(data, field, None)
        if value is not None:
            setattr(source, field, value)
            update_fields.append(field)

    if update_fields:
        source.save(update_fields=update_fields + ["updated_at"])

    return RSSEverythingSchema.from_orm(source)


@router.delete("/{source_id}", auth=JWTAuth())
def delete_source(request, source_id: int):
    """RSSEverything 소스 삭제 - 연결된 RSSFeed도 함께 삭제됩니다."""
    source = get_object_or_404(
        RSSEverythingSource, id=source_id, feed__user=request.auth
    )

    # Feed를 삭제하면 CASCADE로 Source도 삭제됨
    source.feed.delete()

    return {"success": True}


class RefreshResponse(BaseModel):
    """새로고침 응답"""

    success: bool
    task_result_id: int
    message: str


@router.post("/{source_id}/refresh", response=RefreshResponse, auth=JWTAuth())
def refresh_source(request, source_id: int):
    """
    RSSEverything 소스를 새로고침하여 아이템들을 업데이트합니다.
    Task 결과 ID를 반환하여 진행 상황을 추적할 수 있습니다.
    """
    from feeds.tasks import update_feed_items
    from feeds.models import FeedTaskResult

    source = get_object_or_404(
        RSSEverythingSource, id=source_id, feed__user=request.auth
    )

    # FeedTaskResult 먼저 생성
    task_result = FeedTaskResult.objects.create(
        feed=source.feed,
        status=FeedTaskResult.Status.PENDING,
    )

    # Celery 태스크로 Feed 업데이트 실행 (task_result_id 전달)
    update_feed_items.delay(source.feed_id, task_result_id=task_result.id)

    return RefreshResponse(
        success=True,
        task_result_id=task_result.id,
        message="Refresh task started",
    )
