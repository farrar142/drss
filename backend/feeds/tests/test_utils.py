# feeds/tests/test_utils.py
"""유틸리티 함수 테스트"""

from datetime import datetime
from typing import Optional
from unittest.mock import MagicMock, patch

from bs4 import BeautifulSoup, Tag
from django.test import TestCase


class DateParserTest(TestCase):
    """날짜 파싱 유틸리티 테스트"""

    def test_parse_iso_format(self) -> None:
        """ISO 8601 형식 파싱"""
        from feeds.utils.date_parser import parse_date

        result = parse_date("2025-12-19T10:30:00")
        self.assertIsNotNone(result)
        assert result is not None
        self.assertEqual(result.year, 2025)
        self.assertEqual(result.month, 12)
        self.assertEqual(result.day, 19)

    def test_parse_korean_format(self) -> None:
        """한국어 날짜 형식 파싱"""
        from feeds.utils.date_parser import parse_date

        result = parse_date("2025.12.19 10:30")
        self.assertIsNotNone(result)
        assert result is not None
        self.assertEqual(result.year, 2025)
        self.assertEqual(result.month, 12)

    def test_parse_relative_time_korean(self) -> None:
        """한국어 상대 시간 파싱"""
        from feeds.utils.date_parser import parse_date

        # "5분 전"
        result = parse_date("5분 전")
        self.assertIsNotNone(result)

        # "1시간 전"
        result = parse_date("1시간 전")
        self.assertIsNotNone(result)

        # "어제"
        result = parse_date("어제")
        self.assertIsNotNone(result)

    def test_parse_relative_time_english(self) -> None:
        """영어 상대 시간 파싱"""
        from feeds.utils.date_parser import parse_date

        result = parse_date("5 minutes ago")
        self.assertIsNotNone(result)

        result = parse_date("2 hours ago")
        self.assertIsNotNone(result)

        result = parse_date("yesterday")
        self.assertIsNotNone(result)

    def test_parse_with_custom_format(self) -> None:
        """사용자 지정 형식으로 파싱"""
        from feeds.utils.date_parser import parse_date

        result = parse_date("19/12/2025", ["%d/%m/%Y"])
        self.assertIsNotNone(result)
        assert result is not None
        self.assertEqual(result.day, 19)
        self.assertEqual(result.month, 12)

    def test_parse_empty_string(self) -> None:
        """빈 문자열 파싱 시 None 반환"""
        from feeds.utils.date_parser import parse_date

        result = parse_date("")
        self.assertIsNone(result)


