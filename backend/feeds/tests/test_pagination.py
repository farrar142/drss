# feeds/tests/test_pagination.py
"""페이지네이션 테스트"""

import uuid
from datetime import timedelta

from asgiref.sync import async_to_sync
from django.test import TestCase
from django.utils import timezone
from ninja.testing import TestAsyncClient

from feeds.models import RSSItem
from feeds.routers import item_router
from feeds.tests.conftest import (
    BaseTestCase,
    create_auth_headers,
    get_user_id,
)


class FeedPaginationTest(TestCase, BaseTestCase):
    """페이지네이션 테스트"""

    def setUp(self) -> None:
        self.user = self.create_user("pagination")
        self.category = self.create_category(self.user, "Test Category")
        self.feed = self.create_feed(self.user, self.category, "Test Feed")
        self.api_client = TestAsyncClient(item_router)
        self.headers = create_auth_headers(get_user_id(self.user))

    def test_pagination_with_30_items_page_size_10(self) -> None:
        """30개 아이템을 페이지 사이즈 10으로 페이지네이션"""
        # Create 30 items
        items: list[RSSItem] = []
        guid_prefix = uuid.uuid4().hex[:8]
        for i in range(30):
            item = RSSItem.objects.create(
                feed=self.feed,
                title=f"Test Item {i}",
                link=f"http://example.com/item{i}",
                published_at=timezone.now() - timedelta(minutes=i),
                guid=f"test-guid-{guid_prefix}-{i}",
            )
            items.append(item)

        # Sort items by published_at desc (newest first)
        items.sort(key=lambda x: x.published_at, reverse=True)

        # First page (no cursor, returns newest items first)
        response = async_to_sync(self.api_client.get)(
            "/?limit=10&direction=before", headers=self.headers
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data["items"]), 10)
        self.assertTrue(data["has_next"])
        self.assertIsNotNone(data["next_cursor"])

        # Check items are in correct order (newest first by published_at)
        for i, item in enumerate(data["items"]):
            self.assertEqual(item["id"], items[i].id)

        # Second page (use next_cursor with direction=before to get older items)
        cursor: str = data["next_cursor"]
        response = async_to_sync(self.api_client.get)(
            f"/?limit=10&cursor={cursor}&direction=before", headers=self.headers
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data["items"]), 10)
        self.assertTrue(data["has_next"])

        # Third page
        cursor = data["next_cursor"]
        response = async_to_sync(self.api_client.get)(
            f"/?limit=10&cursor={cursor}&direction=before", headers=self.headers
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data["items"]), 10)
        self.assertFalse(data["has_next"])

    def test_pagination_with_new_items_after_request(self) -> None:
        """요청 후 새 아이템이 추가된 경우 페이지네이션"""
        base_time = timezone.now()
        guid_prefix = uuid.uuid4().hex[:8]

        # Create 30 items (older items)
        items: list[RSSItem] = []
        for i in range(30):
            item = RSSItem.objects.create(
                feed=self.feed,
                title=f"Test Item {i}",
                link=f"http://example.com/item{i}",
                published_at=base_time - timedelta(minutes=30 + i),
                guid=f"test-guid-{guid_prefix}-{i}",
            )
            items.append(item)

        # First page - get newest items
        response = async_to_sync(self.api_client.get)(
            "/?limit=10&direction=before", headers=self.headers
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data["items"]), 10)

        # Store the max published_at from first batch as cursor reference
        first_batch_max_published_at = max(item.published_at for item in items)

        # Create 30 more items (newer than first batch)
        new_items: list[RSSItem] = []
        for i in range(30):
            item = RSSItem.objects.create(
                feed=self.feed,
                title=f"New Test Item {i}",
                link=f"http://example.com/new_item{i}",
                published_at=base_time + timedelta(minutes=i + 1),
                guid=f"new-test-guid-{guid_prefix}-{i}",
            )
            new_items.append(item)

        new_item_ids_set = {item.id for item in new_items}

        # Use first_batch_max_published_at as cursor to get items newer than cursor
        cursor = first_batch_max_published_at.isoformat().replace("+00:00", "Z")

        # Request newer items using after direction
        response = async_to_sync(self.api_client.get)(
            f"/?limit=10&cursor={cursor}&direction=after",
            headers=self.headers,
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data["items"]), 10)
        response_item_ids_set = {item["id"] for item in data["items"]}
        self.assertTrue(response_item_ids_set.issubset(new_item_ids_set))

        cursor = data["next_cursor"]
        # Request second
        response = async_to_sync(self.api_client.get)(
            f"/?limit=10&cursor={cursor}&direction=after",
            headers=self.headers,
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data["items"]), 10)
        response_item_ids_set2 = {item["id"] for item in data["items"]}
        self.assertTrue(response_item_ids_set2.issubset(new_item_ids_set))
        cursor = data["next_cursor"]

        # Request third
        response = async_to_sync(self.api_client.get)(
            f"/?limit=10&cursor={cursor}&direction=after",
            headers=self.headers,
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data["items"]), 10)
        response_item_ids_set3 = {item["id"] for item in data["items"]}
        self.assertTrue(response_item_ids_set3.issubset(new_item_ids_set))
        # Third page should be the last page (30 items total, 3 pages of 10)
        self.assertFalse(data["has_next"])

        # Verify all new items were retrieved across all 3 pages
        all_retrieved_ids = (
            response_item_ids_set | response_item_ids_set2 | response_item_ids_set3
        )
        self.assertEqual(all_retrieved_ids, new_item_ids_set)
