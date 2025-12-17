"""
Test script for browser_crawler module.

Usage:
    # First, start the crawler service:
    docker-compose --profile crawler -f ./dev.compose.yml up -d real-browser

    # Then run this script from the backend directory:
    python -c "from feeds.browser_crawler_test import test_all; test_all()"
"""

import sys
import os

# Add backend to path if running directly
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from feeds.browser_crawler import (
    fetch_html_with_browser,
    fetch_html_smart,
    BrowserCrawler,
    WaitUntil,
    CrawlResult,
)


def test_simple_fetch():
    """Test basic HTML fetch with browser."""
    print("\n=== Test: Simple Fetch ===")

    result = fetch_html_with_browser(
        url="https://example.com",
        selector="body",
        timeout=30000,
    )

    print(f"Success: {result.success}")
    print(f"From Cache: {result.from_cache}")
    print(f"URL: {result.url}")

    if result.success and result.html:
        print(f"HTML Length: {len(result.html)}")
        print(f"HTML Preview: {result.html[:200]}...")
    else:
        print(f"Error: {result.error}")

    return result.success


def test_smart_fetch():
    """Test smart fetch (tries regular HTTP first, then browser)."""
    print("\n=== Test: Smart Fetch ===")

    # This should work with regular HTTP (no bot protection)
    result = fetch_html_smart(
        url="https://httpbin.org/html",
        use_browser_on_fail=True,
    )

    print(f"Success: {result.success}")
    print(f"URL: {result.url}")

    if result.success and result.html:
        print(f"HTML Length: {len(result.html)}")
    else:
        print(f"Error: {result.error}")

    return result.success


def test_cloudflare_protected():
    """Test fetching a Cloudflare-protected site."""
    print("\n=== Test: Cloudflare Protected Site ===")

    # Note: This test may fail if the site changes its protection
    # or if it's not actually protected
    result = fetch_html_with_browser(
        url="https://nowsecure.nl",  # Test site for bot detection
        selector="body",
        wait_until=WaitUntil.NETWORKIDLE2,
        timeout=60000,
    )

    print(f"Success: {result.success}")

    if result.success and result.html:
        print(f"HTML Length: {len(result.html)}")
        # Check if we got past the challenge
        if "challenge" in result.html.lower():
            print("Warning: Still seeing challenge page")
        else:
            print("Successfully bypassed protection!")
    else:
        print(f"Error: {result.error}")

    return result.success


def test_custom_selector():
    """Test waiting for a specific selector."""
    print("\n=== Test: Custom Selector ===")

    result = fetch_html_with_browser(
        url="https://news.ycombinator.com",
        selector=".itemlist",  # Wait for the news list
        timeout=30000,
    )

    print(f"Success: {result.success}")

    if result.success and result.html:
        print(f"HTML Length: {len(result.html)}")
        if "itemlist" in result.html:
            print("Found .itemlist in response!")
    else:
        print(f"Error: {result.error}")

    return result.success


def test_crawler_class():
    """Test using the BrowserCrawler class directly."""
    print("\n=== Test: BrowserCrawler Class ===")

    # For local development, use localhost:3001
    # In Docker, use http://real-browser:3000
    service_url = os.getenv("PUPPETEER_REAL_BROWSER_SERVICE", "http://localhost:3001")

    crawler = BrowserCrawler(
        service_url=service_url,
        timeout=30000,
        default_wait_until=WaitUntil.NETWORKIDLE2,
    )

    result = crawler.fetch_html(
        url="https://example.com",
        selector="h1",
    )

    print(f"Success: {result.success}")

    if result.success and result.html:
        print(f"HTML Length: {len(result.html)}")
    else:
        print(f"Error: {result.error}")

    return result.success


def test_all():
    """Run all tests."""
    print("=" * 50)
    print("Browser Crawler Tests")
    print("=" * 50)

    results = {
        "Simple Fetch": test_simple_fetch(),
        "Smart Fetch": test_smart_fetch(),
        "Custom Selector": test_custom_selector(),
        "Crawler Class": test_crawler_class(),
    }

    # Optional: test Cloudflare bypass (may be slow)
    # results["Cloudflare"] = test_cloudflare_protected()

    print("\n" + "=" * 50)
    print("Test Results")
    print("=" * 50)

    for name, passed in results.items():
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"  {status}: {name}")

    passed = sum(results.values())
    total = len(results)
    print(f"\nTotal: {passed}/{total} tests passed")

    return all(results.values())


if __name__ == "__main__":
    test_all()