class HTMLParserTest(TestCase):
    """HTML 파싱 유틸리티 테스트"""

    def test_extract_text(self) -> None:
        """텍스트 추출 테스트"""
        from feeds.utils.html_parser import extract_text

        html = "<div>  Hello   <span>World</span>  </div>"
        soup = BeautifulSoup(html, "html.parser")
        element = soup.find("div")
        assert isinstance(element, Tag)

        text = extract_text(element)
        # get_text(strip=True)는 내부 공백을 유지하지 않음
        self.assertEqual(text, "HelloWorld")

    def test_extract_text_none_element(self) -> None:
        """None 요소에서 텍스트 추출 시 빈 문자열"""
        from feeds.utils.html_parser import extract_text

        text = extract_text(None)
        self.assertEqual(text, "")

    def test_extract_href(self) -> None:
        """href 추출 테스트"""
        from feeds.utils.html_parser import extract_href

        html = '<a href="/path/to/page">Link</a>'
        soup = BeautifulSoup(html, "html.parser")
        element = soup.find("a")
        assert isinstance(element, Tag)

        href = extract_href(element, "https://example.com")
        self.assertEqual(href, "https://example.com/path/to/page")

    def test_extract_href_nested(self) -> None:
        """중첩된 a 태그에서 href 추출"""
        from feeds.utils.html_parser import extract_href

        html = '<div><a href="/nested/link">Nested</a></div>'
        soup = BeautifulSoup(html, "html.parser")
        element = soup.find("div")
        assert isinstance(element, Tag)

        href = extract_href(element, "https://example.com")
        self.assertEqual(href, "https://example.com/nested/link")

    def test_extract_src(self) -> None:
        """이미지 src 추출 테스트"""
        from feeds.utils.html_parser import extract_src

        html = '<img src="/images/photo.jpg" alt="Photo">'
        soup = BeautifulSoup(html, "html.parser")
        element = soup.find("img")
        assert isinstance(element, Tag)

        src = extract_src(element, "https://example.com")
        self.assertEqual(src, "https://example.com/images/photo.jpg")

    def test_extract_src_data_src(self) -> None:
        """data-src 속성에서 이미지 추출 (lazy loading)"""
        from feeds.utils.html_parser import extract_src

        html = '<img data-src="/lazy/image.jpg" alt="Lazy">'
        soup = BeautifulSoup(html, "html.parser")
        element = soup.find("img")
        assert isinstance(element, Tag)

        src = extract_src(element, "https://example.com")
        self.assertEqual(src, "https://example.com/lazy/image.jpg")

    def test_extract_html(self) -> None:
        """HTML 블록 추출 테스트"""
        from feeds.utils.html_parser import extract_html

        html = '<div class="content"><p>Paragraph</p></div>'
        soup = BeautifulSoup(html, "html.parser")
        element = soup.find("div")
        assert isinstance(element, Tag)

        result = extract_html(element, "https://example.com")
        self.assertIn("Paragraph", result)
        self.assertIn("<p>", result)

    def test_extract_html_converts_relative_urls(self) -> None:
        """상대 URL을 절대 URL로 변환"""
        from feeds.utils.html_parser import extract_html

        html = '<div><img src="/image.jpg"><a href="/link">Link</a></div>'
        soup = BeautifulSoup(html, "html.parser")
        element = soup.find("div")
        assert isinstance(element, Tag)

        result = extract_html(element, "https://example.com")
        self.assertIn("https://example.com/image.jpg", result)
        self.assertIn("https://example.com/link", result)

    def test_generate_selector(self) -> None:
        """CSS 셀렉터 생성 테스트"""
        from feeds.utils.html_parser import generate_selector

        html = '<div id="main"><p class="text">Hello</p></div>'
        soup = BeautifulSoup(html, "html.parser")
        element = soup.find("p")
        assert isinstance(element, Tag)

        selector = generate_selector(soup, element)
        self.assertIn("p", selector)
        # ID가 있는 부모가 있으면 해당 ID 포함
        self.assertIn("#main", selector)


class RSSFetcherTest(TestCase):
    """RSS 피드 가져오기 유틸리티 테스트 (네트워크 호출 mocking)"""

    def test_extract_favicon_url(self) -> None:
        """파비콘 URL 추출 테스트 (mocking)"""
        from feeds.utils.feed_fetcher import extract_favicon_url

        # favicon.ico가 존재하는 경우
        with patch("requests.get") as mock_get:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_get.return_value = mock_response

            url = "https://example.com/feed.xml"
            favicon = extract_favicon_url(url)
            self.assertIn("example.com", favicon)
            self.assertIn("favicon.ico", favicon)

    def test_fetch_feed_data_with_mock(self) -> None:
        """RSS 피드 가져오기 테스트 (mocking)"""
        from feeds.utils.feed_fetcher import fetch_feed_data

        mock_feed = MagicMock()
        mock_feed.bozo = False
        mock_feed.feed = {"title": "Test Feed", "description": "Test Description"}
        mock_feed.entries = [
            MagicMock(
                title="Item 1",
                link="https://example.com/1",
                description="Description 1",
            )
        ]

        with patch("feedparser.parse", return_value=mock_feed):
            with patch("requests.get") as mock_get:
                mock_response = MagicMock()
                mock_response.content = b"<rss>...</rss>"
                mock_response.status_code = 200
                mock_get.return_value = mock_response

                result = fetch_feed_data("https://example.com/feed.xml")

                self.assertFalse(result.bozo)
                # feedparser의 feed 속성은 dict-like 객체 (FeedParserDict)
                feed_dict = getattr(result, "feed", {})
                self.assertEqual(feed_dict.get("title"), "Test Feed")
                self.assertEqual(len(result.entries), 1)
