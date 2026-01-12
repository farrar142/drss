from django.core.management.base import BaseCommand
from feeds.models import RSSFeed
from urllib.parse import urljoin, urlparse
import time
import random
from typing import Optional

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

try:
    import cloudscraper
    HAS_CLOUDSCRAPER = True
except ImportError:
    HAS_CLOUDSCRAPER = False

import feedparser


def _is_image_response(resp: requests.Response) -> bool:
    """Check if the response is a valid image."""
    ctype = resp.headers.get("content-type", "").lower()
    return resp.status_code == 200 and ctype.startswith("image")


def get_base_url(url: str) -> str:
    """Extract scheme://netloc/ from a URL."""
    parsed = urlparse(url)
    return f"{parsed.scheme}://{parsed.netloc}/"


def make_retry_session(retries: int = 3, backoff: float = 0.5) -> requests.Session:
    """Build a session with retry on transient errors."""
    s = requests.Session()
    retry = Retry(
        total=retries,
        read=retries,
        connect=retries,
        backoff_factor=backoff,
        status_forcelist=(500, 502, 503, 504),
        allowed_methods=("HEAD", "GET", "OPTIONS"),
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retry)
    s.mount("http://", adapter)
    s.mount("https://", adapter)
    return s


class Command(BaseCommand):
    help = "Update favicon_url for RSSFeed entries by fetching /favicon.ico from channel link"

    def add_arguments(self, parser):
        parser.add_argument("--feed-id", type=int, help="Only update this feed id")
        parser.add_argument(
            "--force", action="store_true", help="Overwrite existing favicon_url"
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Limit number of feeds to process (0 = all)",
        )
        parser.add_argument(
            "--throttle",
            type=int,
            default=1,
            help="Seconds to wait between requests (politeness)",
        )
        parser.add_argument(
            "--stop-on-fail",
            action="store_true",
            help="Stop processing when the first failure occurs",
        )

    def handle(self, *args, **options):
        feed_id = options.get("feed_id")
        force = options.get("force")
        limit = options.get("limit") or 0
        throttle = options.get("throttle") or 1
        stop_on_fail = options.get("stop_on_fail")

        qs = RSSFeed.objects.all().order_by("pk")
        if feed_id:
            qs = qs.filter(pk=feed_id)
        if limit > 0:
            qs = qs[:limit]

        updated = 0
        skipped = 0
        failed = 0

        session = make_retry_session()

        # Create cloudscraper session for sites with bot protection
        if HAS_CLOUDSCRAPER:
            cf_session = cloudscraper.create_scraper(
                browser={
                    'browser': 'chrome',
                    'platform': 'windows',
                    'mobile': False
                }
            )
        else:
            cf_session = None

        # Hosts known to have aggressive bot protection
        protected_hosts = {"misskon.com", "www.misskon.com"}

        # Hosts that are known to be unreachable (connection reset, geo-blocked, etc.)
        # Skip these to save time; user can retry later or add via --force
        unreachable_hosts: set = set()

        def get_browser_headers(base_url: str) -> dict:
            """Generate browser-like headers with proper Referer/Origin for anti-bot bypass."""
            return {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                              "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
                "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
                "Accept-Encoding": "gzip, deflate, br",
                "Referer": base_url,
                "Origin": base_url.rstrip("/"),
                "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                "Sec-Ch-Ua-Mobile": "?0",
                "Sec-Ch-Ua-Platform": '"Windows"',
                "Sec-Fetch-Dest": "image",
                "Sec-Fetch-Mode": "no-cors",
                "Sec-Fetch-Site": "same-origin",
            }

        for feed in qs:
            # Step 1: Fetch the RSS feed XML
            rss_headers = {
                **feed.custom_headers,
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                              "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            }
            try:
                resp = session.get(feed.url, headers=rss_headers, timeout=15)
                if resp.status_code != 200:
                    raise requests.RequestException(f"HTTP {resp.status_code}")
                feed_xml = resp.text
            except Exception as e:
                failed += 1
                self.stderr.write(f"[Feed {feed.pk}] Failed to fetch RSS: {e}")
                if stop_on_fail:
                    break
                continue

            # Step 2: Parse RSS and extract channel link
            parsed = feedparser.parse(feed_xml)
            channel_link: Optional[str] = None

            # feedparser stores channel info in feed.feed (the parsed feed metadata)
            feed_meta = parsed.get("feed", {})
            if not isinstance(feed_meta, dict):
                feed_meta = {}
            channel_link = feed_meta.get("link")

            if not channel_link:
                # Fallback: try to get from first entry's base
                entries = parsed.get("entries", [])
                if entries and entries[0].get("link"):
                    link = entries[0].get("link")
                    if isinstance(link, str):
                        channel_link = link

            if not channel_link:
                failed += 1
                self.stderr.write(f"[Feed {feed.pk}] No channel link found in RSS")
                if stop_on_fail:
                    break
                continue

            # Step 3: Build favicon URL from channel link's base
            base_url = channel_link
            favicon_url = urljoin(base_url, "/favicon.ico")

            self.stdout.write(f"[Feed {feed.pk}] Trying {favicon_url}")

            # Step 4: Check if favicon.ico exists and is an image
            # Use cloudscraper for protected hosts, otherwise regular session
            favicon_headers = {**feed.custom_headers, **get_browser_headers(base_url)}
            parsed_url = urlparse(favicon_url)
            host = parsed_url.netloc

            # Skip hosts that have failed with connection errors in this run
            if host in unreachable_hosts:
                failed += 1
                self.stderr.write(f"[Feed {feed.pk}] Skipping {host} (previously unreachable)")
                continue

            try:
                if cf_session and host in protected_hosts:
                    self.stdout.write(f"[Feed {feed.pk}] Using cloudscraper for {host}")
                    favicon_resp = cf_session.get(favicon_url, timeout=15)
                else:
                    favicon_resp = session.get(favicon_url, headers=favicon_headers, timeout=10, stream=True)
                if _is_image_response(favicon_resp):
                    # Success! Update the feed
                    if force or not feed.favicon_url or feed.favicon_url != favicon_url:
                        feed.favicon_url = favicon_url
                        feed.save(update_fields=["favicon_url"])
                        updated += 1
                        self.stdout.write(self.style.SUCCESS(f"[Feed {feed.pk}] Updated: {favicon_url}"))
                    else:
                        skipped += 1
                        self.stdout.write(f"[Feed {feed.pk}] Already set, skipped")
                else:
                    failed += 1
                    ctype = favicon_resp.headers.get("content-type", "unknown")
                    self.stderr.write(
                        f"[Feed {feed.pk}] Not an image (status={favicon_resp.status_code}, type={ctype})"
                    )
                    if stop_on_fail:
                        break
            except requests.RequestException as e:
                failed += 1
                self.stderr.write(f"[Feed {feed.pk}] Network error: {e}")
                # Mark host as unreachable if it's a connection error
                if "Connection" in str(e) or "reset" in str(e).lower():
                    unreachable_hosts.add(host)
                    self.stderr.write(f"[Feed {feed.pk}] Marking {host} as unreachable for this run")
                if stop_on_fail:
                    break

            # Throttle between requests
            time.sleep(throttle + random.random() * 0.5)

        self.stdout.write(
            self.style.NOTICE(f"\nDone. Updated: {updated}, Skipped: {skipped}, Failed: {failed}")
        )

