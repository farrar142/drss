"""
Celery Tasks - 피드 업데이트 및 이미지 처리 태스크
리팩토링: CrawlerService를 사용하여 중복 로직 제거
"""

from logging import getLogger
import os
from base.celery_helper import shared_task
from celery import chord, group
from django.utils import timezone as django_timezone

logger = getLogger(__name__)

# MinIO 이미지 업로드 활성화 여부
ENABLE_IMAGE_UPLOAD = os.getenv("ENABLE_IMAGE_UPLOAD", "True") == "True"


# ===========================================
# 헬퍼 함수
# ===========================================


def _save_items_and_schedule_images(feed, new_items: list) -> int:
    """
    아이템들을 저장하고 이미지 캐시 태스크를 스케줄링

    Returns:
        생성된 아이템 수
    """
    from feeds.models import RSSItem

    if not new_items:
        return 0

    created_items = RSSItem.objects.bulk_create(new_items)
    feed.last_updated = django_timezone.now()
    feed.save()

    # 이미지 캐시 스케줄링
    for item in created_items:
        if item.id:
            precache_images_for_item.delay(item.id)

    return len(created_items)


def _update_source_status(source, error: str = ""):
    """소스 상태 업데이트"""
    source.last_crawled_at = django_timezone.now()
    source.last_error = error
    source.save(update_fields=["last_crawled_at", "last_error"])


def _get_or_create_task_result(task, feed, task_result_id=None):
    """Task 결과 레코드 가져오거나 생성"""
    from feeds.models import FeedTaskResult

    task_result = None
    if task_result_id:
        try:
            task_result = FeedTaskResult.objects.get(id=task_result_id)
            task_result.status = FeedTaskResult.Status.RUNNING
            task_result.task_id = task.request.id or ""
            task_result.started_at = django_timezone.now()
            task_result.save(update_fields=["status", "task_id", "started_at"])
        except FeedTaskResult.DoesNotExist:
            pass

    if not task_result:
        task_result = FeedTaskResult.objects.create(
            feed=feed,
            task_id=task.request.id or "",
            status=FeedTaskResult.Status.RUNNING,
            started_at=django_timezone.now(),
        )

    return task_result


def _complete_task_result(task_result, items_found: int, items_created: int, errors: list = None):
    """Task 결과 완료 처리"""
    from feeds.models import FeedTaskResult

    if errors:
        task_result.status = FeedTaskResult.Status.SUCCESS
        task_result.error_message = "; ".join(errors[:10])
    else:
        task_result.status = FeedTaskResult.Status.SUCCESS

    task_result.items_found = items_found
    task_result.items_created = items_created
    task_result.completed_at = django_timezone.now()
    task_result.save(
        update_fields=["status", "items_found", "items_created", "error_message", "completed_at"]
    )


def _fail_task_result(task_result, error: str):
    """Task 결과 실패 처리"""
    from feeds.models import FeedTaskResult

    if task_result:
        task_result.status = FeedTaskResult.Status.FAILURE
        task_result.error_message = error
        task_result.completed_at = django_timezone.now()
        task_result.save(update_fields=["status", "error_message", "completed_at"])


# ===========================================
# 큐 1: feed_main - 메인 피드 업데이트
# ===========================================


