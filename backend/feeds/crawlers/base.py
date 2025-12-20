"""
Base browser crawler with common functionality.

This module provides a base implementation with caching, retry logic,
challenge detection, and other common features shared across different
browser services.
"""

import logging
import hashlib
import time
from typing import Optional, List
from urllib.parse import urlencode

import requests
from django.core.cache import cache

from .abstract import AbstractBrowserCrawler, CrawlResult, WaitUntil

logger = logging.getLogger(__name__)

# ============== HTML Cache ==============
CACHE_TTL = 3600  # 1시간 (초)
CACHE_PREFIX = "browser_crawler:"


def _get_cache_key(
    url: str, selector: str, wait_until: str, headers: Optional[dict] = None
) -> str:
    """URL과 옵션으로 캐시 키 생성"""
    key_str = f"{url}|{selector}|{wait_until}|{headers}"
    return f"{CACHE_PREFIX}{hashlib.md5(key_str.encode()).hexdigest()}"


def _get_cached_html(cache_key: str) -> Optional[str]:
    """캐시에서 HTML 가져오기"""
    html = cache.get(cache_key)
    if html is not None:
        logger.debug(f"Cache hit for key {cache_key[:20]}...")
        return html
    return None


def _set_cached_html(cache_key: str, html: str) -> None:
    """HTML을 캐시에 저장"""
    cache.set(cache_key, html, CACHE_TTL)
    logger.debug(f"Cached HTML for key {cache_key[:20]}...")


def clear_html_cache() -> int:
    """캐시 전체 삭제 (browser_crawler 관련 키만)"""
    # Django cache는 패턴 삭제를 직접 지원하지 않으므로
    # Redis를 사용하는 경우 keys 명령으로 삭제 가능
    try:
        from django_redis import get_redis_connection

        redis_conn = get_redis_connection("default")
        keys = redis_conn.keys(f"*{CACHE_PREFIX}*")
        if keys:
            redis_conn.delete(*keys)
            return len(keys)
        return 0
    except Exception as e:
        logger.warning(f"Failed to clear cache: {e}")
        return 0


