from logging import getLogger
from time import struct_time
from datetime import datetime, timezone
from base.celery_helper import shared_task
from celery import chord, group
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
import os

logger = getLogger(__name__)

# MinIO 이미지 업로드 활성화 여부 (환경변수로 제어)
ENABLE_IMAGE_UPLOAD = os.getenv("ENABLE_IMAGE_UPLOAD", "True") == "True"


# ===========================================
# 큐 1: feed_main - 메인 URL 크롤링 및 디테일 분배
# ===========================================


@shared_task(bind=True)
def update_feed_items(self, feed_id, task_result_id=None):
    """
    특정 RSS 피드의 아이템들을 업데이트하는 task (큐 1: feed_main)
    메인 URL을 크롤링하고, 디테일 URL들을 큐2로 분배한 뒤 chord로 기다림
    """
    from .models import RSSFeed, RSSItem, FeedTaskResult, RSSEverythingSource

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
                    # RSS는 동기 처리 (디테일 페이지 없음)
                    found, created = _update_from_rss_source(feed, source)
                elif source.source_type == RSSEverythingSource.SourceType.DETAIL_PAGE_SCRAPING:
                    # 디테일 페이지 스크래핑: chord로 병렬 처리 후 기다림
                    found, created = _update_from_detail_scraping_source_async(feed, source)
                else:
                    # 목록 페이지 스크래핑: 동기 처리
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
    """RSS 소스에서 아이템을 업데이트 (디테일 페이지 없음, 동기 처리)"""
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

        # 새로 생성된 아이템들의 이미지 프리캐시 트리거 (큐 3으로)
        item_ids = [item.id for item in created_items if item.id]
        if item_ids:
            for item_id in item_ids:
                precache_images_for_item.delay(item_id)

    # 소스 업데이트
    source.last_crawled_at = django_timezone.now()
    source.last_error = ""
    source.save(update_fields=["last_crawled_at", "last_error"])

    return items_found, items_created


def _update_from_scraping_source(feed, source):
    """목록 페이지 스크래핑 (PAGE_SCRAPING) - 동기 처리"""
    from .models import RSSItem, RSSEverythingSource
    from feeds.browser_crawler import fetch_html_with_browser, fetch_html_smart
    from bs4 import BeautifulSoup

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

    # 목록 페이지 직접 파싱 모드
    new_items = _crawl_list_page(source, items, existing_guids)
    items_created = len(new_items)

    # 새로운 아이템들 bulk create
    if new_items:
        for item in new_items:
            item.feed = feed
        created_items = RSSItem.objects.bulk_create(new_items)
        feed.last_updated = django_timezone.now()
        feed.save()

        # 이미지 캐시 (큐 3으로)
        item_ids = [item.id for item in created_items if item.id]
        if item_ids:
            for item_id in item_ids:
                precache_images_for_item.delay(item_id)

    source.last_crawled_at = django_timezone.now()
    source.last_error = ""
    source.save(update_fields=["last_crawled_at", "last_error"])

    return items_found, items_created


def _update_from_detail_scraping_source_async(feed, source):
    """
    디테일 페이지 스크래핑 - chord로 병렬 처리 후 기다림 (큐 1 → 큐 2)
    메인 페이지에서 디테일 URL들을 추출하고 큐2로 분배
    """
    from .models import RSSItem
    from feeds.browser_crawler import fetch_html_with_browser, fetch_html_smart
    from bs4 import BeautifulSoup

    logger.info(f"Updating feed from detail scraping source (async): {feed.title} ({source.url})")

    # 메인 페이지 HTML 가져오기
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

    # exclude_selectors 적용
    if source.exclude_selectors:
        for exclude_selector in source.exclude_selectors:
            for el in soup.select(exclude_selector):
                el.decompose()

    items = soup.select(source.item_selector)
    items_found = len(items)

    existing_guids = set(
        RSSItem.objects.filter(feed=feed).values_list("guid", flat=True)
    )

    # 디테일 URL들 추출
    detail_tasks_data = []
    for item in items[:30]:  # max 20 items
        link = None
        if source.link_selector:
            link_el = item.select_one(source.link_selector)
            if link_el:
                link = link_el.get("href")
        else:
            link_el = item.select_one("a")
            if link_el:
                link = link_el.get("href")

        if not link:
            continue

        # 상대 URL을 절대 URL로 변환
        link = urljoin(source.url, link)

        # 이미 존재하는 아이템이면 스킵 (guid = link)
        if link[:499] in existing_guids:
            continue

        # 목록 페이지에서 추출 가능한 정보
        list_data = {
            "title": "",
            "date": "",
            "image": "",
        }

        if source.title_selector:
            title_el = item.select_one(source.title_selector)
            if title_el:
                list_data["title"] = title_el.get_text(strip=True)[:199]

        if source.date_selector:
            date_el = item.select_one(source.date_selector)
            if date_el:
                list_data["date"] = date_el.get_text(strip=True)

        if source.image_selector:
            img_el = item.select_one(source.image_selector)
            if img_el:
                list_data["image"] = img_el.get("src") or img_el.get("data-src") or ""
                if list_data["image"]:
                    list_data["image"] = urljoin(source.url, list_data["image"])

        detail_tasks_data.append({
            "detail_url": link,
            "list_data": list_data,
        })

    if not detail_tasks_data:
        logger.info(f"No new detail pages to crawl for {feed.title}")
        source.last_crawled_at = django_timezone.now()
        source.last_error = ""
        source.save(update_fields=["last_crawled_at", "last_error"])
        return items_found, 0

    # chord로 디테일 페이지 크롤링 태스크 분배 후 기다림
    detail_tasks = group([
        crawl_detail_page.s(
            feed_id=feed.id,
            source_id=source.id,
            detail_url=task_data["detail_url"],
            list_data=task_data["list_data"],
        )
        for task_data in detail_tasks_data
    ])

    # chord로 실행하고 결과 수집
    callback = collect_detail_results.s(feed_id=feed.id, source_id=source.id)
    result = chord(detail_tasks)(callback)

    # chord 결과 기다림
    try:
        items_created = result.get(timeout=300)  # 5분 타임아웃
    except Exception as e:
        logger.exception(f"Chord failed for source {source.id}")
        items_created = 0

    return items_found, items_created