@shared_task(bind=True)
def update_feed_items(self, feed_id, task_result_id=None):
    """
    특정 RSS 피드의 아이템들을 업데이트하는 task
    """
    from feeds.models import RSSFeed, RSSItem, FeedTaskResult, RSSEverythingSource
    from feeds.services.crawler import CrawlerService

    # 피드 가져오기
    try:
        feed = RSSFeed.objects.prefetch_related("sources").get(id=feed_id)
        logger.info(f"Updating feed: {feed.title}")
    except RSSFeed.DoesNotExist:
        if task_result_id:
            try:
                task_result = FeedTaskResult.objects.get(id=task_result_id)
                _fail_task_result(task_result, f"Feed {feed_id} does not exist")
            except FeedTaskResult.DoesNotExist:
                pass
        return f"Feed {feed_id} does not exist"

    # Task 결과 레코드
    task_result = _get_or_create_task_result(self, feed, task_result_id)

    try:
        total_found = 0
        total_created = 0
        errors = []

        # 활성화된 소스 처리
        active_sources = feed.sources.filter(is_active=True)
        existing_guids = set(RSSItem.objects.filter(feed=feed).values_list("guid", flat=True))

        for source in active_sources:
            try:
                if source.source_type == RSSEverythingSource.SourceType.DETAIL_PAGE_SCRAPING:
                    # 상세 페이지 스크래핑: chord로 비동기 처리
                    found, created = _update_from_detail_source_async(feed, source, existing_guids)
                else:
                    # RSS 또는 페이지 스크래핑: CrawlerService 사용
                    found, new_items = CrawlerService.crawl_source(feed, source, existing_guids)
                    created = _save_items_and_schedule_images(feed, new_items)

                    # existing_guids 업데이트
                    for item in new_items:
                        existing_guids.add(item.guid)

                    _update_source_status(source)

                total_found += found
                total_created += created

            except Exception as e:
                logger.exception(f"Failed to update from source {source.id}")
                errors.append(f"Source {source.id}: {str(e)}")
                _update_source_status(source, str(e))

        _complete_task_result(task_result, total_found, total_created, errors if errors else None)
        return f"Updated feed {feed.title}: {total_created} new items"

    except Exception as e:
        logger.exception(f"Failed to update feed {feed_id}")
        _fail_task_result(task_result, str(e))
        return f"Failed: {str(e)}"


def _update_from_detail_source_async(feed, source, existing_guids):
    """
    상세 페이지 스크래핑 - chord로 병렬 처리
    """
    from feeds.services.crawler import CrawlerService

    logger.info(f"Updating from detail source (async): {feed.title} ({source.url})")

    # 상세 URL 추출
    detail_tasks_data = CrawlerService.extract_detail_urls(source, existing_guids, max_items=30)

    if not detail_tasks_data:
        logger.info(f"No new detail pages for {feed.title}")
        _update_source_status(source)
        return 0, 0

    # chord로 병렬 처리
    detail_tasks = group([
        crawl_detail_page.s(
            feed_id=feed.id,
            source_id=source.id,
            detail_url=data["detail_url"],
            list_data=data["list_data"],
        )
        for data in detail_tasks_data
    ])

    callback = collect_detail_results.s(feed_id=feed.id, source_id=source.id)
    result = chord(detail_tasks)(callback)

    try:
        items_created = result.get(timeout=300)
    except Exception as e:
        logger.exception(f"Chord failed for source {source.id}")
        items_created = 0

    return len(detail_tasks_data), items_created


# ===========================================
# 큐 2: detail_worker - 상세 페이지 크롤링
# ===========================================


@shared_task
def crawl_detail_page(feed_id: int, source_id: int, detail_url: str, list_data: dict):
    """개별 상세 페이지 크롤링"""
    from feeds.models import RSSFeed, RSSItem, RSSEverythingSource
    from feeds.services.crawler import CrawlerService

    try:
        source = RSSEverythingSource.objects.get(id=source_id)
        feed = RSSFeed.objects.get(id=feed_id)
    except (RSSEverythingSource.DoesNotExist, RSSFeed.DoesNotExist) as e:
        return {"success": False, "error": str(e)}

    try:
        item = CrawlerService.crawl_detail_page(feed, source, detail_url, list_data)
        item.save()

        # 이미지 캐시
        if item.id:
            precache_images_for_item.delay(item.id)

        return {"success": True, "item_id": item.id}

    except Exception as e:
        logger.exception(f"Failed to crawl detail page: {detail_url}")
        return {"success": False, "error": str(e)}