class BaseBrowserCrawler(AbstractBrowserCrawler):
    """
    Base browser crawler with common functionality.

    This class provides caching, retry logic, challenge detection, and other
    common features. Subclasses should implement the service-specific
    fetch_html_raw method.
    """

    def __init__(
        self,
        service_url: Optional[str] = None,
        timeout: int = 30000,
        default_wait_until: WaitUntil = WaitUntil.NETWORKIDLE2,
        default_selector: str = "body",
    ):
        """
        Initialize the base browser crawler.

        Args:
            service_url: URL of the browser service
            timeout: Default timeout in milliseconds for page operations
            default_wait_until: Default wait condition for page load
            default_selector: Default CSS selector to wait for
        """
        self.service_url = service_url
        self.timeout = timeout
        self.default_wait_until = default_wait_until
        self.default_selector = default_selector

        # Challenge detection patterns
        self.challenge_indicators = [
            # Cloudflare
            "checking your browser",
            "cf-browser-verification",
            "challenge-platform",
            "just a moment",
            "_cf_chl",
            "cf_chl_opt",
            "cf-challenge",
            # DDoS protection
            "ddos-guard",
            "ddos protection",
            # 쿠팡/기타 챌린지
            "var chlgeId",
            # 일반적인 봇 감지
            "bot detected",
            "human verification",
            "are you a robot",
            "verify you are human",
            "access denied",
            "blocked by",
        ]

    def fetch_html_raw(
        self,
        url: str,
        selector: Optional[str] = None,
        wait_until: Optional[WaitUntil] = None,
        timeout: Optional[int] = None,
        headers: Optional[dict] = None,
    ) -> CrawlResult:
        """
        Raw HTML fetching implementation - to be implemented by subclasses.

        This method should make the actual HTTP request to the browser service
        without any caching, retry logic, or validation.

        Args:
            url: The URL to fetch
            selector: CSS selector to wait for
            wait_until: Page load wait condition
            timeout: Timeout in milliseconds
            headers: Custom headers

        Returns:
            CrawlResult with raw response
        """
        raise NotImplementedError("Subclasses must implement fetch_html_raw")

    def fetch_html_with_retry(
        self,
        url: str,
        selector: Optional[str] = None,
        wait_until: Optional[WaitUntil] = None,
        timeout: Optional[int] = None,
        headers: Optional[dict] = None,
        max_retries: int = 3,
        retry_delay: float = 2.0,
        use_cache: bool = True,
    ) -> CrawlResult:
        """
        Fetch HTML with retry logic and caching.

        Args:
            url: The URL to fetch
            selector: CSS selector to wait for
            wait_until: Page load wait condition
            timeout: Timeout in milliseconds
            headers: Custom headers
            max_retries: Number of retries if failed
            retry_delay: Delay between retries in seconds
            use_cache: Whether to use caching

        Returns:
            CrawlResult with HTML content
        """
        logger.info(f"Starting fetch_html_with_retry for {url}")

        # Check cache first
        cache_key = _get_cache_key(
            url,
            selector or self.default_selector,
            (wait_until or self.default_wait_until).value,
            headers,
        )

        if use_cache:
            logger.debug("Checking cache...")
            print("Checking cache...")
            cached_html = _get_cached_html(cache_key)
            if cached_html:
                logger.info(f"Returning cached HTML {cache_key}")
                print(f"Returning cached HTML {cache_key}")
                return CrawlResult(
                    success=True,
                    html=cached_html,
                    url=url,
                    from_cache=True,
                )

        # Try fetching with retries
        last_result = None

        for attempt in range(max_retries):
            result = self.fetch_html_raw(
                url=url,
                selector=selector,
                wait_until=wait_until,
                timeout=timeout,
                headers=headers,
            )

            last_result = result

            if result.success:
                # Validate content
                if self._validate_content(result.html or ""):
                    # Cache successful result
                    if use_cache and result.html:
                        _set_cached_html(cache_key, result.html)
                    return result
                else:
                    logger.warning(
                        f"Attempt {attempt + 1}/{max_retries}: Invalid content for {url}"
                    )
            else:
                logger.warning(
                    f"Attempt {attempt + 1}/{max_retries} failed for {url}: {result.error}"
                )

            # Wait before retry
            if attempt < max_retries - 1:
                time.sleep(retry_delay * (attempt + 1))  # Progressive delay

        # All retries failed
        logger.error(f"All {max_retries} attempts failed for {url}")
        return last_result or CrawlResult(success=False, error="All retries failed")

    def _validate_content(self, html: str, min_content_length: int = 1000) -> bool:
        """
        Validate HTML content.

        Checks for challenge pages and minimum content length.

        Args:
            html: HTML content to validate
            min_content_length: Minimum content length

        Returns:
            True if content is valid, False otherwise
        """
        html_lower = html.lower()

        # Check for challenge indicators
        is_challenge = any(
            indicator.lower() in html_lower for indicator in self.challenge_indicators
        )

        # Check content length
        is_too_short = len(html) < min_content_length

        return not (is_challenge or is_too_short)

    def fetch_html(
        self,
        url: str,
        selector: Optional[str] = None,
        wait_until: Optional[WaitUntil] = None,
        timeout: Optional[int] = None,
        headers: Optional[dict] = None,
    ) -> CrawlResult:
        """
        Fetch HTML content from a URL using a browser.

        This is the main method that should be used by consumers.
        It includes caching, retry logic, and content validation.

        Args:
            url: The URL to fetch
            selector: CSS selector to wait for before capturing content
            wait_until: Page load wait condition
            timeout: Timeout in milliseconds
            headers: Custom headers to send with the request

        Returns:
            CrawlResult with success status and HTML content or error message
        """
        return self.fetch_html_with_retry(
            url=url,
            selector=selector,
            wait_until=wait_until,
            timeout=timeout,
            headers=headers,
        )

    def fetch_multiple(
        self,
        urls: List[str],
        selector: Optional[str] = None,
        wait_until: Optional[WaitUntil] = None,
        timeout: Optional[int] = None,
    ) -> List[CrawlResult]:
        """
        Fetch HTML content from multiple URLs using a browser.

        This implementation makes sequential requests. Subclasses can override
        for more efficient batch processing if supported by the service.

        Args:
            urls: List of URLs to fetch
            selector: CSS selector to wait for
            wait_until: Page load wait condition
            timeout: Timeout in milliseconds

        Returns:
            List of CrawlResult objects (one per URL)
        """
        results = []

        for url in urls:
            result = self.fetch_html(
                url=url,
                selector=selector,
                wait_until=wait_until,
                timeout=timeout,
            )
            results.append(result)

        return results
