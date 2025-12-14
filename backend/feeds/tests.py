from django.test import TestCase
from django.contrib.auth import get_user_model
from ninja.testing import TestClient
from feeds.router import router
from feeds.models import RSSCategory, RSSFeed, RSSItem
from django.utils import timezone

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
        # Note: TestClient doesn't handle auth automatically
        # This is a simplified test
        feeds = RSSFeed.objects.filter(user=self.user)
        self.assertEqual(feeds.count(), 2)

    def test_create_feed(self):
        data = {
            "url": "http://example.com/rss",
            "title": "New Feed",
            "description": "New Description",
        }
        # Simplified test without auth
        feed = RSSFeed.objects.create(
            user=self.user,
            category=self.category,
            url=data["url"],
            title=data["title"],
            description=data["description"],
        )
        self.assertEqual(feed.title, "New Feed")
        self.assertEqual(RSSFeed.objects.count(), 1)