@shared_task
def collect_detail_results(results: list, feed_id: int, source_id: int):
    """chord callback: 상세 크롤링 결과 수집"""
    from feeds.models import RSSFeed, RSSEverythingSource

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

    error_msg = f"{error_count} detail pages failed" if error_count > 0 else ""
    _update_source_status(source, error_msg)

    logger.info(f"Detail crawling: {feed.title} - {success_count} success, {error_count} errors")
    return success_count


# ===========================================
# 페이지네이션 크롤링 Task
# ===========================================


@shared_task(bind=True)
def crawl_paginated_task(
    self,
    source_id: int,
    url_template: str,
    variables: list,
    delay_ms: int = 1000,
    task_result_id: int = None,
):
    """
    페이지네이션 크롤링 - 소스 타입에 따라 적절한 방식으로 처리
    """
    import time
    from feeds.models import RSSItem, RSSEverythingSource, FeedTaskResult
    from feeds.services.crawler import CrawlerService

    # 소스 가져오기
    try:
        source = RSSEverythingSource.objects.select_related("feed").get(id=source_id)
        feed = source.feed
    except RSSEverythingSource.DoesNotExist:
        error_msg = f"RSSEverythingSource {source_id} does not exist"
        if task_result_id:
            try:
                task_result = FeedTaskResult.objects.get(id=task_result_id)
                _fail_task_result(task_result, error_msg)
            except FeedTaskResult.DoesNotExist:
                pass
        return {"success": False, "error": error_msg}

    # Task 결과
    task_result = _get_or_create_task_result(self, feed, task_result_id)

    try:
        # 소스 타입 확인
        if source.source_type == RSSEverythingSource.SourceType.RSS:
            _fail_task_result(task_result, "RSS source does not support pagination crawling")
            return {"success": False, "error": "RSS source does not support pagination crawling"}

        # URL 목록 생성
        urls = CrawlerService.generate_pagination_urls(url_template, variables)
        total_pages = len(urls)
        total_items_found = 0
        total_items_created = 0
        errors = []

        # 기존 GUID
        existing_guids = set(RSSItem.objects.filter(feed=feed).values_list("guid", flat=True))

        logger.info(f"Starting pagination crawl for source {source_id}: {total_pages} pages, type={source.source_type}")

        for i, url in enumerate(urls):
            try:
                logger.info(f"Crawling page {i + 1}/{total_pages}: {url}")

                if source.source_type == RSSEverythingSource.SourceType.PAGE_SCRAPING:
                    # 페이지 스크래핑
                    found, new_items = CrawlerService.crawl_page_scraping_source(
                        feed, source, existing_guids, url=url, use_cache=False
                    )
                    total_items_found += found

                    # GUID 업데이트
                    for item in new_items:
                        existing_guids.add(item.guid)

                    # 저장
                    created = _save_items_and_schedule_images(feed, new_items)
                    total_items_created += created
                    logger.info(f"Page {i + 1}: created {created} items")

                elif source.source_type == RSSEverythingSource.SourceType.DETAIL_PAGE_SCRAPING:
                    # 상세 페이지 스크래핑 - URL을 임시로 변경하여 처리
                    original_url = source.url
                    source.url = url  # 임시 변경

                    detail_tasks_data = CrawlerService.extract_detail_urls(source, existing_guids, max_items=50)
                    total_items_found += len(detail_tasks_data)

                    # 상세 페이지들 크롤링
                    for data in detail_tasks_data:
                        try:
                            item = CrawlerService.crawl_detail_page(
                                feed, source, data["detail_url"], data["list_data"]
                            )
                            item.save()
                            existing_guids.add(item.guid)
                            total_items_created += 1

                            if item.id:
                                precache_images_for_item.delay(item.id)
                        except Exception as e:
                            logger.warning(f"Failed to crawl detail: {data['detail_url']}: {e}")

                    source.url = original_url  # 복원
                    logger.info(f"Page {i + 1}: created {len(detail_tasks_data)} items")

                # 딜레이
                if i < len(urls) - 1 and delay_ms > 0:
                    time.sleep(delay_ms / 1000.0)

            except Exception as e:
                logger.exception(f"Error crawling page {i + 1}: {url}")
                errors.append(f"Page {i + 1} ({url}): {str(e)}")

        # 피드 업데이트
        if total_items_created > 0:
            feed.last_updated = django_timezone.now()
            feed.save()

        _complete_task_result(task_result, total_items_found, total_items_created, errors if errors else None)

        message = f"Crawled {total_pages} pages, found {total_items_found}, created {total_items_created}"
        if errors:
            message += f", {len(errors)} errors"

        return {
            "success": len(errors) == 0 or total_items_created > 0,
            "total_pages": total_pages,
            "total_items_found": total_items_found,
            "total_items_created": total_items_created,
            "errors": errors,
            "message": message,
        }

    except Exception as e:
        logger.exception(f"Failed pagination crawl for source {source_id}")
        _fail_task_result(task_result, str(e))
        return {"success": False, "error": str(e)}


