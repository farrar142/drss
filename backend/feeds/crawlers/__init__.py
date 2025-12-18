"""
Browser crawler module for RSS feed scraping.

This module provides browser-based web crawling capabilities with support for
multiple browser services (RealBrowser and Browserless.io).
"""

from .abstract import AbstractBrowserCrawler, CrawlResult, WaitUntil
from .base import BaseBrowserCrawler
from .realbrowser import RealBrowserCrawler
from .browserless import BrowserlessCrawler

__all__ = [
    "AbstractBrowserCrawler",
    "CrawlResult",
    "WaitUntil",
    "BaseBrowserCrawler",
    "RealBrowserCrawler",
    "BrowserlessCrawler",
]
