from logging import getLogger
from time import struct_time
import feedparser
import requests
from datetime import datetime, timezone
from celery import shared_task
from django.contrib.auth import get_user_model
from django.apps import apps
from django.utils import timezone as django_timezone
from feeds.utils import fetch_feed_data, parse_date
import os
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from io import BytesIO
from PIL import Image
from urllib.parse import urljoin

# Image caching has been removed. The previous cache_image_task is intentionally
# removed so images are fetched directly by clients and rely on browser caching.

logger = getLogger(__name__)


def extract_html_block(element, base_url: str = "") -> str:
    """
    요소의 HTML 블록 전체를 추출 (이미지 등의 상대 URL을 절대 URL로 변환)
    """
    if element is None:
        return ""

    from copy import copy
    from bs4 import BeautifulSoup

    # 복사본을 만들어서 URL 변환
    element_copy = copy(element)

    # 상대 URL을 절대 URL로 변환
    if base_url:
        # img src 변환
        for img in element_copy.find_all("img"):
            for attr in ["src", "data-src", "data-lazy-src"]:
                if img.get(attr):
                    img[attr] = urljoin(base_url, img[attr])

        # a href 변환
        for a in element_copy.find_all("a"):
            if a.get("href"):
                a["href"] = urljoin(base_url, a["href"])

        # video/source src 변환
        for media in element_copy.find_all(["video", "source", "audio"]):
            if media.get("src"):
                media["src"] = urljoin(base_url, media["src"])

    return str(element_copy)


@shared_task(bind=True)
def update_feed_items(self, feed_id, task_result_id=None):
    from .models import RSSFeed, RSSItem, FeedTaskResult

    """
    특정 RSS 피드의 아이템들을 업데이트하는 task
    RSSEverythingSource가 연결된 경우 크롤링을 사용하고,
    그렇지 않으면 기존 RSS 파싱을 사용합니다.
    """
    
    # Task 결과 레코드 가져오기 또는 생성
    task_result = None
    if task_result_id:
        try:
            task_result = FeedTaskResult.objects.get(id=task_result_id)
            task_result.status = FeedTaskResult.Status.RUNNING
            task_result.task_id = self.request.id or ""
            task_result.started_at = django_timezone.now()
            task_result.save(update_fields=["status", "task_id", "started_at"])
        except FeedTaskResult.DoesNotExist:
            task_result = None

    try:
        feed = RSSFeed.objects.get(id=feed_id)
        logger.info(f"Updating feed: {feed.title} ({feed.url})")
    except RSSFeed.DoesNotExist:
        if task_result:
            task_result.status = FeedTaskResult.Status.FAILURE
            task_result.error_message = f"Feed {feed_id} does not exist"
            task_result.completed_at = django_timezone.now()
            task_result.save(update_fields=["status", "error_message", "completed_at"])
        return f"Feed {feed_id} does not exist"

    # task_result가 없으면 새로 생성 (이전 호환성 유지)
    if not task_result:
        task_result = FeedTaskResult.objects.create(
            feed=feed,
            task_id=self.request.id or "",
            status=FeedTaskResult.Status.RUNNING,
            started_at=django_timezone.now(),
        )

    try:
        # RSSEverythingSource가 연결된 경우 크롤링 사용
        try:
            if hasattr(feed, "rss_everything_source") and feed.rss_everything_source:
                result = _update_feed_from_rss_everything(feed, task_result)
            else:
                result = _update_feed_from_rss(feed, task_result)
        except Exception:
            result = _update_feed_from_rss(feed, task_result)
        
        return result
    except Exception as e:
        logger.exception(f"Failed to update feed {feed_id}")
        task_result.status = FeedTaskResult.Status.FAILURE
        task_result.error_message = str(e)
        task_result.completed_at = django_timezone.now()
        task_result.save(update_fields=["status", "error_message", "completed_at"])
        return f"Failed: {str(e)}"


