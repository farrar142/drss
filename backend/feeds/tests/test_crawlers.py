# feeds/tests/test_crawlers.py
"""크롤러 추상화 테스트 (네트워크 호출 없이)"""

from django.test import TestCase

from feeds.browser_crawler import BrowserCrawler, BrowserlessCrawler, RealBrowserCrawler, get_crawler
from feeds.crawlers import CrawlResult, WaitUntil


class CrawlerAbstractionTest(TestCase):
    """크롤러 추상화 테스트"""

    def test_get_crawler_realbrowser(self) -> None:
        """RealBrowser 크롤러 인스턴스 생성"""
        crawler = get_crawler("realbrowser")
        self.assertIsInstance(crawler, RealBrowserCrawler)

    def test_get_crawler_browserless(self) -> None:
        """Browserless 크롤러 인스턴스 생성"""
        crawler = get_crawler("browserless")
        self.assertIsInstance(crawler, BrowserlessCrawler)

    def test_get_crawler_invalid_service(self) -> None:
        """잘못된 서비스 이름으로 크롤러 생성 시 에러"""
        with self.assertRaises(ValueError):
            get_crawler("invalid_service")

    def test_backward_compatibility(self) -> None:
        """BrowserCrawler 클래스 하위 호환성"""
        crawler = BrowserCrawler()
        self.assertIsInstance(crawler, RealBrowserCrawler)

    def test_crawl_result_structure_success(self) -> None:
        """CrawlResult 성공 케이스 구조 테스트"""
        result = CrawlResult(
            success=True,
            html="<html><body>Test</body></html>",
            url="https://example.com",
            error=None,
        )
        self.assertTrue(result.success)
        assert result.html is not None
        self.assertIn("Test", result.html)
        self.assertIsNone(result.error)

    def test_crawl_result_structure_failure(self) -> None:
        """CrawlResult 실패 케이스 구조 테스트"""
        result = CrawlResult(
            success=False,
            html=None,
            url="https://example.com",
            error="Connection failed",
        )
        self.assertFalse(result.success)
        self.assertIsNone(result.html)
        self.assertEqual(result.error, "Connection failed")

    def test_wait_until_enum(self) -> None:
        """WaitUntil 열거형 테스트"""
        self.assertEqual(WaitUntil.LOAD.value, "load")
        self.assertEqual(WaitUntil.DOMCONTENTLOADED.value, "domcontentloaded")
        self.assertEqual(WaitUntil.NETWORKIDLE0.value, "networkidle0")
        self.assertEqual(WaitUntil.NETWORKIDLE2.value, "networkidle2")
