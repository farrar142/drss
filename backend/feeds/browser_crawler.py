"""
Browser-based web crawler using puppeteer-real-browser-hono service.

This module provides functions to fetch web pages using a real browser
to bypass bot detection and anti-scraping measures.

Requires the real-browser service to be running (see dev.compose.yml).

API Reference (puppeteer-real-browser-hono):
    GET /?url=<url>&selector=<selector>&timeout=<ms>&waitUntil=<event>

    Query Parameters:
        - url: URL to fetch (required, can be multiple)
        - selector: CSS selector to wait for (required)
        - timeout: Navigation timeout in ms (default: 30000)
        - waitUntil: load | domcontentloaded | networkidle0 | networkidle2
"""

import os
import logging
import hashlib
from typing import Optional
from dataclasses import dataclass
from enum import Enum
from urllib.parse import urlencode

import requests
from django.core.cache import cache

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


class WaitUntil(str, Enum):
    """Page load wait conditions"""

    LOAD = "load"  # wait for load event
    DOMCONTENTLOADED = "domcontentloaded"  # wait for DOMContentLoaded event
    NETWORKIDLE0 = (
        "networkidle0"  # wait until no more than 0 network connections for 500ms
    )
    NETWORKIDLE2 = (
        "networkidle2"  # wait until no more than 2 network connections for 500ms
    )


@dataclass
class CrawlResult:
    """Result of a browser crawl operation"""

    success: bool
    html: Optional[str] = None
    error: Optional[str] = None
    url: Optional[str] = None  # Final URL after redirects
    from_cache: bool = False


class BrowserCrawler:
    """
    Browser-based crawler that uses puppeteer-real-browser-hono service
    to bypass bot detection and scraping protection.
    """

    def __init__(
        self,
        service_url: Optional[str] = None,
        timeout: int = 30000,
        default_wait_until: WaitUntil = WaitUntil.NETWORKIDLE2,
        default_selector: str = "body",
    ):
        """
        Initialize the browser crawler.

        Args:
            service_url: URL of the real-browser service.
                        Defaults to PUPPETEER_REAL_BROWSER_SERVICE env var or http://real-browser:3000
            timeout: Default timeout in milliseconds for page operations
            default_wait_until: Default wait condition for page load
            default_selector: Default CSS selector to wait for
        """
        self.service_url = service_url or os.getenv(
            "PUPPETEER_REAL_BROWSER_SERVICE", "http://real-browser:3000"
        )
        self.timeout = timeout
        self.default_wait_until = default_wait_until
        self.default_selector = default_selector

    def fetch_html(
        self,
        url: str,
        selector: Optional[str] = None,
        wait_until: Optional[WaitUntil] = None,
        timeout: Optional[int] = None,
        headers: Optional[dict] = None,
    ) -> CrawlResult:
        """
        Fetch HTML content from a URL using a real browser.

        Args:
            url: The URL to fetch
            selector: CSS selector to wait for before capturing content (default: "body")
            wait_until: Page load wait condition (overrides default)
            timeout: Timeout in milliseconds (overrides default)

        Returns:
            CrawlResult with success status and HTML content or error message
        """
        try:
            params = {
                "url": url,
                "selector": selector or self.default_selector,
                "waitUntil": (wait_until or self.default_wait_until).value,
                "timeout": str(timeout or self.timeout),
            }

            logger.debug(f"Fetching URL via real-browser: {url}")

            request_url = f"{self.service_url}?{urlencode(params)}"
            request_timeout = ((timeout or self.timeout) / 1000) + 30  # Add 30s buffer
            response = requests.get(
                request_url, timeout=request_timeout, headers=headers
            )

            if response.status_code == 200:
                data = response.json()

                if data.get("success"):
                    html_list = data.get("data", [])
                    html = html_list[0] if html_list else None

                    return CrawlResult(
                        success=True,
                        html=html,
                        url=url,
                        from_cache=data.get("fromCache", False),
                    )
                else:
                    error_msg = data.get("error", "Unknown error from service")
                    logger.error(f"Browser crawl failed for {url}: {error_msg}")
                    return CrawlResult(success=False, error=error_msg)
            else:
                error_msg = (
                    f"Service returned status {response.status_code}: {response.text}"
                )
                logger.error(f"Browser crawl failed for {url}: {error_msg}")
                return CrawlResult(success=False, error=error_msg)

        except requests.exceptions.Timeout:
            error_msg = f"Timeout fetching {url}"
            logger.error(error_msg)
            return CrawlResult(success=False, error=error_msg)

        except requests.exceptions.ConnectionError as e:
            error_msg = f"Connection error to real-browser service: {e}"
            logger.error(error_msg)
            return CrawlResult(success=False, error=error_msg)

        except Exception as e:
            error_msg = f"Unexpected error fetching {url}: {e}"
            logger.exception(error_msg)
            return CrawlResult(success=False, error=error_msg)

    def fetch_multiple(
        self,
        urls: list[str],
        selector: Optional[str] = None,
        wait_until: Optional[WaitUntil] = None,
        timeout: Optional[int] = None,
    ) -> list[CrawlResult]:
        """
        Fetch HTML content from multiple URLs using a real browser.

        The service handles concurrent requests internally with semaphore control.

        Args:
            urls: List of URLs to fetch
            selector: CSS selector to wait for
            wait_until: Page load wait condition
            timeout: Timeout in milliseconds

        Returns:
            List of CrawlResult objects (one per URL)
        """
        try:
            # Build query string with multiple url params
            params = [("url", u) for u in urls]
            params.append(("selector", selector or self.default_selector))
            params.append(("waitUntil", (wait_until or self.default_wait_until).value))
            params.append(("timeout", str(timeout or self.timeout)))

            request_url = f"{self.service_url}?{urlencode(params)}"
            request_timeout = ((timeout or self.timeout) / 1000) + 30 + (len(urls) * 10)

            response = requests.get(request_url, timeout=request_timeout)

            if response.status_code == 200:
                data = response.json()

                if data.get("success"):
                    html_list = data.get("data", [])
                    from_cache = data.get("fromCache", False)

                    results = []
                    for i, html in enumerate(html_list):
                        results.append(
                            CrawlResult(
                                success=True,
                                html=html,
                                url=urls[i] if i < len(urls) else None,
                                from_cache=from_cache,
                            )
                        )

                    # Fill in failed ones if data is shorter than urls
                    while len(results) < len(urls):
                        results.append(
                            CrawlResult(
                                success=False,
                                error="No data returned for this URL",
                                url=urls[len(results)],
                            )
                        )

                    return results
                else:
                    error_msg = data.get("error", "Unknown error")
                    return [
                        CrawlResult(success=False, error=error_msg, url=u) for u in urls
                    ]
            else:
                error_msg = f"Service returned status {response.status_code}"
                return [
                    CrawlResult(success=False, error=error_msg, url=u) for u in urls
                ]

        except Exception as e:
            error_msg = str(e)
            return [CrawlResult(success=False, error=error_msg, url=u) for u in urls]


