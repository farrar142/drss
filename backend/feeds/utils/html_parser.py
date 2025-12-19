"""
HTML Parser Utilities - 웹 페이지 파싱 및 크롤링 관련 유틸리티 함수
"""

from typing import Optional, TypedDict
from bs4 import BeautifulSoup
from urllib.parse import urljoin
import re

# 타입 정의
class ExtractedElement(TypedDict):
    """추출된 요소 정보"""
    tag: str
    text: str
    html: str
    href: Optional[str]
    src: Optional[str]
    selector: str

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

def extract_text(element) -> str:
    """요소에서 텍스트 추출"""
    if element is None:
        return ""
    return element.get_text(strip=True)

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
        if not isinstance(href, str):
            continue

        css_url = urljoin(base_url, href)

        try:
            response = requests.get(css_url, timeout=3)
            if response.status_code == 200:
                css_parts.append(f"/* From: {css_url} */\n{response.text}")
        except Exception as e:
            # 로깅은 호출자에서 처리
            continue

    return "\n".join(css_parts)

def extract_html_with_css(element, soup: BeautifulSoup, base_url: str = "") -> str:
    """요소의 HTML 블록과 함께 CSS를 추출"""
    if element is None:
        return ""

    css = extract_css_from_html(soup, base_url)
    html = extract_html(element, base_url)

    if css.strip():
        return f"<style>{css}</style>\n{html}"

    return html

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