def _crawl_list_page(source, items, existing_guids):
    """목록 페이지에서 직접 아이템 추출"""
    from .models import RSSItem

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
        max_items=50,
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


# ===========================================
# 큐 2: detail_worker - 개별 디테일 페이지 크롤링
# ===========================================


@shared_task
def crawl_detail_page(feed_id: int, source_id: int, detail_url: str, list_data: dict):
    """
    개별 디테일 페이지를 크롤링하여 RSSItem 생성 (큐 2: detail_worker)
    완료 후 이미지 캐시 요청을 큐3으로 보냄 (기다리지 않음)
    """
    from .models import RSSFeed, RSSItem, RSSEverythingSource
    from feeds.browser_crawler import fetch_html_with_browser, fetch_html_smart
    from bs4 import BeautifulSoup

    try:
        source = RSSEverythingSource.objects.get(id=source_id)
        feed = RSSFeed.objects.get(id=feed_id)
    except (RSSEverythingSource.DoesNotExist, RSSFeed.DoesNotExist) as e:
        return {"success": False, "error": str(e)}

    try:
        # 디테일 페이지 HTML 가져오기
        if source.use_browser:
            result = fetch_html_with_browser(
                url=detail_url,
                selector=source.wait_selector,
                timeout=source.timeout,
                custom_headers=source.custom_headers,
                service=source.browser_service or "realbrowser",
            )
        else:
            result = fetch_html_smart(
                url=detail_url,
                use_browser_on_fail=True,
                browser_selector=source.wait_selector,
                custom_headers=source.custom_headers,
                browser_service=source.browser_service or "realbrowser",
            )

        if not result.success or not result.html:
            return {"success": False, "error": result.error or "Failed to fetch HTML"}

        soup = BeautifulSoup(result.html, "html.parser")

        # exclude_selectors 적용
        if source.exclude_selectors:
            for exclude_selector in source.exclude_selectors:
                for el in soup.select(exclude_selector):
                    el.decompose()

        # 디테일 페이지에서 정보 추출
        title = list_data.get("title", "")
        if source.detail_title_selector:
            title_el = soup.select_one(source.detail_title_selector)
            if title_el:
                title = title_el.get_text(strip=True)[:199]

        description = ""
        if source.detail_content_selector:
            content_el = soup.select_one(source.detail_content_selector)
            if content_el:
                description = str(content_el)
        elif source.detail_description_selector:
            desc_el = soup.select_one(source.detail_description_selector)
            if desc_el:
                description = str(desc_el)

        date_str = list_data.get("date", "")
        if source.detail_date_selector:
            date_el = soup.select_one(source.detail_date_selector)
            if date_el:
                date_str = date_el.get_text(strip=True)

        image = list_data.get("image", "")
        if source.detail_image_selector:
            img_el = soup.select_one(source.detail_image_selector)
            if img_el:
                image = img_el.get("src") or img_el.get("data-src") or ""
                if image:
                    image = urljoin(detail_url, image)

        # 이미지가 없으면 description에서 추출
        if not image and description:
            desc_soup = BeautifulSoup(description, "html.parser")
            img_tag = desc_soup.find("img")
            if img_tag and img_tag.get("src"):
                image = urljoin(detail_url, img_tag.get("src"))

        # 날짜 파싱
        published_at = django_timezone.now()
        if date_str and source.date_formats:
            parsed_date = parse_date(date_str, source.date_formats)
            if parsed_date:
                published_at = parsed_date

        # RSSItem 생성
        item = RSSItem.objects.create(
            feed=feed,
            source=source,
            title=title or "No Title",
            link=detail_url,
            description=description,
            description_text=strip_html_tags(description),
            published_at=published_at,
            guid=detail_url[:499],
            author="",
            categories=[],
            image=image,
        )

        # 이미지 캐시 요청 (큐 3으로, 기다리지 않음)
        if item.id:
            precache_images_for_item.delay(item.id)

        return {"success": True, "item_id": item.id}

    except Exception as e:
        logger.exception(f"Failed to crawl detail page: {detail_url}")
        return {"success": False, "error": str(e)}


