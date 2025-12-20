from logging import getLogger
from time import struct_time
from datetime import datetime, timezone
from base.celery_helper import shared_task
from django.utils import timezone as django_timezone
from feeds.utils.feed_fetcher import fetch_feed_data
from feeds.utils.date_parser import parse_date
from feeds.utils.html_parser import extract_html, extract_src
from feeds.utils.html_utils import strip_html_tags
from feeds.utils.web_scraper import crawl_list_page_items
from urllib.parse import urljoin, urlencode, quote
from feeds.services.source import SourceService
import re
import requests

# Image caching has been removed. The previous cache_image_task is intentionally
# removed so images are fetched directly by clients and rely on browser caching.

logger = getLogger(__name__)


@shared_task(bind=True)
def update_feed_items(self, feed_id, task_result_id=None):
    from .models import RSSFeed, RSSItem, FeedTaskResult, RSSEverythingSource

    """
    특정 RSS 피드의 아이템들을 업데이트하는 task
    피드에 연결된 모든 소스들을 순회하며 아이템을 수집합니다.
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
        feed = RSSFeed.objects.prefetch_related("sources").get(id=feed_id)
        logger.info(f"Updating feed: {feed.title}")
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
        total_found = 0
        total_created = 0
        errors = []

        # 활성화된 모든 소스 처리
        active_sources = feed.sources.filter(is_active=True)

        for source in active_sources:
            try:
                if source.source_type == RSSEverythingSource.SourceType.RSS:
                    found, created = _update_from_rss_source(feed, source)
                else:
                    found, created = _update_from_scraping_source(feed, source)

                total_found += found
                total_created += created
            except Exception as e:
                logger.exception(f"Failed to update from source {source.id}")
                errors.append(f"Source {source.id}: {str(e)}")
                source.last_error = str(e)
                source.save(update_fields=["last_error"])

        # Task 결과 업데이트
        if errors:
            task_result.status = FeedTaskResult.Status.SUCCESS  # 일부 성공
            task_result.error_message = "; ".join(errors)
        else:
            task_result.status = FeedTaskResult.Status.SUCCESS

        task_result.items_found = total_found
        task_result.items_created = total_created
        task_result.completed_at = django_timezone.now()
        task_result.save(
            update_fields=[
                "status",
                "items_found",
                "items_created",
                "error_message",
                "completed_at",
            ]
        )

        return f"Updated feed {feed.title}: {total_created} new items from {len(active_sources)} sources"

    except Exception as e:
        logger.exception(f"Failed to update feed {feed_id}")
        task_result.status = FeedTaskResult.Status.FAILURE
        task_result.error_message = str(e)
        task_result.completed_at = django_timezone.now()
        task_result.save(update_fields=["status", "error_message", "completed_at"])
        return f"Failed: {str(e)}"


def _update_from_rss_source(feed, source):
    """RSS 소스에서 아이템을 업데이트"""
    from .models import RSSItem
    from feedparser import FeedParserDict

    feed_data = fetch_feed_data(source.url, source.custom_headers)

    if feed_data.bozo:
        raise Exception(
            f"Failed to parse feed {source.url}: {feed_data.bozo_exception}"
        )

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

        # 작성자 추출
        author = ""
        if hasattr(entry, "author"):
            author = str(entry.author)[:255] if entry.author else ""
        elif hasattr(entry, "author_detail") and entry.author_detail:
            author = str(getattr(entry.author_detail, "name", ""))[:255]

        # 카테고리 추출
        categories = []
        if hasattr(entry, "tags") and entry.tags:
            for tag in entry.tags:
                term = getattr(tag, "term", None) or getattr(tag, "label", None)
                if term:
                    categories.append(str(term))

        # 이미지 추출 (RSS 피드에서)
        image = ""
        if hasattr(entry, "enclosures") and entry.enclosures:
            for enclosure in entry.enclosures:
                if (
                    hasattr(enclosure, "type")
                    and enclosure.type
                    and "image" in enclosure.type
                ):
                    image = getattr(enclosure, "href", "")
                    break

        # RSS 피드에 이미지가 없으면 description에서 첫 번째 img 태그 찾기
        if not image and description and isinstance(description, str):
            from bs4 import BeautifulSoup

            desc_soup = BeautifulSoup(description, "html.parser")
            img_tag = desc_soup.find("img")
            if img_tag and img_tag.get("src"):
                image = img_tag.get("src")

        new_items.append(
            RSSItem(
                feed=feed,
                source=source,
                title=title,
                link=link,
                description=description,
                description_text=strip_html_tags(description),
                author=author,
                categories=categories,
                image=image,
                published_at=published_at,
                guid=guid,
            )
        )

    # 새로운 아이템들 bulk create
    items_found = len(feed_data.entries)
    items_created = len(new_items)

    if new_items:
        created_items = RSSItem.objects.bulk_create(new_items)
        feed.last_updated = django_timezone.now()
        feed.save()

        # 새로 생성된 아이템들의 이미지 프리캐시 트리거
        item_ids = [item.id for item in created_items if item.id]
        if item_ids:
            precache_images_for_items.delay(item_ids)

    # 소스 업데이트
    source.last_crawled_at = django_timezone.now()
    source.last_error = ""
    source.save(update_fields=["last_crawled_at", "last_error"])

    return items_found, items_created


def _update_from_scraping_source(feed, source):
    """스크래핑 소스에서 아이템을 업데이트 (PAGE_SCRAPING, DETAIL_PAGE_SCRAPING)"""
    from .models import RSSItem, RSSEverythingSource
    from feeds.browser_crawler import fetch_html_with_browser, fetch_html_smart
    from bs4 import BeautifulSoup
    from urllib.parse import urljoin

    logger.info(f"Updating feed from scraping source: {feed.title} ({source.url})")

    # HTML 가져오기
    if source.use_browser:
        result = fetch_html_with_browser(
            url=source.url,
            selector=source.wait_selector,
            timeout=source.timeout,
            custom_headers=source.custom_headers,
            service=source.browser_service or "realbrowser",
        )
    else:
        result = fetch_html_smart(
            url=source.url,
            use_browser_on_fail=True,
            browser_selector=source.wait_selector,
            custom_headers=source.custom_headers,
            browser_service=source.browser_service or "realbrowser",
        )

    if not result.success or not result.html:
        raise Exception(result.error or "Failed to fetch HTML")

    soup = BeautifulSoup(result.html, "html.parser")

    # exclude_selectors 적용 - 지정된 요소들 제거
    if source.exclude_selectors:
        for exclude_selector in source.exclude_selectors:
            for el in soup.select(exclude_selector):
                el.decompose()

    items = soup.select(source.item_selector)
    items_found = len(items)

    existing_guids = set(
        RSSItem.objects.filter(feed=feed).values_list("guid", flat=True)
    )

    if source.source_type == RSSEverythingSource.SourceType.DETAIL_PAGE_SCRAPING:
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
        created_items = RSSItem.objects.bulk_create(new_items)
        feed.last_updated = django_timezone.now()
        feed.save()

        # 새로 생성된 아이템들의 이미지 프리캐시 트리거
        item_ids = [item.id for item in created_items if item.id]
        if item_ids:
            precache_images_for_items.delay(item_ids)

    source.last_crawled_at = django_timezone.now()
    source.last_error = ""
    source.save(update_fields=["last_crawled_at", "last_error"])

    return items_found, items_created


def _crawl_list_page(source, items, existing_guids):
    """목록 페이지에서 직접 아이템 추출"""
    from .models import RSSItem
    from feeds.utils.date_parser import parse_date

    # web_scraper 모듈 사용
    crawled_items = crawl_list_page_items(
        items=items,
        base_url=source.url,
        title_selector=source.title_selector,
        link_selector=source.link_selector,
        description_selector=source.description_selector,
        date_selector=source.date_selector,
        image_selector=source.image_selector,
        author_selector=(
            source.author_selector if hasattr(source, "author_selector") else ""
        ),
        categories_selector=(
            source.categories_selector if hasattr(source, "categories_selector") else ""
        ),
        existing_guids=existing_guids,
        max_items=50,  # 기본값 사용
    )

    # 결과 변환: 딕셔너리 → RSSItem 객체
    new_items = []
    for item in crawled_items:
        # 날짜 파싱
        published_at = django_timezone.now()
        if item["date"] and source.date_formats:
            parsed_date = parse_date(item["date"], source.date_formats)
            if parsed_date:
                published_at = parsed_date

        # RSSItem 객체 생성
        new_items.append(
            RSSItem(
                source=source,
                title=item["title"][:199],
                link=item["link"],
                description=item["description"],
                description_text=strip_html_tags(item["description"]),
                published_at=published_at,
                guid=item["guid"][:499],
                author=item["author"],
                categories=item["categories"],
                image=item["image"],
            )
        )

    return new_items


def _crawl_detail_pages(source, items, existing_guids, list_soup):
    """각 아이템의 상세 페이지를 크롤링하여 아이템 추출"""
    from .models import RSSItem
    from feeds.services.source import SourceService
    from feeds.utils.date_parser import parse_date

    # 공통 함수 사용
    crawled_items = SourceService.crawl_detail_page_items(
        items=items,
        base_url=source.url,
        item_selector=source.item_selector,
        title_selector=source.title_selector,
        link_selector=source.link_selector,
        description_selector=source.description_selector,
        date_selector=source.date_selector,
        image_selector=source.image_selector,
        detail_title_selector=source.detail_title_selector,
        detail_description_selector=source.detail_description_selector,
        detail_content_selector=source.detail_content_selector,
        detail_date_selector=source.detail_date_selector,
        detail_image_selector=source.detail_image_selector,
        use_browser=source.use_browser,
        browser_service=source.browser_service or "realbrowser",
        wait_selector=source.wait_selector,
        custom_headers=source.custom_headers,
        exclude_selectors=source.exclude_selectors,
        follow_links=True,
        existing_guids=existing_guids,
        max_items=20,
        use_html_with_css=True,
    )

    # 결과 변환: 딕셔너리 → RSSItem 객체
    new_items = []
    for item in crawled_items:
        # 날짜 파싱
        published_at = django_timezone.now()
        if item["date"] and source.date_formats:
            parsed_date = parse_date(item["date"], source.date_formats)
            if parsed_date:
                published_at = parsed_date

        # 작성자 및 카테고리 추출 (공통 함수에서는 지원하지 않음)
        author = ""
        categories = []

        # RSSItem 객체 생성
        new_items.append(
            RSSItem(
                source=source,
                title=item["title"][:199],
                link=item["link"],
                description=item["description"],
                description_text=strip_html_tags(item["description"]),
                published_at=published_at,
                guid=item["link"][:499],
                author=author,
                categories=categories,
                image=item["image"],
            )
        )

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
    return update_feed_items.delay(source.feed.id)


@shared_task
def precache_images_for_item(item_id: int):
    """
    RSSItem의 description에서 이미지 URL을 추출하여
    Next.js 이미지 최적화 엔드포인트로 요청해서 캐시 워밍
    """
    from .models import RSSItem
    from bs4 import BeautifulSoup
    import os

    try:
        item = RSSItem.objects.get(id=item_id)
    except RSSItem.DoesNotExist:
        return f"RSSItem {item_id} does not exist"

    description = item.description
    if not description:
        return f"RSSItem {item_id} has no description"

    # HTML에서 이미지 URL 추출
    soup = BeautifulSoup(description, "html.parser")
    img_tags = soup.find_all("img")

    if not img_tags:
        return f"No images found in RSSItem {item_id}"

    # Next.js 서버 URL (Docker 내부 네트워크)
    nextjs_host = os.environ.get("NEXTJS_HOST", "node")
    nextjs_port = os.environ.get("NEXTJS_PORT", "3000")
    nextjs_base_url = f"http://{nextjs_host}:{nextjs_port}"

    # 캐시할 이미지 사이즈들 (Next.js deviceSizes 기본값 기준)
    widths = [640, 750, 828, 1080, 1200]
    quality = 75

    cached_count = 0
    errors = []

    for img in img_tags:
        src = img.get("src")
        if not src:
            continue

        # 상대 URL이면 스킵 (외부 이미지만 캐시)
        if not src.startswith(("http://", "https://")):
            continue

        # data: URL 스킵
        if src.startswith("data:"):
            continue

        for width in widths:
            try:
                # Next.js 이미지 최적화 URL 생성
                params = urlencode(
                    {
                        "url": src,
                        "w": width,
                        "q": quality,
                    }
                )
                cache_url = f"{nextjs_base_url}/_next/image?{params}"

                # 요청 (타임아웃 30초)
                response = requests.get(
                    cache_url,
                    timeout=30,
                    headers={
                        "User-Agent": "DRSS-ImagePrecacher/1.0",
                        "Accept": "image/webp,image/avif,image/*,*/*;q=0.8",
                    },
                )

                if response.status_code == 200:
                    cached_count += 1
                    logger.debug(f"Cached: {src} (w={width})")
                else:
                    logger.warning(
                        f"Failed to cache {src} (w={width}): {response.status_code}"
                    )

            except requests.RequestException as e:
                error_msg = f"Failed to cache {src}: {str(e)}"
                logger.warning(error_msg)
                errors.append(error_msg)
                # 하나의 이미지가 실패하면 다른 사이즈도 스킵
                break

    result = f"Cached {cached_count} images for RSSItem {item_id}"
    if errors:
        result += f" (errors: {len(errors)})"

    return result


@shared_task
def precache_images_for_items(item_ids: list[int]):
    """
    여러 RSSItem의 이미지를 일괄 프리캐시
    개별 아이템은 image_worker 큐에 분배
    """
    for item_id in item_ids:
        # 개별 이미지 캐시 작업을 worker 큐에 분배
        precache_images_for_item.delay(item_id)
    return f"Dispatched {len(item_ids)} image precache tasks to worker queue"