def _update_feed_from_rss(feed, task_result=None):
    """일반 RSS 피드에서 아이템을 업데이트"""
    from .models import RSSItem, FeedTaskResult
    from feedparser import FeedParserDict

    feed_data = fetch_feed_data(feed.url, feed.custom_headers)

    if feed_data.bozo:
        return f"Failed to parse feed {feed.url}: {feed_data.bozo_exception}"

    # 새로운 아이템들 수집
    new_items = []
    existing_guids = set(
        RSSItem.objects.filter(feed=feed).values_list("guid", flat=True)
    )

    for entry in feed_data.entries:
        if not isinstance(entry, FeedParserDict):
            continue
        # GUID 생성 (없으면 link 사용)
        guid = getattr(entry, "id", None) or getattr(entry, "guid", None) or entry.link

        if guid in existing_guids:
            continue
        guid = str(guid)[:499]
        # 제목 추출
        title = getattr(entry, "title", "No Title")
        if not isinstance(title, str):
            continue
        title = title[:199]
        # 설명 추출
        description = ""
        if hasattr(entry, "description"):
            description = entry.description
        elif hasattr(entry, "summary"):
            description = entry.summary

        # 링크 추출
        link = getattr(entry, "link", "")
        if not isinstance(link, str):
            continue

        # 발행일 추출
        published_at = django_timezone.now()
        if hasattr(entry, "published_parsed") and entry.published_parsed:
            if isinstance(entry.published_parsed, struct_time):
                published_at = datetime(
                    *entry.published_parsed[:6], tzinfo=timezone.utc
                )
        elif hasattr(entry, "updated_parsed") and entry.updated_parsed:
            if isinstance(entry.updated_parsed, struct_time):
                published_at = datetime(*entry.updated_parsed[:6], tzinfo=timezone.utc)
        else:
            print("No published_parsed or updated_parsed found")
        new_items.append(
            RSSItem(
                feed=feed,
                title=title,
                link=link,
                description=description,
                published_at=published_at,
                guid=guid,
            )
        )

    # 새로운 아이템들 bulk create
    items_found = len(feed_data.entries)
    items_created = len(new_items)
    
    if new_items:
        RSSItem.objects.bulk_create(new_items)
        feed.last_updated = django_timezone.now()
        feed.save()

    # Task 결과 업데이트
    if task_result:
        from .models import FeedTaskResult
        task_result.status = FeedTaskResult.Status.SUCCESS
        task_result.items_found = items_found
        task_result.items_created = items_created
        task_result.completed_at = django_timezone.now()
        task_result.save(update_fields=["status", "items_found", "items_created", "completed_at"])

    return f"Updated feed {feed.title}: {items_created} new items"


def _update_feed_from_rss_everything(feed, task_result=None):
    """RSSEverythingSource를 사용하여 피드 아이템을 업데이트"""
    from .models import RSSItem, RSSEverythingSource, FeedTaskResult
    from feeds.browser_crawler import fetch_html_with_browser, fetch_html_smart
    from feeds.routers.rss_everything import extract_html_with_css
    from bs4 import BeautifulSoup
    from urllib.parse import urljoin

    source: RSSEverythingSource = feed.rss_everything_source
    logger.info(f"Updating feed from RSSEverything source: {feed.title} ({source.url})")

    try:
        # HTML 가져오기 - custom_headers는 feed에서 가져옴
        if source.use_browser:
            result = fetch_html_with_browser(
                url=source.url,
                selector=source.wait_selector,
                timeout=source.timeout,
                custom_headers=feed.custom_headers,
            )
        else:
            result = fetch_html_smart(
                url=source.url,
                use_browser_on_fail=True,
                browser_selector=source.wait_selector,
                custom_headers=feed.custom_headers,
            )

        if not result.success or not result.html:
            source.last_error = result.error or "Failed to fetch HTML"
            source.save(update_fields=["last_error"])
            return f"Failed to fetch HTML: {source.last_error}"

        soup = BeautifulSoup(result.html, "html.parser")
        
        # exclude_selectors 적용 - 지정된 요소들 제거
        if source.exclude_selectors:
            for exclude_selector in source.exclude_selectors:
                for el in soup.select(exclude_selector):
                    el.decompose()
        
        items = soup.select(source.item_selector)
        items_found = len(items)

        new_items = []
        existing_guids = set(
            RSSItem.objects.filter(feed=feed).values_list("guid", flat=True)
        )

        if source.follow_links:
            # 상세 페이지 파싱 모드
            new_items = _crawl_detail_pages(source, items, existing_guids, soup)
        else:
            # 목록 페이지 직접 파싱 모드
            new_items = _crawl_list_page(source, items, existing_guids)

        items_created = len(new_items)
        
        # 새로운 아이템들 bulk create
        if new_items:
            # feed 설정
            for item in new_items:
                item.feed = feed
            RSSItem.objects.bulk_create(new_items)
            feed.last_updated = django_timezone.now()
            feed.save()

        source.last_crawled_at = django_timezone.now()
        source.last_error = ""
        source.save(update_fields=["last_crawled_at", "last_error"])

        # Task 결과 업데이트
        if task_result:
            task_result.status = FeedTaskResult.Status.SUCCESS
            task_result.items_found = items_found
            task_result.items_created = items_created
            task_result.completed_at = django_timezone.now()
            task_result.save(update_fields=["status", "items_found", "items_created", "completed_at"])

        return (
            f"Updated feed {feed.title} from RSSEverything: {items_created} new items"
        )

    except Exception as e:
        logger.exception(f"Failed to update feed from RSSEverything source {source.id}")
        source.last_error = str(e)
        source.save(update_fields=["last_error"])
        
        # Task 결과 업데이트 (실패)
        if task_result:
            task_result.status = FeedTaskResult.Status.FAILURE
            task_result.error_message = str(e)
            task_result.completed_at = django_timezone.now()
            task_result.save(update_fields=["status", "error_message", "completed_at"])
        
        return f"Failed: {str(e)}"


