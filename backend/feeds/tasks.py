from logging import getLogger
from time import struct_time
import feedparser
import requests
from datetime import datetime, timezone
from celery import shared_task
from django.contrib.auth import get_user_model
from django.apps import apps
from django.utils import timezone as django_timezone
from feeds.utils import fetch_feed_data
import os
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from io import BytesIO
from PIL import Image

# Image caching has been removed. The previous cache_image_task is intentionally
# removed so images are fetched directly by clients and rely on browser caching.

logger = getLogger(__name__)


@shared_task
def update_feed_items(feed_id):
    from .models import RSSFeed, RSSItem

    """
    특정 RSS 피드의 아이템들을 업데이트하는 task
    """

    try:
        feed = RSSFeed.objects.get(id=feed_id)
        logger.info(f"Updating feed: {feed.title} ({feed.url})")
    except RSSFeed.DoesNotExist:
        return f"Feed {feed_id} does not exist"

        # RSS 피드 데이터 가져오기
    feed_data = fetch_feed_data(feed.url, feed.custom_headers)

    if feed_data.bozo:
        return f"Failed to parse feed {feed.url}: {feed_data.bozo_exception}"

    # 새로운 아이템들 수집
    new_items = []
    existing_guids = set(
        RSSItem.objects.filter(feed=feed).values_list("guid", flat=True)
    )
    from feedparser import FeedParserDict

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
    if new_items:
        RSSItem.objects.bulk_create(new_items)
        feed.last_updated = django_timezone.now()
        feed.save()

    return f"Updated feed {feed.title}: {len(new_items)} new items"


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
