from hmac import new
from django.test import TestCase
from django.contrib.auth import get_user_model
from ninja.testing import TestClient
from feeds.routers.item import router as item_router
from feeds.routers.feed import router as feed_router
from feeds.models import RSSCategory, RSSFeed, RSSItem
from django.utils import timezone
import jwt
from django.conf import settings
from datetime import timedelta

User = get_user_model()


class FeedModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", password="testpass123"
        )
        self.category = RSSCategory.objects.create(
            user=self.user, name="Test Category", description="Test Description"
        )

    def test_feed_creation(self):
        feed = RSSFeed.objects.create(
            user=self.user,
            category=self.category,
            url="http://example.com/rss",
            title="Test Feed",
            description="Test Description",
        )
        self.assertEqual(feed.title, "Test Feed")
        self.assertEqual(feed.user, self.user)

    def test_item_creation(self):
        feed = RSSFeed.objects.create(
            user=self.user,
            category=self.category,
            url="http://example.com/rss",
            title="Test Feed",
        )
        item = RSSItem.objects.create(
            feed=feed,
            title="Test Item",
            link="http://example.com/item1",
            published_at=timezone.now(),
            guid="test-guid-1",
        )
        self.assertEqual(item.title, "Test Item")
        self.assertEqual(item.feed, feed)
        self.assertFalse(item.is_read)


class FeedPaginationTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", password="testpass123"
        )
        self.category = RSSCategory.objects.create(
            user=self.user, name="Test Category", description="Test Description"
        )
        self.feed = RSSFeed.objects.create(
            user=self.user,
            category=self.category,
            url="http://example.com/rss",
            title="Test Feed",
        )
        self.client = TestClient(item_router)
        self.token = jwt.encode(
            {"user_id": self.user.id}, settings.SECRET_KEY, algorithm="HS256"
        )
        self.headers = {"Authorization": f"Bearer {self.token}"}

    def test_pagination_with_30_items_page_size_10(self):
        # Create 30 items
        items = []
        for i in range(30):
            item = RSSItem.objects.create(
                feed=self.feed,
                title=f"Test Item {i}",
                link=f"http://example.com/item{i}",
                published_at=timezone.now() - timedelta(minutes=i),
                guid=f"test-guid-{i}",
            )
            items.append(item)

        # Sort items by published_at desc
        items.sort(key=lambda x: x.published_at, reverse=True)

        # First page
        response = self.client.get("/?limit=10", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data["items"]), 10)
        self.assertTrue(data["has_next"])
        self.assertIsNotNone(data["next_cursor"])

        # Check items are in correct order
        for i, item in enumerate(data["items"]):
            self.assertEqual(item["id"], items[i].id)

        # Second page
        cursor = data["next_cursor"]
        response = self.client.get(
            f"/?limit=10&cursor={cursor}&direction=before", headers=self.headers
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data["items"]), 10)
        self.assertTrue(data["has_next"])

        # Third page
        cursor = data["next_cursor"]
        response = self.client.get(
            f"/?limit=10&cursor={cursor}&direction=before", headers=self.headers
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data["items"]), 10)
        self.assertFalse(data["has_next"])

    def test_pagination_with_new_items_after_request(self):
        base_time = timezone.now()
        # Create 30 items (older items)
        items = []
        for i in range(30):
            item = RSSItem.objects.create(
                feed=self.feed,
                title=f"Test Item {i}",
                link=f"http://example.com/item{i}",
                published_at=base_time
                - timedelta(minutes=30 + i),  # Older than base_time
                guid=f"test-guid-{i}",
            )
            items.append(item)

        # First page
        response = self.client.get("/?limit=10", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data["items"]), 10)
        # Use base_time as cursor - all new items will be after this
        cursor = base_time.isoformat().replace("+00:00", "Z")

        # Create 30 more items (newer than base_time)
        new_items = []
        for i in range(30):
            item = RSSItem.objects.create(
                feed=self.feed,
                title=f"New Test Item {i}",
                link=f"http://example.com/new_item{i}",
                published_at=base_time
                + timedelta(minutes=i + 1),  # Newer than base_time
                guid=f"new-test-guid-{i}",
            )
            new_items.append(item)

        new_item_ids_set = {item.id for item in new_items}
        # Request newer items using after direction
        response = self.client.get(
            f"/?limit=10&cursor={cursor}&direction=after",
            headers=self.headers,
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        print(f"Items count: {len(data['items'])}, cursor: {cursor}")
        for item in data["items"][:3]:
            print(f"Item id: {item['id']}, published_at: {item['published_at']}")
        self.assertEqual(len(data["items"]), 10)
        response_item_ids_set = {item["id"] for item in data["items"]}
        self.assertTrue(response_item_ids_set.issubset(new_item_ids_set))

        cursor = data["next_cursor"]
        # Request second
        response = self.client.get(
            f"/?limit=10&cursor={cursor}&direction=after",
            headers=self.headers,
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        print(
            f"Second page - Items count: {len(data['items'])}, cursor: {cursor}, has_next: {data['has_next']}"
        )
        self.assertEqual(len(data["items"]), 10)
        response_item_ids_set2 = {item["id"] for item in data["items"]}
        self.assertTrue(response_item_ids_set2.issubset(new_item_ids_set))
        cursor = data["next_cursor"]

        # Request third
        response = self.client.get(
            f"/?limit=10&cursor={cursor}&direction=after",
            headers=self.headers,
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        print(
            f"Third page - Items count: {len(data['items'])}, cursor: {cursor}, has_next: {data['has_next']}"
        )
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
        # Should get the newer items


class FeedAPITest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", password="testpass123"
        )
        self.category = RSSCategory.objects.create(
            user=self.user, name="Test Category", description="Test Description"
        )
        self.client = TestClient(feed_router)
        # Create JWT token for testing
        payload = {"user_id": self.user.id}
        self.token = jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")
        self.auth_headers = {"Authorization": f"Bearer {self.token}"}

    def test_list_feeds(self):
        RSSFeed.objects.create(
            user=self.user,
            category=self.category,
            url="http://example.com/rss1",
            title="Feed 1",
        )
        RSSFeed.objects.create(
            user=self.user,
            category=self.category,
            url="http://example.com/rss2",
            title="Feed 2",
        )

        response = self.client.get("/feeds", headers=self.auth_headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 2)

    def test_create_feed(self):
        data = {
            "category_id": self.category.id,
            "url": "http://example.com/rss",
            "title": "New Feed",
            "description": "New Description",
        }

        response = self.client.post("/feeds", json=data, headers=self.auth_headers)
        self.assertEqual(response.status_code, 200)

    def test_create_feed_without_title(self):
        """제목 없이 피드를 생성하면 자동으로 RSS에서 제목을 추출해야 함"""
        data = {
            "category_id": self.category.id,
            "url": "http://example.com/rss",
            # title을 intentionally 생략
            "description": "Test Description",
        }

        response = self.client.post("/feeds", json=data, headers=self.auth_headers)
        self.assertEqual(response.status_code, 200)

        # Check that feed was created with auto-generated title
        feed = RSSFeed.objects.get(url="http://example.com/rss")
        self.assertEqual(feed.title, "Unknown Feed")  # RSS 파싱 실패 시 기본값
        self.assertEqual(feed.user, self.user)