# Global crawler instance (lazy initialization)
_crawler: Optional[BrowserCrawler] = None


def get_crawler() -> BrowserCrawler:
    """Get or create the global browser crawler instance."""
    global _crawler
    if _crawler is None:
        _crawler = BrowserCrawler()
    return _crawler


def fetch_html_with_browser(
    url: str,
    selector: str = "body",
    wait_until: WaitUntil = WaitUntil.NETWORKIDLE2,
    timeout: int = 30000,
    validate_content: bool = True,
    min_content_length: int = 1000,
    max_retries: int = 3,
    retry_delay: float = 2.0,
    use_cache: bool = True,
    custom_headers: Optional[dict] = None,
) -> CrawlResult:
    """
    Convenience function to fetch HTML using the global crawler.

    This is the main function to use for bypassing bot detection.

    Args:
        url: The URL to fetch
        selector: CSS selector to wait for (default: "body")
        wait_until: When to consider the page loaded
        timeout: Timeout in milliseconds
        validate_content: Whether to validate the response is real content
        min_content_length: Minimum HTML length to consider valid
        max_retries: Number of retries if content validation fails
        retry_delay: Delay between retries in seconds
        use_cache: Whether to use caching (default: True, 1 hour TTL)

    Returns:
        CrawlResult with HTML content

    Example:
        >>> result = fetch_html_with_browser("https://example.com")
        >>> if result.success:
        ...     print(result.html[:100])
        ... else:
        ...     print(f"Error: {result.error}")
    """
    import time

    logger.info(f"Starting fetch_html_with_browser for {url}")
    # 캐시 확인
    cache_key = _get_cache_key(url, selector, wait_until.value, custom_headers)
    print(
        f"Cache key: {cache_key} {custom_headers}",
    )
    logger.info(f"Cache key: {cache_key}")
    if use_cache:
        logger.info("Checking cache...")
        cached_html = _get_cached_html(cache_key)
        if cached_html:
            return CrawlResult(
                success=True,
                html=cached_html,
                url=url,
                from_cache=True,
            )

    crawler = get_crawler()

    # JavaScript 챌린지/봇 감지 페이지 감지 패턴
    # 더 구체적인 패턴을 사용하여 오탐지 방지
    challenge_indicators = [
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

    last_result = None

    for attempt in range(max_retries):
        result = crawler.fetch_html(
            url=url,
            selector=selector,
            wait_until=wait_until,
            timeout=timeout,
            headers=custom_headers,
        )

        last_result = result

        if not result.success:
            logger.warning(
                f"Attempt {attempt + 1}/{max_retries} failed for {url}: {result.error}"
            )
            if attempt < max_retries - 1:
                time.sleep(retry_delay)
            continue

        if not validate_content:
            return result

        html = result.html or ""
        html_lower = html.lower()

        # 챌린지 페이지 감지
        is_challenge = any(
            indicator.lower() in html_lower for indicator in challenge_indicators
        )

        # 콘텐츠 길이 검사
        is_too_short = len(html) < min_content_length

        if is_challenge or is_too_short:
            logger.warning(
                f"Attempt {attempt + 1}/{max_retries}: Challenge page or insufficient content "
                f"(length={len(html)}, is_challenge={is_challenge}) for {url}"
            )
            if attempt < max_retries - 1:
                time.sleep(retry_delay * (attempt + 1))  # 점점 더 긴 대기
            continue

        # 유효한 콘텐츠로 판단 - 캐시에 저장
        if use_cache and result.html:
            _set_cached_html(cache_key, result.html)
        return result

    # 모든 재시도 실패 - 마지막 결과 반환 (일부 콘텐츠라도 있을 수 있음)
    logger.error(f"All {max_retries} attempts failed for {url}")
    return last_result or CrawlResult(success=False, error="All retries failed")


def fetch_html_smart(
    url: str,
    headers: Optional[dict] = None,
    use_browser_on_fail: bool = True,
    browser_selector: str = "body",
    browser_wait_until: WaitUntil = WaitUntil.NETWORKIDLE2,
    custom_headers: Optional[dict] = None,
    use_cache: bool = True,
) -> CrawlResult:
    """
    Smart fetch that tries regular HTTP first, falls back to browser on failure.

    This is useful when you want to avoid the overhead of browser rendering
    for sites that don't block regular requests.

    Args:
        url: The URL to fetch
        headers: Optional headers for the regular HTTP request
        use_browser_on_fail: Whether to retry with browser on failure
        browser_selector: CSS selector for browser fallback
        browser_wait_until: Wait condition for browser fallback
        custom_headers: Custom headers (merged with headers)
        use_cache: Whether to use caching (default: True, 1 hour TTL)

    Returns:
        CrawlResult with HTML content
    """
    # Merge headers
    merged_headers = headers or {}
    if custom_headers:
        merged_headers.update(custom_headers)

    # 캐시 확인
    cache_key = _get_cache_key(
        url, browser_selector, browser_wait_until.value, merged_headers
    )
    print("Cache key:", cache_key)
    print("using cache:", use_cache)
    if use_cache:
        cached_html = _get_cached_html(cache_key)
        print(f"Cache hit for {url}" if cached_html else f"No cache for {url}")
        if cached_html:
            return CrawlResult(
                success=True,
                html=cached_html,
                url=url,
                from_cache=True,
            )

    # Try regular request first
    try:
        default_headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
        }
        default_headers.update(merged_headers)

        response = requests.get(url, headers=default_headers, timeout=15)

        # Check for common bot detection responses
        if response.status_code == 200:
            content = response.text.lower()
            # Check for Cloudflare, bot detection pages, etc.
            bot_indicators = [
                "checking your browser",
                "please wait while we verify",
                "cf-browser-verification",
                "just a moment",
                "ddos-guard",
                "access denied",
                "blocked",
                "captcha",
                "challenge-platform",
            ]

            is_blocked = any(indicator in content for indicator in bot_indicators)

            if not is_blocked:
                # 성공 - 캐시에 저장
                if use_cache:
                    _set_cached_html(cache_key, response.text)
                return CrawlResult(
                    success=True,
                    html=response.text,
                    url=response.url,
                )
            else:
                logger.info(
                    f"Bot detection detected for {url}, falling back to browser"
                )
        else:
            logger.info(f"HTTP {response.status_code} for {url}, trying browser")

    except requests.exceptions.RequestException as e:
        logger.info(f"Regular request failed for {url}: {e}")

    # Fall back to browser if enabled
    if use_browser_on_fail:
        return fetch_html_with_browser(
            url,
            selector=browser_selector,
            wait_until=browser_wait_until,
            custom_headers=custom_headers,
            use_cache=use_cache,
        )

    return CrawlResult(
        success=False, error="Regular request failed and browser fallback disabled"
    )
