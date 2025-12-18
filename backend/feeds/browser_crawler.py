"""
Browser-based web crawler module with multiple service support.

This module provides functions to fetch web pages using different browser services
to bypass bot detection and anti-scraping measures.

Supports:
- RealBrowser service (puppeteer-real-browser-hono)
- Browserless.io service

Requires the respective services to be running (see dev.compose.yml).
"""

import logging
from typing import Optional

# Import from crawlers module
try:
    from feeds.crawlers.base import clear_html_cache
    from feeds.crawlers import (
        AbstractBrowserCrawler,
        BaseBrowserCrawler,
        RealBrowserCrawler,
        BrowserlessCrawler,
        CrawlResult,
        WaitUntil,
    )
except ImportError:
    # Fallback for direct execution
    from crawlers.base import clear_html_cache
    from crawlers import (
        AbstractBrowserCrawler,
        BaseBrowserCrawler,
        RealBrowserCrawler,
        BrowserlessCrawler,
        CrawlResult,
        WaitUntil,
    )

logger = logging.getLogger(__name__)

# Global crawler instances (lazy initialization)
_realbrowser_crawler: Optional[RealBrowserCrawler] = None
_browserless_crawler: Optional[BrowserlessCrawler] = None


def get_realbrowser_crawler() -> RealBrowserCrawler:
    """Get or create the global RealBrowser crawler instance."""
    global _realbrowser_crawler
    if _realbrowser_crawler is None:
        _realbrowser_crawler = RealBrowserCrawler()
    return _realbrowser_crawler


def get_browserless_crawler() -> BrowserlessCrawler:
    """Get or create the global Browserless crawler instance."""
    global _browserless_crawler
    if _browserless_crawler is None:
        _browserless_crawler = BrowserlessCrawler()
    return _browserless_crawler


def get_crawler(service: str = "realbrowser") -> "BaseBrowserCrawler":
    """
    Get a browser crawler instance.

    Args:
        service: Which browser service to use ('realbrowser' or 'browserless')

    Returns:
        AbstractBrowserCrawler instance
    """
    if service == "realbrowser":
        return get_realbrowser_crawler()
    elif service == "browserless":
        return get_browserless_crawler()
    else:
        raise ValueError(f"Unknown browser service: {service}")


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
    service: str = "realbrowser",
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
        custom_headers: Custom headers to send with the request
        service: Which browser service to use ('realbrowser' or 'browserless')

    Returns:
        CrawlResult with HTML content

    Example:
        >>> result = fetch_html_with_browser("https://example.com")
        >>> if result.success:
        ...     print(result.html[:100])
        ... else:
        ...     print(f"Error: {result.error}")
    """
    crawler = get_crawler(service)

    # Use the crawler's fetch_html_with_retry method which includes all the logic
    return crawler.fetch_html_with_retry(
        url=url,
        selector=selector,
        wait_until=wait_until,
        timeout=timeout,
        headers=custom_headers,
        max_retries=max_retries,
        retry_delay=retry_delay,
        use_cache=use_cache,
    )


def fetch_html_smart(
    url: str,
    headers: Optional[dict] = None,
    use_browser_on_fail: bool = True,
    browser_selector: str = "body",
    browser_wait_until: WaitUntil = WaitUntil.NETWORKIDLE2,
    custom_headers: Optional[dict] = None,
    use_cache: bool = True,
    browser_service: str = "realbrowser",
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
        browser_service: Which browser service to use for fallback ('realbrowser' or 'browserless')

    Returns:
        CrawlResult with HTML content
    """
    import requests
    import hashlib
    from django.core.cache import cache

    # Merge headers
    merged_headers = headers or {}
    if custom_headers:
        merged_headers.update(custom_headers)

    # Cache key generation (moved from base since it's used here too)
    CACHE_PREFIX = "browser_crawler:"
    key_str = f"{url}|{browser_selector}|{browser_wait_until.value}|{merged_headers}"
    cache_key = f"{CACHE_PREFIX}{hashlib.md5(key_str.encode()).hexdigest()}"

    logger.debug(f"Cache key: {cache_key}")
    logger.debug(f"Using cache: {use_cache}")
    if use_cache:
        cached_html = cache.get(cache_key)
        logger.debug(f"Cache hit for {url}" if cached_html else f"No cache for {url}")
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
            "Accept-Language": "en-US,en;q=0.8",
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
                    cache.set(cache_key, response.text, 3600)  # 1 hour
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
            service=browser_service,
        )

    return CrawlResult(
        success=False, error="Regular request failed and browser fallback disabled"
    )


# Backward compatibility: Alias the old BrowserCrawler class
BrowserCrawler = RealBrowserCrawler
