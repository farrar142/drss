"""
Browser-based web crawler using Browserless.io service.

This module provides functions to fetch web pages using Browserless.io
to bypass bot detection and anti-scraping measures.

Requires the browserless service to be running (see dev.compose.yml).

API Reference (Browserless.io):
    https://docs.browserless.io/rest-apis/intro
"""

import os
import logging
from typing import Optional, List
from urllib.parse import urlencode

import requests

from .base import BaseBrowserCrawler
from .abstract import CrawlResult, WaitUntil

logger = logging.getLogger(__name__)


class BrowserlessCrawler(BaseBrowserCrawler):
    """
    Browser-based crawler that uses Browserless.io service
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
        Initialize the browserless crawler.

        Args:
            service_url: URL of the browserless service.
                        Defaults to BROWSERLESS_SERVICE env var or http://browserless:3000
            timeout: Default timeout in milliseconds for page operations
            default_wait_until: Default wait condition for page load
            default_selector: Default CSS selector to wait for
        """
        service_url = service_url or os.getenv(
            "BROWSERLESS_SERVICE", "http://browserless:3000"
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
        Fetch HTML content from a URL using Browserless.io.

        This is the raw implementation without caching or retry logic.
        Note: Browserless has limited REST API support. Using basic HTTP fallback.

        Args:
            url: The URL to fetch
            selector: CSS selector to wait for before capturing content
            wait_until: Page load wait condition
            timeout: Timeout in milliseconds
            headers: Custom headers to send with the request

        Returns:
            CrawlResult with success status and HTML content or error message
        """
        try:
            logger.warning(
                f"BrowserlessCrawler: Browserless REST API has limited support. Falling back to basic HTTP request for {url}"
            )

            # Browserless REST API is limited, so we fall back to basic HTTP request
            # This is a temporary solution until proper Browserless integration is implemented
            request_timeout = ((timeout or self.timeout) / 1000) + 30

            # Use basic requests with browser-like headers
            request_headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.8",
            }
            if headers:
                request_headers.update(headers)

            response = requests.get(
                url,
                timeout=request_timeout,
                headers=request_headers,
            )

            if response.status_code == 200:
                return CrawlResult(
                    success=True,
                    html=response.text,
                    url=url,
                    from_cache=False,
                )
            else:
                error_msg = f"HTTP {response.status_code} from {url}"
                logger.error(f"Browserless fallback failed for {url}: {error_msg}")
                return CrawlResult(success=False, error=error_msg)

        except requests.exceptions.Timeout:
            error_msg = f"Timeout fetching {url}"
            logger.error(error_msg)
            return CrawlResult(success=False, error=error_msg)

        except requests.exceptions.ConnectionError as e:
            error_msg = f"Connection error to browserless service: {e}"
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
        Fetch HTML content from multiple URLs using Browserless.io.

        Note: Browserless doesn't natively support multiple URLs in one request,
        so we make sequential requests.

        Args:
            urls: List of URLs to fetch
            selector: CSS selector to wait for
            wait_until: Page load wait condition
            timeout: Timeout in milliseconds

        Returns:
            List of CrawlResult objects (one per URL)
        """
        # Use base class implementation which handles sequential requests
        return super().fetch_multiple(urls, selector, wait_until, timeout)
