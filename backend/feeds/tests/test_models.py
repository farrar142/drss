# feeds/tests/test_models.py
"""모델 테스트"""

from django.test import TestCase
from django.utils import timezone

from feeds.models import RSSCategory, RSSFeed, RSSItem, RSSEverythingSource, FeedTaskResult
from feeds.tests.conftest import BaseTestCase, unique_guid


class FeedModelTest(TestCase, BaseTestCase):
    """RSSFeed 모델 테스트"""

    def setUp(self) -> None:
        self.user = self.create_user("feedmodel")
        self.category = self.create_category(self.user, "Test Category")

    def test_feed_creation(self) -> None:
        """피드 생성 테스트"""
        feed = RSSFeed.objects.create(
            user=self.user,
            category=self.category,
            url="http://example.com/rss",
            title="Test Feed",
            description="Test Description",
        )
        self.assertEqual(feed.title, "Test Feed")
        self.assertEqual(feed.user, self.user)

    def test_item_creation(self) -> None:
        """아이템 생성 테스트"""
        feed = self.create_feed(self.user, self.category)
        item = RSSItem.objects.create(
            feed=feed,
            title="Test Item",
            link="http://example.com/item1",
            published_at=timezone.now(),
            guid=unique_guid("test-item"),
        )
        self.assertEqual(item.title, "Test Item")
        self.assertEqual(item.feed, feed)
        self.assertFalse(item.is_read)


class RSSEverythingSourceTest(TestCase, BaseTestCase):
    """RSSEverythingSource 모델 테스트"""

    def setUp(self) -> None:
        self.user = self.create_user("sourceuser")
        self.category = self.create_category(self.user, "Source Category")
        self.feed = self.create_feed(self.user, self.category, "Source Test Feed")

    def test_source_creation_rss_type(self) -> None:
        """RSS 타입 소스 생성"""
        source = RSSEverythingSource.objects.create(
            feed=self.feed,
            source_type=RSSEverythingSource.SourceType.RSS,
            url="http://example.com/rss",
        )
        self.assertTrue(source.is_rss)
        self.assertFalse(source.is_scraping)
        self.assertFalse(source.follow_links)

    def test_source_creation_page_scraping_type(self) -> None:
        """페이지 스크래핑 타입 소스 생성"""
        source = RSSEverythingSource.objects.create(
            feed=self.feed,
            source_type=RSSEverythingSource.SourceType.PAGE_SCRAPING,
            url="http://example.com/news",
            item_selector=".news-item",
            title_selector="h2",
        )
        self.assertFalse(source.is_rss)
        self.assertTrue(source.is_scraping)
        self.assertFalse(source.follow_links)

    def test_source_creation_detail_page_scraping_type(self) -> None:
        """상세 페이지 스크래핑 타입 소스 생성"""
        source = RSSEverythingSource.objects.create(
            feed=self.feed,
            source_type=RSSEverythingSource.SourceType.DETAIL_PAGE_SCRAPING,
            url="http://example.com/news",
            item_selector=".news-item",
            title_selector="h2",
            detail_description_selector=".article-body",
        )
        self.assertFalse(source.is_rss)
        self.assertTrue(source.is_scraping)
        self.assertTrue(source.follow_links)

    def test_feed_url_property(self) -> None:
        """RSSFeed.url property 테스트 (첫 번째 소스의 URL 반환)"""
        # 소스가 없을 때
        self.assertEqual(self.feed.url, "")

        # 소스 추가
        RSSEverythingSource.objects.create(
            feed=self.feed,
            source_type=RSSEverythingSource.SourceType.RSS,
            url="http://example.com/rss",
        )
        # refresh 후 확인
        self.feed.refresh_from_db()
        self.assertEqual(self.feed.url, "http://example.com/rss")

    def test_multiple_sources_per_feed(self) -> None:
        """하나의 피드에 여러 소스 연결"""
        RSSEverythingSource.objects.create(
            feed=self.feed,
            source_type=RSSEverythingSource.SourceType.RSS,
            url="http://example.com/rss1",
        )
        RSSEverythingSource.objects.create(
            feed=self.feed,
            source_type=RSSEverythingSource.SourceType.PAGE_SCRAPING,
            url="http://example.com/news",
            item_selector=".item",
        )

        self.assertEqual(self.feed.sources.count(), 2)


class FeedTaskResultTest(TestCase, BaseTestCase):
    """FeedTaskResult 모델 테스트"""

    def setUp(self) -> None:
        self.user = self.create_user("taskuser")
        self.category = self.create_category(self.user, "Task Category")
        self.feed = self.create_feed(self.user, self.category, "Task Test Feed")

    def test_task_result_creation(self) -> None:
        """TaskResult 생성 테스트"""
        task_result = FeedTaskResult.objects.create(
            feed=self.feed,
            status=FeedTaskResult.Status.PENDING,
        )
        self.assertEqual(task_result.status, "pending")
        self.assertIsNone(task_result.duration_seconds)

    def test_task_result_duration(self) -> None:
        """TaskResult 실행 시간 계산 테스트"""
        from datetime import timedelta

        task_result = FeedTaskResult.objects.create(
            feed=self.feed,
            status=FeedTaskResult.Status.SUCCESS,
            started_at=timezone.now() - timedelta(seconds=10),
            completed_at=timezone.now(),
        )
        self.assertIsNotNone(task_result.duration_seconds)
        duration = task_result.duration_seconds
        assert duration is not None
        self.assertGreaterEqual(duration, 9)
        self.assertLessEqual(duration, 11)