@shared_task
def collect_detail_results(results: list, feed_id: int, source_id: int):
    """
    chord callback: 디테일 크롤링 결과 수집 (큐 2에서 실행)
    """
    from .models import RSSFeed, RSSEverythingSource

    try:
        feed = RSSFeed.objects.get(id=feed_id)
        source = RSSEverythingSource.objects.get(id=source_id)
    except (RSSFeed.DoesNotExist, RSSEverythingSource.DoesNotExist):
        return 0

    success_count = sum(1 for r in results if r.get("success"))
    error_count = len(results) - success_count

    if success_count > 0:
        feed.last_updated = django_timezone.now()
        feed.save()

    source.last_crawled_at = django_timezone.now()
    if error_count > 0:
        source.last_error = f"{error_count} detail pages failed"
    else:
        source.last_error = ""
    source.save(update_fields=["last_crawled_at", "last_error"])

    logger.info(f"Detail crawling completed for {feed.title}: {success_count} success, {error_count} errors")

    return success_count


# ===========================================
# 큐 3: image_aggregate - 이미지 URL 추출 및 분배
# ===========================================


@shared_task
def precache_images_for_item(item_id: int):
    """
    RSSItem의 description에서 이미지 URL을 추출하여
    사이즈별 캐시 요청을 큐4로 분배 (큐 3: image_aggregate)

    ENABLE_IMAGE_UPLOAD=True이면 이미지를 MinIO에 업로드하고 URL을 교체
    """
    from .models import RSSItem
    from bs4 import BeautifulSoup

    try:
        item = RSSItem.objects.get(id=item_id)
    except RSSItem.DoesNotExist:
        return f"RSSItem {item_id} does not exist"

    description = item.description
    if not description:
        return f"RSSItem {item_id} has no description"

    # MinIO 이미지 업로드가 활성화되어 있으면 먼저 업로드 후 URL 교체
    upload_images_for_item.delay(item_id)
    return f"Scheduled image upload for RSSItem {item_id}"

# ===========================================
# 큐 5: image_upload - MinIO 이미지 업로드
# ===========================================


@shared_task
def upload_images_for_item(item_id: int):
    """
    RSSItem의 description HTML 내 이미지를 MinIO에 스트리밍 업로드하고
    이미지 URL을 /images/xxx 형태로 교체 (큐 5: image_upload)

    이 Task는 비동기로 실행되며, description을 직접 수정합니다.
    """
    from .models import RSSItem
    from feeds.services.image_storage import get_image_storage_service

    try:
        item = RSSItem.objects.get(id=item_id)
    except RSSItem.DoesNotExist:
        return f"RSSItem {item_id} does not exist"

    description = item.description
    if not description:
        return f"RSSItem {item_id} has no description"

    # HTML인지 확인 (기본적인 태그 체크)
    if "<" not in description or ">" not in description:
        return f"RSSItem {item_id} description is not HTML"

    try:
        storage_service = get_image_storage_service()

        # 이미지 업로드 및 HTML 내 URL 교체
        new_description, replaced_count = storage_service.upload_images_and_replace_html(
            description, base_url=item.link
        )

        if replaced_count > 0:
            # description 업데이트
            item.description = new_description
            item.save(update_fields=["description"])

            # 대표 이미지도 업로드 (별도 필드)
            if item.image and item.image.startswith(("http://", "https://")):
                new_image_path = storage_service.upload_image_from_url(
                    item.image, base_url=item.link
                )
                if new_image_path:
                    item.image = new_image_path
                    item.save(update_fields=["image"])

            logger.info(f"Uploaded {replaced_count} images for RSSItem {item_id}")
            return f"Uploaded {replaced_count} images for RSSItem {item_id}"

        return f"No images to upload for RSSItem {item_id}"

    except Exception as e:
        logger.exception(f"Failed to upload images for RSSItem {item_id}: {e}")
        return f"Failed: {str(e)}"


@shared_task
def upload_single_image(image_url: str, item_id: int, field: str = "description"):
    """
    단일 이미지를 MinIO에 업로드하는 Task (큐 5: image_upload)

    Args:
        image_url: 원본 이미지 URL
        item_id: RSSItem ID
        field: 업데이트할 필드 (description 또는 image)
    """
    from .models import RSSItem
    from feeds.services.image_storage import get_image_storage_service

    try:
        item = RSSItem.objects.get(id=item_id)
    except RSSItem.DoesNotExist:
        return {"success": False, "error": f"RSSItem {item_id} does not exist"}

    try:
        storage_service = get_image_storage_service()
        new_path = storage_service.upload_image_from_url(image_url, base_url=item.link)

        if new_path:
            if field == "image":
                item.image = new_path
                item.save(update_fields=["image"])

            return {"success": True, "original_url": image_url, "new_path": new_path}

        return {"success": False, "error": "Failed to upload image"}

    except Exception as e:
        logger.exception(f"Failed to upload image {image_url}: {e}")
        return {"success": False, "error": str(e)}



# ===========================================
# 스케줄러 태스크들
# ===========================================


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