# ===========================================
# 큐 3: image_aggregate - 이미지 처리
# ===========================================


@shared_task
def precache_images_for_item(item_id: int):
    """RSSItem의 이미지 업로드 스케줄링"""
    from feeds.models import RSSItem

    try:
        item = RSSItem.objects.get(id=item_id)
    except RSSItem.DoesNotExist:
        return f"RSSItem {item_id} does not exist"

    if not item.description:
        return f"RSSItem {item_id} has no description"

    upload_images_for_item.delay(item_id)
    return f"Scheduled image upload for RSSItem {item_id}"


# ===========================================
# 큐 5: image_upload - MinIO 이미지 업로드
# ===========================================


@shared_task
def upload_images_for_item(item_id: int):
    """RSSItem의 이미지를 MinIO에 업로드"""
    from feeds.models import RSSItem
    from feeds.services.image_storage import get_image_storage_service

    try:
        item = RSSItem.objects.get(id=item_id)
    except RSSItem.DoesNotExist:
        return f"RSSItem {item_id} does not exist"

    description = item.description
    if not description or "<" not in description or ">" not in description:
        return f"RSSItem {item_id} has no HTML description"

    try:
        storage_service = get_image_storage_service()
        new_description, replaced_count = storage_service.upload_images_and_replace_html(
            description, base_url=item.link
        )

        if replaced_count > 0:
            item.description = new_description
            item.save(update_fields=["description"])

            # 대표 이미지도 업로드
            if item.image and item.image.startswith(("http://", "https://")):
                new_image_path = storage_service.upload_image_from_url(item.image, base_url=item.link)
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
    """단일 이미지를 MinIO에 업로드"""
    from feeds.models import RSSItem
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
    """특정 카테고리의 모든 피드 업데이트"""
    from feeds.models import RSSFeed

    feeds = RSSFeed.objects.filter(category_id=category_id, visible=True)
    for feed in feeds:
        update_feed_items.delay(feed.pk)

    return f"Scheduled updates for {len(feeds)} feeds in category {category_id}"


@shared_task
def update_all_feeds():
    """모든 활성화된 피드 업데이트"""
    from feeds.models import RSSFeed

    feeds = RSSFeed.objects.filter(visible=True)
    for feed in feeds:
        update_feed_items.delay(feed.pk)

    return f"Scheduled updates for {len(feeds)} feeds"


@shared_task
def crawl_rss_everything_source(source_id):
    """RSSEverything 소스 크롤링"""
    from feeds.models import RSSEverythingSource

    try:
        source = RSSEverythingSource.objects.select_related("feed").get(id=source_id)
    except RSSEverythingSource.DoesNotExist:
        return f"RSSEverythingSource {source_id} does not exist"

    return update_feed_items.delay(source.feed.id)