def _crawl_list_page(source, items, existing_guids):
    """목록 페이지에서 직접 아이템 추출"""
    from .models import RSSItem
    from urllib.parse import urljoin

    new_items = []

    for item in items:
        # 제목 추출
        title = ""
        title_el = (
            item.select_one(source.title_selector) if source.title_selector else None
        )
        if title_el:
            title = title_el.get_text(strip=True)

        # title_selector가 없으면 link_selector에서 제목 추출
        if not title and source.link_selector:
            link_el = item.select_one(source.link_selector)
            if link_el:
                title = link_el.get_text(strip=True)

        if not title:
            continue

        # 링크 추출
        link = ""
        if source.link_selector:
            link_el = item.select_one(source.link_selector)
        else:
            link_el = title_el

        if link_el:
            href = link_el.get("href")
            if not href:
                a_tag = link_el.find("a")
                if a_tag:
                    href = a_tag.get("href")
            if href:
                link = urljoin(source.url, href)

        # GUID 생성
        guid = link if link else f"{source.url}#{title[:100]}"
        if guid in existing_guids:
            continue

        # 설명 추출 (HTML 블록으로)
        description = ""
        if source.description_selector:
            desc_el = item.select_one(source.description_selector)
            if desc_el:
                description = extract_html_block(desc_el, source.url)

        # 날짜 추출
        published_at = django_timezone.now()
        if source.date_selector:
            date_el = item.select_one(source.date_selector)
            if date_el:
                date_text = date_el.get_text(strip=True)
                if date_el.get("datetime"):
                    date_text = date_el.get("datetime")
                parsed_date = parse_date(
                    date_text, source.date_formats if source.date_formats else None
                )
                if parsed_date:
                    published_at = parsed_date

        new_items.append(
            RSSItem(
                title=title[:199],
                link=link,
                description=description,
                published_at=published_at,
                guid=guid[:499],
            )
        )

    return new_items


