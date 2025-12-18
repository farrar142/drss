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
from typing import Optional, List
from urllib.parse import urlencode

import requests

from .base import BaseBrowserCrawler
from .abstract import CrawlResult, WaitUntil

logger = logging.getLogger(__name__)


class RealBrowserCrawler(BaseBrowserCrawler):
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
        Initialize the real browser crawler.

        Args:
            service_url: URL of the real-browser service.
                        Defaults to PUPPETEER_REAL_BROWSER_SERVICE env var or http://real-browser:3000
            timeout: Default timeout in milliseconds for page operations
            default_wait_until: Default wait condition for page load
            default_selector: Default CSS selector to wait for
        """
        service_url = service_url or os.getenv(
            "PUPPETEER_REAL_BROWSER_SERVICE", "http://real-browser:3000"
        )

        super().__init__(
            service_url=service_url,
            timeout=timeout,
            default_wait_until=default_wait_until,
            default_selector=default_selector,
        )

    def fetch_html_raw(
        self,
        url: str,
        selector: Optional[str] = None,
        wait_until: Optional[WaitUntil] = None,
        timeout: Optional[int] = None,
        headers: Optional[dict] = None,
    ) -> CrawlResult:
        """
        Fetch HTML content from a URL using a real browser.

        This is the raw implementation without caching or retry logic.

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
                # Debug: Log response content type and sample
                logger.debug(
                    f"Response content-type: {response.headers.get('content-type')}"
                )
                logger.debug(f"Response text sample: {response.text[:200]}...")

                # Try to parse JSON, but handle non-JSON responses
                try:
                    data = response.json()
                except requests.exceptions.JSONDecodeError as e:
                    # If not JSON, log detailed error and check response
                    logger.error(f"JSON decode error from real-browser service: {e}")
                    logger.error(f"Response status: {response.status_code}")
                    logger.error(f"Response headers: {dict(response.headers)}")
                    logger.error(
                        f"Response text (first 1000 chars): {response.text[:1000]}"
                    )

                    # Check if response looks like HTML (service might be returning HTML directly)
                    if response.text.strip().startswith("<"):
                        logger.warning("Treating response as direct HTML content")
                        return CrawlResult(
                            success=True,
                            html=response.text,
                            url=url,
                            from_cache=False,
                        )
                    else:
                        return CrawlResult(
                            success=False,
                            error=f"JSON decode failed and response is not HTML: {response.text[:200]}",
                            url=url,
                        )

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
        urls: List[str],
        selector: Optional[str] = None,
        wait_until: Optional[WaitUntil] = None,
        timeout: Optional[int] = None,
    ) -> List[CrawlResult]:
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
                # Debug: Log response content type and sample
                logger.debug(
                    f"Response content-type: {response.headers.get('content-type')}"
                )
                logger.debug(f"Response text sample: {response.text[:200]}...")

                # Try to parse JSON, but handle non-JSON responses
                try:
                    data = response.json()
                except requests.exceptions.JSONDecodeError as e:
                    # If not JSON, this is unexpected for multiple URLs
                    logger.error(
                        f"Non-JSON response from real-browser service for multiple URLs: {e}"
                    )
                    error_msg = f"Unexpected response format for multiple URLs: {response.text[:100]}"
                    return [
                        CrawlResult(success=False, error=error_msg, url=u) for u in urls
                    ]

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
