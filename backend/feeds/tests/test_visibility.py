# feeds/tests/test_visibility.py
"""Category와 Feed의 visible 옵션 테스트"""

from datetime import timedelta

from asgiref.sync import async_to_sync
from django.test import TestCase
from django.utils import timezone
from ninja.testing import TestAsyncClient

from feeds.models import RSSCategory, RSSFeed, RSSItem
from feeds.routers import item_router
from feeds.tests.conftest import (
    BaseTestCase,
    create_auth_headers,
    get_user_id,
    unique_guid,
)


class CategoryVisibilityTest(TestCase, BaseTestCase):
    """Category와 Feed의 visible 옵션 테스트"""

    def setUp(self) -> None:
        self.user = self.create_user("vis")

        # visible=True 카테고리
        self.visible_category = RSSCategory.objects.create(
            user=self.user,
            name="Visible Category",
            description="Visible",
            visible=True,
        )
        # visible=False 카테고리
        self.hidden_category = RSSCategory.objects.create(
            user=self.user,
            name="Hidden Category",
            description="Hidden",
            visible=False,
        )

        # visible 카테고리 내의 visible 피드
        self.visible_feed = RSSFeed.objects.create(
            user=self.user,
            category=self.visible_category,
            url="http://example.com/visible",
            title="Visible Feed",
            visible=True,
        )
        # visible 카테고리 내의 hidden 피드
        self.hidden_feed = RSSFeed.objects.create(
            user=self.user,
            category=self.visible_category,
            url="http://example.com/hidden",
            title="Hidden Feed",
            visible=False,
        )
        # hidden 카테고리 내의 visible 피드
        self.hidden_category_feed = RSSFeed.objects.create(
            user=self.user,
            category=self.hidden_category,
            url="http://example.com/hidden-cat",
            title="Hidden Category Feed",
            visible=True,
        )

        # 각 피드에 아이템 생성
        self.visible_item = RSSItem.objects.create(
            feed=self.visible_feed,
            title="Visible Item",
            link="http://example.com/v-item",
            published_at=timezone.now(),
            guid=unique_guid("visible"),
        )
        self.hidden_item = RSSItem.objects.create(
            feed=self.hidden_feed,
            title="Hidden Item",
            link="http://example.com/h-item",
            published_at=timezone.now() - timedelta(minutes=1),
            guid=unique_guid("hidden"),
        )
        self.hidden_category_item = RSSItem.objects.create(
            feed=self.hidden_category_feed,
            title="Hidden Category Item",
            link="http://example.com/hc-item",
            published_at=timezone.now() - timedelta(minutes=2),
            guid=unique_guid("hidden-cat"),
        )

        self.api_client = TestAsyncClient(item_router)
        self.headers = create_auth_headers(get_user_id(self.user))

    def test_main_page_excludes_hidden_category_items(self) -> None:
        """메인 화면: Category.visible=False인 카테고리의 아이템은 제외"""
        response = async_to_sync(self.api_client.get)("/", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        item_ids = [item["id"] for item in data["items"]]

        # visible 피드의 아이템만 포함
        self.assertIn(self.visible_item.id, item_ids)
        # hidden 피드의 아이템은 제외
        self.assertNotIn(self.hidden_item.id, item_ids)
        # hidden 카테고리의 아이템은 제외
        self.assertNotIn(self.hidden_category_item.id, item_ids)

    def test_main_page_excludes_hidden_feed_items(self) -> None:
        """메인 화면: Feed.visible=False인 피드의 아이템은 제외"""
        response = async_to_sync(self.api_client.get)("/", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        item_ids = [item["id"] for item in data["items"]]

        self.assertNotIn(self.hidden_item.id, item_ids)

    def test_category_page_excludes_hidden_feed_items(self) -> None:
        """카테고리 화면: Feed.visible=False인 피드의 아이템은 제외"""
        response = async_to_sync(self.api_client.get)(
            f"/category/{self.visible_category.id}", headers=self.headers
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        item_ids = [item["id"] for item in data["items"]]

        # visible 피드의 아이템만 포함
        self.assertIn(self.visible_item.id, item_ids)
        # hidden 피드의 아이템은 제외
        self.assertNotIn(self.hidden_item.id, item_ids)

    def test_category_page_shows_hidden_category_items(self) -> None:
        """카테고리 화면: Category.visible=False여도 해당 카테고리 페이지에서는 visible 피드의 아이템 표시"""
        response = async_to_sync(self.api_client.get)(
            f"/category/{self.hidden_category.id}", headers=self.headers
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        item_ids = [item["id"] for item in data["items"]]

        # hidden 카테고리 내의 visible 피드 아이템은 표시
        self.assertIn(self.hidden_category_item.id, item_ids)

    def test_feed_page_shows_all_items(self) -> None:
        """피드 화면: visible 설정과 관계없이 해당 피드의 모든 아이템 표시"""
        response = async_to_sync(self.api_client.get)(
            f"/feed/{self.hidden_feed.id}", headers=self.headers
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        item_ids = [item["id"] for item in data["items"]]

        # hidden 피드의 아이템도 피드 페이지에서는 표시
        self.assertIn(self.hidden_item.id, item_ids)
