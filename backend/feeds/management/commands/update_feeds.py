from django.core.management.base import BaseCommand
from feeds.models import RSSFeed, RSSItem
from feeds.utils.html_utils import strip_html_tags
import feedparser
import requests
from datetime import datetime, timedelta
from django.utils import timezone


class Command(BaseCommand):
    help = "Update RSS feeds"

    def add_arguments(self, parser):
        parser.add_argument(
            "--feed-id",
            type=int,
            help="Update specific feed by ID",
        )

    def handle(self, *args, **options):
        if options["feed_id"]:
            feeds = RSSFeed.objects.filter(id=options["feed_id"])
        else:
            # 자동 새로고침 주기가 지난 피드들만 업데이트
            now = timezone.now()
            feeds = RSSFeed.objects.filter(
                last_updated__lt=now - timedelta(minutes=1)  # 최소 1분 주기로 제한
            ).exclude(refresh_interval=0)

            # 각 피드의 refresh_interval에 따라 필터링
            feeds_to_update = []
            for feed in feeds:
                if feed.last_updated + timedelta(minutes=feed.refresh_interval) <= now:
                    feeds_to_update.append(feed.id)

            feeds = RSSFeed.objects.filter(id__in=feeds_to_update)

        self.stdout.write(f"Updating {feeds.count()} feeds...")

        for feed in feeds:
            try:
                self.update_feed(feed)
                self.stdout.write(
                    self.style.SUCCESS(f"Successfully updated feed: {feed.title}")
                )
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f"Failed to update feed {feed.title}: {str(e)}")
                )

    def update_feed(self, feed):
        # Custom headers 설정
        headers = {"User-Agent": "RSS Reader/1.0"}
        headers.update(feed.custom_headers)

        response = requests.get(feed.url, headers=headers, timeout=30)
        response.raise_for_status()

        # RSS 파싱
        parsed_feed = feedparser.parse(response.content)

        if parsed_feed.bozo:
            raise Exception("Invalid RSS feed")
        if not parsed_feed.feed:
            raise Exception("No feed data found")
        if not isinstance(parsed_feed.feed, feedparser.FeedParserDict):
            raise Exception("Invalid feed data format")

        # 피드 정보 업데이트
        if parsed_feed.feed.get("title"):
            feed.title = parsed_feed.feed.title
        if parsed_feed.feed.get("description"):
            feed.description = parsed_feed.feed.description

        feed.last_updated = timezone.now()
        feed.save()

        # 새로운 아이템들 추가
        existing_guids = set(
            RSSItem.objects.filter(feed=feed).values_list("guid", flat=True)
        )

        new_items = []
        for entry in parsed_feed.entries:
            guid = entry.get("id", entry.get("link", str(hash(entry.get("title", "")))))

            if guid in existing_guids:
                continue

            # 날짜 파싱
            published_at = None
            if hasattr(entry, "published_parsed") and entry.published_parsed:
                published_at = datetime(*entry.published_parsed[:6]) #type:ignore
            elif hasattr(entry, "updated_parsed") and entry.updated_parsed:
                published_at = datetime(*entry.updated_parsed[:6]) #type:ignore
            else:
                published_at = timezone.now()

            item = RSSItem(
                feed=feed,
                title=entry.get("title", "No Title"),
                link=entry.get("link", ""),
                description=entry.get("description", ""),
                description_text=strip_html_tags(entry.get("description", "")), # type:ignore
                published_at=published_at,
                guid=guid,
            )
            new_items.append(item)

        # 벌크 생성
        if new_items:
            RSSItem.objects.bulk_create(new_items)
            self.stdout.write(f"Added {len(new_items)} new items to {feed.title}")
