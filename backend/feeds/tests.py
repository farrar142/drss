from django.test import TestCase
from django.contrib.auth import get_user_model
from ninja.testing import TestClient
from feeds.routers.router import router
from feeds.models import RSSCategory, RSSFeed, RSSItem
from django.utils import timezone
import jwt
from django.conf import settings

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


class FeedAPITest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", password="testpass123"
        )
        self.category = RSSCategory.objects.create(
            user=self.user, name="Test Category", description="Test Description"
        )
        self.client = TestClient(router)
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
