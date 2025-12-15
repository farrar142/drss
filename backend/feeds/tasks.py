import feedparser
import requests
from datetime import datetime, timezone
from celery import shared_task
from django.contrib.auth import get_user_model
from django.apps import apps
from django.utils import timezone as django_timezone
from feeds.utils import fetch_feed_data
import hashlib
import os
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from io import BytesIO
from PIL import Image


@shared_task
def cache_image_task(original_url):
    """Download an image and store it under MEDIA_ROOT/cached_images/ with a hash-based filename."""
    CachedImage = apps.get_model("feeds", "CachedImage")

    # check existing
    try:
        ci = CachedImage.objects.filter(original_url=original_url).first()
        if ci:
            return ci.relative_path
    except Exception:
        pass

    try:
        resp = requests.get(original_url, stream=True, timeout=10)
        if resp.status_code != 200:
            return None

        content_type = resp.headers.get("content-type", "").split(";")[0]

        # determine extension
        ext_map = {
            "image/jpeg": "jpg",
            "image/png": "png",
            "image/webp": "webp",
            "image/x-icon": "ico",
            "image/vnd.microsoft.icon": "ico",
            "image/svg+xml": "svg",
            "image/gif": "gif",
        }
        ext = ext_map.get(content_type)
        if not ext:
            # fallback to url path extension
            path_ext = os.path.splitext(original_url)[1].lstrip(".")
            ext = path_ext or "bin"

        key = hashlib.sha256(original_url.encode("utf-8")).hexdigest()[:32]
        filename = f"{key}.{ext}"
        rel_path = f"cached_images/{filename}"

        # Save via Django's storage backend. This will use S3 if configured,
        # otherwise the default FileSystemStorage (MEDIA_ROOT).
        try:
            if not default_storage.exists(rel_path):
                # fetch content (small images should be fine to hold in memory)
                content = b""
                for chunk in resp.iter_content(8192):
                    if chunk:
                        content += chunk

                default_storage.save(rel_path, ContentFile(content))

            # extract image size if possible
            width = None
            height = None
            try:
                img = Image.open(BytesIO(content))
                width, height = img.size
            except Exception:
                width = None
                height = None

            # create record pointing to the storage path
            ci = CachedImage.objects.create(
                original_url=original_url,
                relative_path=rel_path,
                content_type=content_type,
                width=width,
                height=height,
            )
            return rel_path
        except Exception:
            # If storage backend fails for any reason, fallback to local write
            rel_dir = os.path.join("cached_images")
            full_dir = os.path.join(settings.MEDIA_ROOT, rel_dir)
            os.makedirs(full_dir, exist_ok=True)
            full_path = os.path.join(full_dir, filename)

            # write file locally
            with open(full_path, "wb") as fh:
                for chunk in resp.iter_content(8192):
                    if chunk:
                        fh.write(chunk)

            rel_path_fs = os.path.join(rel_dir, filename).replace("\\", "/")
            # fallback filesystem save; try to extract size
            width = None
            height = None
            try:
                with open(full_path, "rb") as fh:
                    img = Image.open(fh)
                    width, height = img.size
            except Exception:
                width = None
                height = None

            ci = CachedImage.objects.create(
                original_url=original_url, relative_path=rel_path_fs, content_type=content_type, width=width, height=height
            )
            return rel_path_fs
    except Exception:
        return None


@shared_task
def update_feed_items(feed_id):
    """
    특정 RSS 피드의 아이템들을 업데이트하는 task
    """
    RSSFeed = apps.get_model("feeds", "RSSFeed")
    RSSItem = apps.get_model("feeds", "RSSItem")

    try:
        feed = RSSFeed.objects.get(id=feed_id)
    except RSSFeed.DoesNotExist:
        return f"Feed {feed_id} does not exist"

    try:
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
            # GUID 생성 (없으면 link 사용)
            guid = (
                getattr(entry, "id", None) or getattr(entry, "guid", None) or entry.link
            )

            if guid in existing_guids:
                continue

            # 제목 추출
            title = getattr(entry, "title", "No Title")

            # 설명 추출
            description = ""
            if hasattr(entry, "description"):
                description = entry.description
            elif hasattr(entry, "summary"):
                description = entry.summary

            # 링크 추출
            link = getattr(entry, "link", "")

            # 발행일 추출
            published_at = django_timezone.now()
            if hasattr(entry, "published_parsed") and entry.published_parsed:
                try:
                    published_at = datetime(
                        *entry.published_parsed[:6], tzinfo=timezone.utc
                    )
                except (ValueError, TypeError):
                    pass
            elif hasattr(entry, "updated_parsed") and entry.updated_parsed:
                try:
                    published_at = datetime(
                        *entry.updated_parsed[:6], tzinfo=timezone.utc
                    )
                except (ValueError, TypeError):
                    pass

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

    except Exception as e:
        return f"Failed to update feed {feed.url}: {str(e)}"


@shared_task
def update_feeds_by_category(category_id):
    """
    특정 카테고리의 모든 RSS 피드들을 업데이트하는 task
    """
    RSSFeed = apps.get_model("feeds", "RSSFeed")
    feeds = RSSFeed.objects.filter(category_id=category_id, visible=True)
    results = []

    for feed in feeds:
        result = update_feed_items.delay(feed.id)
        results.append(result)

    return f"Scheduled updates for {len(feeds)} feeds in category {category_id}"


@shared_task
def update_all_feeds():
    """
    모든 활성화된 RSS 피드들을 업데이트하는 task
    """
    RSSFeed = apps.get_model("feeds", "RSSFeed")
    feeds = RSSFeed.objects.filter(visible=True)
    results = []

    for feed in feeds:
        result = update_feed_items.delay(feed.id)
        results.append(result)

    return f"Scheduled updates for {len(feeds)} feeds"
