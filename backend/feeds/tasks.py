"""
Celery Tasks - 피드 업데이트 및 이미지 처리 태스크
리팩토링: CrawlerService를 사용하여 중복 로직 제거
"""

from logging import getLogger
import os
from typing import Optional
from base.celery_helper import shared_task
from celery import chord, group
from django.utils import timezone as django_timezone

from feeds.schemas.source import PreviewItemRequest
from feeds.services.source import SourceService

logger = getLogger(__name__)

# MinIO 이미지 업로드 활성화 여부
ENABLE_IMAGE_UPLOAD = os.getenv("ENABLE_IMAGE_UPLOAD", "True") == "True"


# ===========================================
# 헬퍼 함수
# ===========================================




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


def _complete_task_result(task_result, items_found: int, items_created: int, errors: Optional[list] = None):
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
                option = PreviewItemRequest.from_orm(source)
                items = SourceService.crawl(option, feed=feed, source=source,existing_guids=existing_guids)

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
    task_result_id: Optional[int] = None,
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
                option = PreviewItemRequest.from_orm(source)
                option.url = url
                items = SourceService.crawl(option, feed=feed, source=source,existing_guids=existing_guids)
                RSSItem.objects.bulk_create(items, ignore_conflicts=True)
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
