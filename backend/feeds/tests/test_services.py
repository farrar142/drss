# feeds/tests/test_services.py
"""서비스 레이어 테스트"""

from datetime import timedelta

from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from feeds.models import RSSCategory, RSSFeed, RSSItem
from feeds.schemas.feed import FeedCreateSchema, FeedUpdateSchema
from feeds.services.category import CategoryService
from feeds.services.feed import FeedService
from feeds.services.item import ItemService
from feeds.tests.conftest import BaseTestCase


class QueryOptimizationTest(TestCase, BaseTestCase):
    """쿼리 최적화 테스트"""

    def setUp(self) -> None:
        self.user = self.create_user("queryuser")
        # 여러 카테고리, 피드, 아이템 생성
        for cat_i in range(3):
            category = RSSCategory.objects.create(
                user=self.user, name=f"Category {cat_i}"
            )
            for feed_i in range(3):
                feed = RSSFeed.objects.create(
                    user=self.user,
                    category=category,
                    title=f"Feed {cat_i}-{feed_i}",
                )
                for item_i in range(5):
                    RSSItem.objects.create(
                        feed=feed,
                        title=f"Item {cat_i}-{feed_i}-{item_i}",
                        link=f"http://example.com/{cat_i}/{feed_i}/{item_i}",
                        published_at=timezone.now() - timedelta(minutes=item_i),
                        guid=f"guid-{cat_i}-{feed_i}-{item_i}",
                    )

    def test_list_all_items_query_count(self) -> None:
        """list_all_items의 쿼리 수 확인"""
        with CaptureQueriesContext(connection) as context:
            list(ItemService.list_all_items(self.user)[:10])

        # 쿼리 수가 합리적인 범위인지 확인 (N+1 문제 없음)
        self.assertLessEqual(len(context.captured_queries), 5)

    def test_category_stats_query_count(self) -> None:
        """get_category_stats의 쿼리 수 확인 (최적화: 단일 aggregate 쿼리)"""
        category = RSSCategory.objects.filter(user=self.user).first()
        assert category is not None

        with CaptureQueriesContext(connection) as context:
            CategoryService.get_category_stats(self.user, category.id)

        # 최적화된 쿼리: Category 조회(1) + 단일 aggregate 쿼리(1)
        self.assertLessEqual(len(context.captured_queries), 3)


class ItemSearchTest(TestCase, BaseTestCase):
    """아이템 검색 테스트"""

    def setUp(self) -> None:
        self.user = self.create_user("searchuser")
        self.category = self.create_category(self.user, "Search Category")
        self.feed = self.create_feed(self.user, self.category, "Search Feed")

        # 검색용 아이템 생성
        RSSItem.objects.create(
            feed=self.feed,
            title="Python Programming Guide",
            link="http://example.com/python",
            description="Learn Python programming",
            published_at=timezone.now(),
            guid="search-guid-1",
        )
        RSSItem.objects.create(
            feed=self.feed,
            title="Django Web Framework",
            link="http://example.com/django",
            description="Build web apps with Django and Python",
            published_at=timezone.now() - timedelta(minutes=1),
            guid="search-guid-2",
        )
        RSSItem.objects.create(
            feed=self.feed,
            title="React Frontend Development",
            link="http://example.com/react",
            description="Modern React development",
            published_at=timezone.now() - timedelta(minutes=2),
            guid="search-guid-3",
        )

    def test_search_by_title(self) -> None:
        """제목으로 검색"""
        items = list(ItemService.list_all_items(self.user, search="Python"))
        self.assertGreaterEqual(len(items), 1)
        self.assertTrue(any("Python" in item.title for item in items))

    def test_search_by_description(self) -> None:
        """설명으로 검색"""
        items = list(ItemService.list_all_items(self.user, search="web apps"))
        self.assertGreaterEqual(len(items), 1)

    def test_search_no_results(self) -> None:
        """검색 결과 없음"""
        items = list(ItemService.list_all_items(self.user, search="nonexistent12345"))
        self.assertEqual(len(items), 0)

    def test_search_empty_string(self) -> None:
        """빈 문자열 검색 시 전체 반환"""
        items = list(ItemService.list_all_items(self.user, search=""))
        self.assertEqual(len(items), 3)


class FeedServiceTest(TestCase, BaseTestCase):
    """FeedService 테스트"""

    def setUp(self) -> None:
        self.user = self.create_user("feedserviceuser")
        self.category = self.create_category(self.user, "FeedService Category")

    def test_create_feed(self) -> None:
        """피드 생성 테스트"""
        data = FeedCreateSchema.model_validate({
            "category_id": self.category.id,
            "title": "New Test Feed",
            "description": "Test Description",
        })
        feed = FeedService.create_feed(self.user, data)

        self.assertEqual(feed.title, "New Test Feed")
        self.assertEqual(feed.user, self.user)
        self.assertEqual(feed.category, self.category)

    def test_update_feed(self) -> None:
        """피드 수정 테스트"""
        feed = RSSFeed.objects.create(
            user=self.user,
            category=self.category,
            title="Original Title",
        )

        data = FeedUpdateSchema.model_validate({"title": "Updated Title", "visible": False})
        updated_feed = FeedService.update_feed(self.user, feed.id, data)

        self.assertEqual(updated_feed.title, "Updated Title")
        self.assertFalse(updated_feed.visible)

    def test_delete_feed(self) -> None:
        """피드 삭제 테스트"""
        feed = RSSFeed.objects.create(
            user=self.user,
            category=self.category,
            title="To Delete",
        )
        feed_id = feed.id

        result = FeedService.delete_feed(self.user, feed_id)
        self.assertTrue(result)

        # 삭제 확인
        self.assertFalse(RSSFeed.objects.filter(id=feed_id).exists())

    def test_mark_all_items_read(self) -> None:
        """피드의 모든 아이템 읽음 처리 테스트"""
        feed = RSSFeed.objects.create(
            user=self.user,
            category=self.category,
            title="Read Test Feed",
        )
        # 읽지 않은 아이템 생성
        for i in range(5):
            RSSItem.objects.create(
                feed=feed,
                title=f"Item {i}",
                link=f"http://example.com/{i}",
                published_at=timezone.now(),
                guid=f"read-test-guid-{i}",
                is_read=False,
            )

        FeedService.mark_all_items_read(self.user, feed.id)

        # 모든 아이템이 읽음 처리되었는지 확인
        unread_count = RSSItem.objects.filter(feed=feed, is_read=False).count()
        self.assertEqual(unread_count, 0)

    def test_delete_all_items(self) -> None:
        """피드의 모든 아이템 삭제 테스트"""
        feed = RSSFeed.objects.create(
            user=self.user,
            category=self.category,
            title="Delete Items Test Feed",
        )
        for i in range(5):
            RSSItem.objects.create(
                feed=feed,
                title=f"Item {i}",
                link=f"http://example.com/{i}",
                published_at=timezone.now(),
                guid=f"delete-test-guid-{i}",
            )

        deleted_count = FeedService.delete_all_items(self.user, feed.id)
        self.assertEqual(deleted_count, 5)

        # 아이템이 삭제되었는지 확인
        remaining_count = RSSItem.objects.filter(feed=feed).count()
        self.assertEqual(remaining_count, 0)
