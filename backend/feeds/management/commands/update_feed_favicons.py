from django.core.management.base import BaseCommand
from feeds.models import RSSFeed
from urllib.parse import urljoin, urlparse
import time
import random

try:
    import requests
except Exception:
    requests = None

try:
    from bs4 import BeautifulSoup
except Exception:
    BeautifulSoup = None

try:
    import feedparser
except Exception:
    feedparser = None


def _is_image_response(resp):
    ctype = resp.headers.get("content-type", "").lower()
    return resp.status_code == 200 and ctype.startswith("image")


def find_favicon_from_html(base_url, html_text):
    # Prefer BeautifulSoup when available, but fall back to regex parsing for tests or minimal deps
    if BeautifulSoup is not None:
        soup = BeautifulSoup(html_text, "html.parser")
        # common rel values
        rel_candidates = [
            "icon",
            "shortcut icon",
            "apple-touch-icon",
            "apple-touch-icon-precomposed",
        ]
        for rel in rel_candidates:
            link = soup.find("link", rel=lambda x: x and rel in x.lower())
            if link and link.get("href"):
                return urljoin(base_url, link.get("href"))
        return None

    # Fallback simple regex parsing (not fully robust)
    import re

    m = re.search(
        r"<link[^>]+rel=[\"']?[^>\"']*icon[^>\"']*[\"']?[^>]*href=[\"']?([^\"' >]+)[\"']?",
        html_text,
        re.IGNORECASE,
    )
    if m:
        return urljoin(base_url, m.group(1))
    return None


def find_favicon_from_feed_xml(base_url, xml_text):
    """Try to extract a feed-level image/icon from RSS/Atom XML using ElementTree."""
    try:
        import xml.etree.ElementTree as ET

        root = ET.fromstring(xml_text)
        # RSS <image><url>
        el = root.find(".//image/url")
        if el is not None and el.text:
            return urljoin(base_url, el.text.strip())

        # Atom <logo> or <icon>
        el = (
            root.find(".//{*}logo")
            or root.find(".//logo")
            or root.find(".//{*}icon")
            or root.find(".//icon")
        )
        if el is not None and el.text:
            return urljoin(base_url, el.text.strip())
    except Exception:
        return None
    return None


