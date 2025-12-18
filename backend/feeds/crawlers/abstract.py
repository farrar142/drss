"""
Abstract base class for browser-based web crawlers.

This module defines the common interface that all browser crawler implementations
should follow, allowing for easy switching between different browser services.
"""

from abc import ABC, abstractmethod
from typing import Optional, List
from dataclasses import dataclass
from enum import Enum


@dataclass
class CrawlResult:
    """Result of a browser crawl operation"""

    success: bool
    html: Optional[str] = None
    error: Optional[str] = None
    url: Optional[str] = None  # Final URL after redirects
    from_cache: bool = False


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


class AbstractBrowserCrawler(ABC):
    """
    Abstract base class for browser-based crawlers.

    All browser crawler implementations should inherit from this class
    and implement the required methods.
    """

    @abstractmethod
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
            service_url: URL of the browser service
            timeout: Default timeout in milliseconds for page operations
            default_wait_until: Default wait condition for page load
            default_selector: Default CSS selector to wait for
        """
        pass

    @abstractmethod
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

        Args:
            url: The URL to fetch
            selector: CSS selector to wait for before capturing content
            wait_until: Page load wait condition
            timeout: Timeout in milliseconds
            headers: Custom headers to send with the request

        Returns:
            CrawlResult with success status and HTML content or error message
        """
        pass

    @abstractmethod
    def fetch_multiple(
        self,
        urls: List[str],
        selector: Optional[str] = None,
        wait_until: Optional[WaitUntil] = None,
        timeout: Optional[int] = None,
    ) -> List[CrawlResult]:
        """
        Fetch HTML content from multiple URLs using a browser.

        Args:
            urls: List of URLs to fetch
            selector: CSS selector to wait for
            wait_until: Page load wait condition
            timeout: Timeout in milliseconds

        Returns:
            List of CrawlResult objects (one per URL)
        """
        pass