def _crawl_detail_pages(source, items, existing_guids, list_soup):
    """각 아이템의 상세 페이지를 크롤링하여 아이템 추출"""
    from .models import RSSItem
    from feeds.browser_crawler import fetch_html_with_browser, fetch_html_smart
    from feeds.routers.rss_everything import extract_html_with_css
    from bs4 import BeautifulSoup
    from urllib.parse import urljoin

    new_items = []
    links_to_fetch = []

    # custom_headers는 feed에서 가져옴
    custom_headers = source.feed.custom_headers if hasattr(source, "feed") else {}

    # 먼저 목록에서 링크들을 수집
    for item in items[:20]:  # 최대 20개
        if source.link_selector:
            link_el = item.select_one(source.link_selector)
        else:
            link_el = item.select_one("a[href]")

        if link_el:
            href = link_el.get("href")
            if not href:
                a_tag = link_el.find("a")
                if a_tag:
                    href = a_tag.get("href")

            if href:
                link = urljoin(source.url, href)
                # GUID 체크
                if link in existing_guids:
                    continue

                # 목록에서 기본 정보도 가져옴
                title = ""
                if source.title_selector:
                    title_el = item.select_one(source.title_selector)
                    if title_el:
                        title = title_el.get_text(strip=True)
                if not title:
                    title = link_el.get_text(strip=True)

                links_to_fetch.append({"link": link, "list_title": title})

    # 각 상세 페이지 가져오기
    for item_info in links_to_fetch:
        try:
            if source.use_browser:
                detail_result = fetch_html_with_browser(
                    url=item_info["link"],
                    selector=source.wait_selector,
                    timeout=source.timeout,
                    custom_headers=custom_headers,
                )
            else:
                detail_result = fetch_html_smart(
                    url=item_info["link"],
                    use_browser_on_fail=True,
                    custom_headers=custom_headers,
                )

            if not detail_result.success or not detail_result.html:
                continue

            detail_soup = BeautifulSoup(detail_result.html, "html.parser")
            
            # exclude_selectors 적용 - 지정된 요소들 제거
            if source.exclude_selectors:
                for exclude_selector in source.exclude_selectors:
                    for el in detail_soup.select(exclude_selector):
                        el.decompose()

            # 상세 페이지에서 정보 추출
            title = ""
            if source.detail_title_selector:
                title_el = detail_soup.select_one(source.detail_title_selector)
                title = title_el.get_text(strip=True) if title_el else ""
            if not title:
                title = item_info["list_title"]
            if not title:
                # 최후의 fallback: 페이지의 <title> 태그 사용
                title_tag = detail_soup.find("title")
                title = title_tag.get_text(strip=True) if title_tag else ""

            if not title:
                continue

            # description은 HTML 블록 + CSS로 저장
            description = ""
            if source.detail_description_selector:
                desc_el = detail_soup.select_one(source.detail_description_selector)
                if desc_el:
                    description = extract_html_with_css(
                        desc_el, detail_soup, item_info["link"]
                    )
            elif source.detail_content_selector:
                content_el = detail_soup.select_one(source.detail_content_selector)
                if content_el:
                    description = extract_html_with_css(
                        content_el, detail_soup, item_info["link"]
                    )

            # 날짜 추출
            published_at = django_timezone.now()
            if source.detail_date_selector:
                date_el = detail_soup.select_one(source.detail_date_selector)
                if date_el:
                    date_text = date_el.get_text(strip=True)
                    if date_el.get("datetime"):
                        date_text = date_el.get("datetime")
                    parsed_date = parse_date(
                        date_text, source.date_formats if source.date_formats else None
                    )
                    if parsed_date:
                        published_at = parsed_date

            new_items.append(
                RSSItem(
                    title=title[:199],
                    link=item_info["link"],
                    description=description,
                    published_at=published_at,
                    guid=item_info["link"][:499],
                )
            )
        except Exception as e:
            logger.warning(f"Failed to fetch detail page {item_info['link']}: {e}")
            continue

    return new_items


@shared_task
def update_feeds_by_category(category_id):
    """
    특정 카테고리의 모든 RSS 피드들을 업데이트하는 task
    """
    from .models import RSSFeed

    feeds = RSSFeed.objects.filter(category_id=category_id, visible=True)
    results = []

    for feed in feeds:
        result = update_feed_items.delay(feed.pk)
        results.append(result)

    return f"Scheduled updates for {len(feeds)} feeds in category {category_id}"


@shared_task
def update_all_feeds():
    """
    모든 활성화된 RSS 피드들을 업데이트하는 task
    """
    from .models import RSSFeed

    feeds = RSSFeed.objects.filter(visible=True)
    results = []

    for feed in feeds:
        result = update_feed_items.delay(feed.pk)
        results.append(result)

    return f"Scheduled updates for {len(feeds)} feeds"


@shared_task
def crawl_rss_everything_source(source_id):
    """
    RSSEverything 소스를 크롤링하여 RSS 아이템을 생성하는 task
    이제 update_feed_items을 통해 실행됩니다.
    """
    from .models import RSSEverythingSource

    try:
        source = RSSEverythingSource.objects.select_related("feed").get(id=source_id)
    except RSSEverythingSource.DoesNotExist:
        return f"RSSEverythingSource {source_id} does not exist"

    # 연결된 피드를 통해 업데이트 실행
    return _update_feed_from_rss_everything(source.feed)