class Command(BaseCommand):
    help = "Update favicon_url for RSSFeed entries by probing site / parsing HTML"

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
            default=5,
            help="Minimum seconds to wait between requests to the same host (politeness)",
        )

    def handle(self, *args, **options):
        if requests is None:
            import sys

            self.stderr.write(
                "Missing dependency: 'requests' is required. "
                f"Install it with: {sys.executable} -m pip install requests beautifulsoup4"
            )
            return
        if BeautifulSoup is None:
            # bs4 is optional - we'll fall back to a regex-based parser when missing
            self.stdout.write(
                "Note: 'beautifulsoup4' not installed, falling back to minimal HTML parsing"
            )

        feed_id = options.get("feed_id")
        force = options.get("force")
        limit = options.get("limit") or 0

        qs = RSSFeed.objects.all().order_by("pk")
        if feed_id:
            qs = qs.filter(pk=feed_id)
        if limit > 0:
            qs = qs[:limit]

        updated = 0
        skipped = 0
        failed = 0

        session = requests.Session()
        session.headers.update({"User-Agent": "drss-favicon-fetcher/1.0"})

        throttle = options.get("throttle") or 5
        last_request_time = {}

        def wait_for_host(url):
            try:
                host = urlparse(url).netloc
            except Exception:
                return
            now = time.time()
            last = last_request_time.get(host)
            if last is not None:
                elapsed = now - last
                if elapsed < throttle:
                    sleep_time = throttle - elapsed + random.random() * 0.5
                    time.sleep(sleep_time)
            last_request_time[host] = time.time()

        def handle_rate_limit(resp):
            # Return True if we handled (slept and caller may retry once), False if caller should not retry
            if not resp:
                return False
            if resp.status_code in (429, 503):
                ra = resp.headers.get("Retry-After")
                if ra:
                    try:
                        wait = int(ra)
                    except Exception:
                        try:
                            wait = int(float(ra))
                        except Exception:
                            wait = throttle * 2
                else:
                    wait = throttle * 6
                # be polite
                time.sleep(wait)
                return True
            return False

        for feed in qs:
            if feed.favicon_url and not force:
                skipped += 1
                self.stdout.write(f"Skipping feed {feed.pk} (has favicon)")
                continue

            try:
                parsed = urlparse(feed.url)
                root_favicon = f"{parsed.scheme}://{parsed.netloc}/favicon.ico"

                # Fetch content (RSS/HTML) first so we can inspect feed metadata (channel link/logo)
                try:
                    wait_for_host(feed.url)
                    resp = session.get(feed.url, timeout=8, allow_redirects=True)
                    # Detect upstream blocking (e.g., RSSHub or 429/503) and skip aggressive fallbacks
                    if resp is not None and resp.status_code in (429, 503):
                        body = (resp.text or "").lower()
                        if (
                            "rsshub" in body
                            or "too many requests" in body
                            or resp.status_code in (429, 503)
                        ):
                            self.stdout.write(
                                f"Blocked or rate-limited fetching feed {feed.pk} (status {resp.status_code}); skipping and will not fall back to root favicon"
                            )
                            failed += 1
                            # record host cooldown
                            try:
                                host = urlparse(feed.url).netloc
                                last_request_time[host] = time.time() + throttle * 6
                            except Exception:
                                pass
                            continue
                except Exception:
                    resp = None

                if resp and resp.status_code == 200:
                    # If the feed provides a channel/home link, prefer that domain's root favicon
                    channel_link = None
                    try:
                        if feedparser is not None:
                            pf = feedparser.parse(resp.content or resp.text)
                            if getattr(pf, "feed", None):
                                # Try common fields
                                channel_link = pf.feed.get("link")
                                # Also inspect 'links' list (Atom or feedparser normalized structure)
                                if not channel_link and pf.feed.get("links"):
                                    for l in pf.feed.get("links", []):
                                        href = (
                                            l.get("href")
                                            if isinstance(l, dict)
                                            else None
                                        )
                                        rel = (
                                            l.get("rel")
                                            if isinstance(l, dict)
                                            else None
                                        )
                                        if href and rel == "alternate":
                                            channel_link = href
                                            break
                                    if not channel_link and pf.feed.get("links"):
                                        # fallback to first link with href
                                        first = next(
                                            (
                                                l.get("href")
                                                for l in pf.feed.get("links")
                                                if isinstance(l, dict) and l.get("href")
                                            ),
                                            None,
                                        )
                                        if first:
                                            channel_link = first
                                # debug output
                                if not channel_link:
                                    self.stdout.write(
                                        f"feedparser.feed keys: {list(pf.feed.keys())}"
                                    )
                            else:
                                channel_link = None
                    except Exception:
                        channel_link = None

                        # XML fallback for channel link
                        if not channel_link and resp.text:
                            try:
                                import xml.etree.ElementTree as ET

                                root = ET.fromstring(resp.text)

                                # Prefer RSS channel/link
                                el = root.find(".//channel/link")
                                if el is not None and el.text:
                                    channel_link = el.text.strip()
                                else:
                                    # Atom-style: <link href="..." rel="alternate" /> under feed
                                    # search for any link with href, prefer rel='alternate'
                                    candidates = []
                                    for link in root.findall(
                                        ".//{*}link"
                                    ) + root.findall(".//link"):
                                        href = link.get("href")
                                        if href:
                                            rel = link.get("rel")
                                            candidates.append((rel or "", href))
                                    # prefer rel='alternate'
                                    alt = next(
                                        (h for r, h in candidates if r == "alternate"),
                                        None,
                                    )
                                    if alt:
                                        channel_link = alt
                                    elif candidates:
                                        channel_link = candidates[0][1]
                            except Exception:
                                channel_link = None

                    if channel_link:
                        self.stdout.write(
                            f"Channel link found for feed {feed.pk}: {channel_link}"
                        )
                        try:
                            ch_parsed = urlparse(channel_link)
                            channel_root = f"{ch_parsed.scheme or parsed.scheme}://{ch_parsed.netloc}"
                            channel_root_favicon = f"{channel_root}/favicon.ico"
                            wait_for_host(channel_root_favicon)
                            rch = session.head(
                                channel_root_favicon, timeout=5, allow_redirects=True
                            )
                            if handle_rate_limit(rch):
                                # refreshed server asked to retry, try once more
                                wait_for_host(channel_root_favicon)
                                rch = session.head(
                                    channel_root_favicon,
                                    timeout=5,
                                    allow_redirects=True,
                                )
                            if _is_image_response(rch):
                                feed.favicon_url = channel_root_favicon
                                feed.save()
                                updated += 1
                                self.stdout.write(
                                    f"Updated feed {feed.pk} -> {channel_root_favicon} (channel-root)"
                                )
                                continue
                            # If HEAD didn't indicate an image, try GET channel page and parse for <link rel="icon">
                            if rch.status_code == 200 and not _is_image_response(rch):
                                try:
                                    wait_for_host(channel_link)
                                    rpage = session.get(
                                        channel_link, timeout=6, allow_redirects=True
                                    )
                                    if handle_rate_limit(rpage):
                                        wait_for_host(channel_link)
                                        rpage = session.get(
                                            channel_link,
                                            timeout=6,
                                            allow_redirects=True,
                                        )
                                    if rpage and rpage.status_code == 200:
                                        page_cand = find_favicon_from_html(
                                            rpage.url, rpage.text
                                        )
                                        if page_cand:
                                            # validate candidate
                                            try:
                                                wait_for_host(page_cand)
                                                vr = session.head(
                                                    page_cand,
                                                    timeout=5,
                                                    allow_redirects=True,
                                                )
                                                if handle_rate_limit(vr):
                                                    wait_for_host(page_cand)
                                                    vr = session.head(
                                                        page_cand,
                                                        timeout=5,
                                                        allow_redirects=True,
                                                    )
                                                if _is_image_response(vr):
                                                    feed.favicon_url = page_cand
                                                    feed.save()
                                                    updated += 1
                                                    self.stdout.write(
                                                        f"Updated feed {feed.pk} -> {page_cand} (channel-page-icon)"
                                                    )
                                                    continue
                                            except Exception:
                                                pass
                                except Exception:
                                    pass
                        except Exception:
                            pass

                    # Fetch HTML and look for link rel icons or RSS feed images

                    # First, try parsing as RSS/Atom feed to get feed-level image/logo/icon
                    cand = None
                    if feedparser is not None:
                        try:
                            parsed_feed = feedparser.parse(resp.content or resp.text)
                            # feedparser may provide logo, icon, or image
                            if parsed_feed.feed:
                                # feedparser.feed behaves like a dict
                                if parsed_feed.feed.get("icon"):
                                    cand = parsed_feed.feed.get("icon")
                                elif parsed_feed.feed.get("logo"):
                                    cand = parsed_feed.feed.get("logo")
                                elif parsed_feed.feed.get("image"):
                                    img = parsed_feed.feed.get("image")
                                    # image may be a dict-like
                                    if isinstance(img, dict):
                                        cand = img.get("href") or img.get("url")
                                    else:
                                        # feedparser may wrap as object
                                        cand = getattr(img, "href", None) or getattr(
                                            img, "url", None
                                        )
                        except Exception:
                            cand = None
                    if cand:
                        # debug logging to help troubleshoot feed parsing
                        self.stdout.write(
                            f"Found feed-level candidate for feed {feed.pk}: {cand}"
                        )

                    # If feed didn't provide an image, fallback to XML or HTML parsing
                    if not cand:
                        # if this looks like XML (rss/atom), try xml parsing first
                        if resp.text and (
                            "<rss" in resp.text.lower() or "<feed" in resp.text.lower()
                        ):
                            cand = find_favicon_from_feed_xml(resp.url, resp.text)
                        if not cand:
                            cand = find_favicon_from_html(resp.url, resp.text)
                    if cand:
                        # validate candidate
                        try:
                            r2 = session.head(cand, timeout=5, allow_redirects=True)
                            if _is_image_response(r2):
                                feed.favicon_url = cand
                                feed.save()
                                updated += 1
                                self.stdout.write(
                                    f"Updated feed {feed.pk} -> {cand} (html)"
                                )
                                continue
                        except Exception:
                            # try GET as fallback
                            try:
                                r2 = session.get(cand, timeout=6, stream=True)
                                if _is_image_response(r2):
                                    feed.favicon_url = cand
                                    feed.save()
                                    updated += 1
                                    self.stdout.write(
                                        f"Updated feed {feed.pk} -> {cand} (html-get)"
                                    )
                                    continue
                            except Exception:
                                pass

                # Fallback: try root favicon on feed.url domain (if not already found), then http/https switch
                try:
                    resp_root = session.head(
                        root_favicon, timeout=5, allow_redirects=True
                    )
                    if _is_image_response(resp_root):
                        feed.favicon_url = root_favicon
                        feed.save()
                        updated += 1
                        self.stdout.write(
                            f"Updated feed {feed.pk} -> {root_favicon} (root)"
                        )
                        continue
                except Exception:
                    pass

                # Fallback: try http/https switch for root
                alt_scheme = "https" if parsed.scheme == "http" else "http"
                alt_root = f"{alt_scheme}://{parsed.netloc}/favicon.ico"
                try:
                    r3 = session.head(alt_root, timeout=5, allow_redirects=True)
                    if _is_image_response(r3):
                        feed.favicon_url = alt_root
                        feed.save()
                        updated += 1
                        self.stdout.write(
                            f"Updated feed {feed.pk} -> {alt_root} (alt-root)"
                        )
                        continue
                except Exception:
                    pass

                self.stdout.write(
                    f"Could not find favicon for feed {feed.pk} ({feed.url})"
                )
                failed += 1

            except Exception as e:
                self.stderr.write(f"Error processing feed {feed.pk}: {e}")
                failed += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Done. updated={updated}, skipped={skipped}, failed={failed}"
            )
        )
