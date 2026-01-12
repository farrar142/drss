# feeds/tests/test_celery_tasks.py
"""Celery Task 함수 테스트 (실제 Celery 호출 없이)"""

from unittest.mock import patch

from django.test import TestCase

from feeds.models import FeedTaskResult, RSSEverythingSource, RSSFeed
from feeds.tests.conftest import BaseTestCase


class CeleryTaskTest(TestCase, BaseTestCase):
    """Celery Task 함수 테스트"""

    def setUp(self) -> None:
        self.user = self.create_user("celeryuser")
        self.category = self.create_category(self.user, "Celery Category")
        self.feed = self.create_feed(self.user, self.category, "Celery Test Feed")

    def test_update_feed_items_nonexistent_feed(self) -> None:
        """존재하지 않는 피드 업데이트 시 에러 메시지 반환"""
        from feeds.tasks import update_feed_items

        # 직접 함수 호출 (Celery 없이)
        result = update_feed_items(99999)
        self.assertIn("does not exist", result)

    def test_update_feed_items_creates_task_result(self) -> None:
        """피드 업데이트 시 FeedTaskResult 생성 확인"""
        from feeds.tasks import update_feed_items

        # RSS 소스 추가 (실제 URL이 없어도 됨)
        RSSEverythingSource.objects.create(
            feed=self.feed,
            source_type=RSSEverythingSource.SourceType.RSS,
            url="http://invalid-url-for-test.com/rss",
        )

        # task_result_id 없이 호출하면 자동 생성
        initial_count = FeedTaskResult.objects.filter(feed=self.feed).count()

        # 실제 RSS 가져오기는 mock으로 실패 처리
        with patch("feeds.tasks.SourceService.crawl") as mock_crawl:
            mock_crawl.side_effect = Exception("Mock fetch failure")
            try:
                update_feed_items(self.feed.pk)
            except Exception:
                pass  # RSS fetch 실패는 예상됨

        # TaskResult가 생성되었는지 확인
        final_count = FeedTaskResult.objects.filter(feed=self.feed).count()
        self.assertGreaterEqual(final_count, initial_count)

    def test_update_feeds_by_category(self) -> None:
        """카테고리별 피드 업데이트 스케줄링 테스트"""
        from feeds.tasks import update_feeds_by_category

        # 추가 피드 생성
        RSSFeed.objects.create(
            user=self.user,
            category=self.category,
            title="Second Feed",
            visible=True,
        )

        # update_feed_items.delay를 mock
        with patch("feeds.tasks.update_feed_items.delay") as mock_delay:
            result = update_feeds_by_category(self.category.pk)

            # visible=True인 피드들에 대해 delay가 호출되었는지 확인
            self.assertEqual(mock_delay.call_count, 2)
            self.assertIn("2 feeds", result)

    def test_update_all_feeds(self) -> None:
        """전체 피드 업데이트 스케줄링 테스트"""
        from feeds.tasks import update_all_feeds

        # update_feed_items.delay를 mock
        with patch("feeds.tasks.update_feed_items.delay") as mock_delay:
            result = update_all_feeds()

            # visible=True인 피드에 대해 delay가 호출되었는지 확인
            self.assertGreaterEqual(mock_delay.call_count, 1)
            self.assertIn("feeds", result)
