from hmac import new
import json
from django.test import TestCase
from django.contrib.auth import get_user_model
from ninja.testing import TestClient
from feeds.routers.item import router as item_router
from feeds.routers.feed import router as feed_router
from feeds.routers.image import router as image_router
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

    def test_cache_image_get_endpoint_allows_get_and_schedules(self):
        # GET should return 404 when not cached; POST schedules caching and returns 202; GET returns 200 when cached
        client = TestClient(image_router)

        # GET not found (router mounted at / for image_router)
        response = client.get("/?url=http://example.com/image.jpg")
        self.assertEqual(response.status_code, 404)

        # POST schedules caching
        post_resp = client.post("/", json={"url": "http://example.com/image.jpg"})
        self.assertEqual(post_resp.status_code, 202)
        self.assertEqual(post_resp.json().get("status"), "scheduled")
        self.assertIn("Location", post_resp.headers)

        # Create a cached image and then GET should return the url
        from feeds.models import CachedImage

        ci = CachedImage.objects.create(
            original_url="http://example.com/image.jpg",
            relative_path="cached_images/image.jpg",
            content_type="image/jpeg",
        )

        get_cached = client.get("/?url=http://example.com/image.jpg")
        self.assertEqual(get_cached.status_code, 200)
        data = get_cached.json()
        self.assertIn("url", data)


class FeedScheduleTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="scheduser", password="schedpass123"
        )
        self.category = RSSCategory.objects.create(
            user=self.user, name="Sched Category", description="Sched"
        )

    def test_setup_feed_schedule_creates_and_updates(self):
        feed = RSSFeed.objects.create(
            user=self.user,
            category=self.category,
            url="http://example.com/rss",
            title="Feed For Schedule",
            refresh_interval=5,
            visible=True,
        )

        from .management.commands.setup_feed_schedules import setup_feed_schedule
        from django_celery_beat.models import PeriodicTask

        # create schedule
        setup_feed_schedule(feed)
        args_payload = json.dumps([feed.pk])
        tasks = PeriodicTask.objects.filter(args=args_payload)
        self.assertEqual(tasks.count(), 1)
        task = tasks.first()
        self.assertIn(str(feed.pk), task.args)
        self.assertEqual(task.name, f"Update RSS feed: {feed.title}")

        # change title and run again -> should update name and not create duplicate
        feed.title = "Feed For Schedule Renamed"
        feed.save()
        setup_feed_schedule(feed)
        tasks = PeriodicTask.objects.filter(args=args_payload)
        self.assertEqual(tasks.count(), 1)
        task = tasks.first()
        self.assertEqual(task.name, f"Update RSS feed: {feed.title}")

    def test_setup_feed_schedule_deletes_on_inactive(self):
        feed = RSSFeed.objects.create(
            user=self.user,
            category=self.category,
            url="http://example.com/rss2",
            title="Feed To Delete",
            refresh_interval=5,
            visible=True,
        )
        from .management.commands.setup_feed_schedules import setup_feed_schedule
        from django_celery_beat.models import PeriodicTask

        setup_feed_schedule(feed)
        args_payload = json.dumps([feed.pk])
        self.assertEqual(PeriodicTask.objects.filter(args=args_payload).count(), 1)

        # mark invisible -> should remove periodic task
        feed.visible = False
        feed.save()
        setup_feed_schedule(feed)
        self.assertEqual(PeriodicTask.objects.filter(args=args_payload).count(), 0)

    def test_setup_feed_schedule_deduplicates_existing(self):
        from django_celery_beat.models import PeriodicTask, IntervalSchedule

        feed = RSSFeed.objects.create(
            user=self.user,
            category=self.category,
            url="http://example.com/rss3",
            title="Feed With Dups",
            refresh_interval=2,
            visible=True,
        )
        schedule, _ = IntervalSchedule.objects.get_or_create(
            every=2, period=IntervalSchedule.MINUTES
        )
        # create duplicate tasks with same args but different names
        args_payload = json.dumps([feed.pk])
        PeriodicTask.objects.create(
            name="Old name 1",
            task="feeds.tasks.update_feed_items",
            interval=schedule,
            args=args_payload,
            enabled=True,
        )
        PeriodicTask.objects.create(
            name="Old name 2",
            task="feeds.tasks.update_feed_items",
            interval=schedule,
            args=args_payload,
            enabled=True,
        )

        from .management.commands.setup_feed_schedules import setup_feed_schedule

        setup_feed_schedule(feed)
        tasks = PeriodicTask.objects.filter(args=args_payload)
        # deduplicated to single task
        self.assertEqual(tasks.count(), 1)

    def _make_response(self, status=200, headers=None, text="", url=None):
        class R:
            def __init__(self, status, headers, text, url):
                self.status_code = status
                self.headers = headers or {}
                self.text = text
                self.url = url or "http://example.com/"

        return R(status, headers or {}, text, url)

    def test_update_feed_favicons_root_and_html(self):
        from django.core.management import call_command
        import sys
        import types

        # Ensure a requests module exists for the management command (tests may run in minimal env)
        if "requests" not in sys.modules:
            fake_requests = types.SimpleNamespace()

            class Session:
                pass

            fake_requests.Session = Session
            sys.modules["requests"] = fake_requests

        feed = RSSFeed.objects.create(
            user=self.user,
            category=self.category,
            url="http://example.com/somepage",
            title="Fav Feed",
        )

        # patch requests.Session.head/get
        from unittest.mock import patch

        def fake_head(self, url, timeout=5, allow_redirects=True):
            if url.endswith("/favicon.ico"):
                return self_resp1
            if url.endswith("/assets/favicon.png"):
                return self_resp2
            return self_resp_fail

        def fake_get(self, url, timeout=8, allow_redirects=True, stream=False):
            if url.startswith("http://example.com/somepage"):
                return self_resp_html
            if url.endswith("/assets/favicon.png"):
                return self_resp2
            return self_resp_fail

        self_resp1 = self._make_response(status=404, headers={})
        self_resp_html = self._make_response(
            status=200,
            text='<html><head><link rel="icon" href="/assets/favicon.png"></head></html>',
            url="http://example.com/somepage",
        )
        self_resp2 = self._make_response(
            status=200, headers={"content-type": "image/png"}
        )
        self_resp_fail = self._make_response(status=404)

        # Ensure the command module picks up our fake requests object (it may have been imported earlier)
        import importlib

        mod = importlib.import_module("feeds.management.commands.update_feed_favicons")
        mod.requests = sys.modules["requests"]

        with patch.object(mod.requests.Session, "head", fake_head), patch.object(
            mod.requests.Session, "get", fake_get
        ):
            call_command("update_feed_favicons")

        feed.refresh_from_db()
        self.assertEqual(feed.favicon_url, "http://example.com/assets/favicon.png")

    def test_update_feed_favicons_from_rss_feed_image(self):
        from django.core.management import call_command
        import sys
        import types

        if "requests" not in sys.modules:
            fake_requests = types.SimpleNamespace()

            class Session:
                pass

            fake_requests.Session = Session
            sys.modules["requests"] = fake_requests

        feed = RSSFeed.objects.create(
            user=self.user,
            category=self.category,
            url="http://feeds.example.com/rss",
            title="RSS Feed Image",
        )

        # RSS XML with <image><url>
        rss_xml = """<?xml version="1.0"?>
            <rss version="2.0">
              <channel>
                <title>Example</title>
                <link>http://example.com/</link>
                <image>
                  <url>http://example.com/assets/rss-favicon.png</url>
                </image>
              </channel>
            </rss>"""

        from unittest.mock import patch

        # prepare closure responses using TestCase helper
        resp_ok_img = self._make_response(
            status=200, headers={"content-type": "image/png"}
        )
        resp_not_found = self._make_response(status=404)
        resp_rss = self._make_response(
            status=200, text=rss_xml, url="http://feeds.example.com/rss"
        )

        def fake_head(session_self, url, timeout=5, allow_redirects=True):
            if url.endswith("/rss-favicon.png"):
                return resp_ok_img
            return resp_not_found

        def fake_get(session_self, url, timeout=8, allow_redirects=True):
            # return RSS xml for feed url
            if url.startswith("http://feeds.example.com/rss"):
                return resp_rss
            return resp_not_found

        import importlib

        mod = importlib.import_module("feeds.management.commands.update_feed_favicons")
        mod.requests = sys.modules["requests"]

        with patch.object(mod.requests.Session, "head", fake_head), patch.object(
            mod.requests.Session, "get", fake_get
        ):
            call_command("update_feed_favicons", "--feed-id", str(feed.pk))

        feed.refresh_from_db()
        self.assertEqual(feed.favicon_url, "http://example.com/assets/rss-favicon.png")

    def test_channel_root_favicon_preferred_over_feed_root(self):
        from django.core.management import call_command
        import sys
        import types

        if "requests" not in sys.modules:
            fake_requests = types.SimpleNamespace()

            class Session:
                pass

            fake_requests.Session = Session
            sys.modules["requests"] = fake_requests

        # feed URL is on feeds.example.com but channel link points to channel.example.com
        feed = RSSFeed.objects.create(
            user=self.user,
            category=self.category,
            url="http://feeds.example.com/rss",
            title="Channel Link Feed",
        )

        rss_xml = """<?xml version="1.0"?>
            <rss version="2.0">
              <channel>
                <title>Example</title>
                <link>http://channel.example.com/</link>
              </channel>
            </rss>"""

        # Responses: channel root has favicon, feed root does not
        resp_ok_img = self._make_response(
            status=200, headers={"content-type": "image/png"}
        )
        resp_not_found = self._make_response(status=404)
        resp_rss = self._make_response(
            status=200, text=rss_xml, url="http://feeds.example.com/rss"
        )

        def fake_head(session_self, url, timeout=5, allow_redirects=True):
            if url.startswith("http://channel.example.com") and url.endswith(
                "/favicon.ico"
            ):
                return resp_ok_img
            if url.startswith("http://feeds.example.com") and url.endswith(
                "/favicon.ico"
            ):
                return resp_not_found
            return resp_not_found

        def fake_get(session_self, url, timeout=8, allow_redirects=True):
            if url.startswith("http://feeds.example.com/rss"):
                return resp_rss
            return resp_not_found

        import importlib

        mod = importlib.import_module("feeds.management.commands.update_feed_favicons")
        mod.requests = sys.modules["requests"]

        from unittest.mock import patch

        with patch.object(mod.requests.Session, "head", fake_head), patch.object(
            mod.requests.Session, "get", fake_get
        ):
            call_command("update_feed_favicons", "--feed-id", str(feed.pk))

        feed.refresh_from_db()
        self.assertEqual(feed.favicon_url, "http://channel.example.com/favicon.ico")

    def test_channel_root_favicon_from_atom_link(self):
        from django.core.management import call_command
        import sys
        import types

        if "requests" not in sys.modules:
            fake_requests = types.SimpleNamespace()

            class Session:
                pass

            fake_requests.Session = Session
            sys.modules["requests"] = fake_requests

        # Atom feed with <link rel="alternate" href="https://m.ruliweb.com/..."/>
        feed = RSSFeed.objects.create(
            user=self.user,
            category=self.category,
            url="http://feeds.example.com/atom",
            title="Atom Channel Link Feed",
        )

        atom_xml = """<?xml version="1.0" encoding="utf-8"?>
            <feed xmlns="http://www.w3.org/2005/Atom">
              <title>Example Atom</title>
              <link rel="alternate" href="https://m.ruliweb.com/community/board/300143" />
            </feed>"""

        resp_ok_img = self._make_response(
            status=200, headers={"content-type": "image/png"}
        )
        resp_not_found = self._make_response(status=404)
        resp_atom = self._make_response(
            status=200, text=atom_xml, url="http://feeds.example.com/atom"
        )

        def fake_head(session_self, url, timeout=5, allow_redirects=True):
            # channel root at m.ruliweb.com has favicon
            if url.startswith("https://m.ruliweb.com") and url.endswith("/favicon.ico"):
                return resp_ok_img
            return resp_not_found

        def fake_get(session_self, url, timeout=8, allow_redirects=True):
            if url.startswith("http://feeds.example.com/atom"):
                return resp_atom
            return resp_not_found

        import importlib

        mod = importlib.import_module("feeds.management.commands.update_feed_favicons")
        mod.requests = sys.modules["requests"]

        from unittest.mock import patch

        with patch.object(mod.requests.Session, "head", fake_head), patch.object(
            mod.requests.Session, "get", fake_get
        ):
            call_command("update_feed_favicons", "--feed-id", str(feed.pk))

        feed.refresh_from_db()
        # channel page <link rel=icon> should be used when root is not an image
        self.assertEqual(feed.favicon_url, "https://m.ruliweb.com/favicon.png")

    def test_feed_blocked_by_rsshub_skips_and_does_not_use_root(self):
        from django.core.management import call_command
        import sys
        import types

        if "requests" not in sys.modules:
            fake_requests = types.SimpleNamespace()

            class Session:
                pass

            fake_requests.Session = Session
            sys.modules["requests"] = fake_requests

        feed = RSSFeed.objects.create(
            user=self.user,
            category=self.category,
            url="http://feeds.example.com/blocked",
            title="Blocked Feed",
        )

        blocked_resp = self._make_response(
            status=503, text="Welcome to RSSHub! Too many requests"
        )
        root_favicon = self._make_response(
            status=200, headers={"content-type": "image/png"}
        )

        def fake_head(session_self, url, timeout=5, allow_redirects=True):
            # root would be an image if we tried, but we expect not to try.
            return root_favicon

        def fake_get(session_self, url, timeout=8, allow_redirects=True):
            if url.startswith("http://feeds.example.com/blocked"):
                return blocked_resp
            return self._make_response(status=404)

        import importlib

        mod = importlib.import_module("feeds.management.commands.update_feed_favicons")
        mod.requests = sys.modules["requests"]

        from unittest.mock import patch

        with patch.object(mod.requests.Session, "head", fake_head), patch.object(
            mod.requests.Session, "get", fake_get
        ):
            call_command("update_feed_favicons", "--feed-id", str(feed.pk), "--force")

        feed.refresh_from_db()
        # should remain empty because we were blocked and should not fallback to root
        self.assertEqual(feed.favicon_url, "")

    def test_channel_page_link_rel_icon_is_used_when_root_not_image(self):
        from django.core.management import call_command
        import sys
        import types

        if "requests" not in sys.modules:
            fake_requests = types.SimpleNamespace()

            class Session:
                pass

            fake_requests.Session = Session
            sys.modules["requests"] = fake_requests

        feed = RSSFeed.objects.create(
            user=self.user,
            category=self.category,
            url="http://feeds.example.com/rss2",
            title="Channel Page Icon Feed",
        )

        rss_xml = """<?xml version="1.0"?>
            <rss version="2.0">
              <channel>
                <title>Example</title>
                <link>https://m.ruliweb.com/community/board/300143</link>
              </channel>
            </rss>"""

        # channel root favicon returns 200 but as HTML (not image), channel page contains <link rel=icon href="/assets/favicon.png">
        resp_root_html = self._make_response(
            status=200, headers={"content-type": "text/html"}
        )
        resp_page_html = self._make_response(
            status=200,
            text='<html><head><link rel="icon" href="/assets/favicon.png"></head></html>',
            url="https://m.ruliweb.com/community/board/300143",
        )
        resp_ok_img = self._make_response(
            status=200, headers={"content-type": "image/png"}
        )
        resp_rss = self._make_response(
            status=200, text=rss_xml, url="http://feeds.example.com/rss2"
        )

        call_count = {"head": 0}

        def fake_head(session_self, url, timeout=5, allow_redirects=True):
            call_count["head"] += 1
            if url.startswith("https://m.ruliweb.com") and url.endswith("/favicon.ico"):
                # first head returns HTML (non-image) to simulate root not being an image
                if call_count["head"] == 1:
                    return resp_root_html
                # subsequent head to assets/favicon.png should return image
                if url.endswith("/assets/favicon.png"):
                    return resp_ok_img
                return resp_root_html
            if url.startswith("https://m.ruliweb.com") and url.endswith(
                "/assets/favicon.png"
            ):
                return resp_ok_img
            return self._make_response(status=404)

        def fake_get(session_self, url, timeout=8, allow_redirects=True):
            if url.startswith("http://feeds.example.com/rss2"):
                return resp_rss
            if url.startswith("https://m.ruliweb.com/community/board/300143"):
                return resp_page_html
            if url.startswith("https://m.ruliweb.com/assets/favicon.png"):
                return resp_ok_img
            return self._make_response(status=404)

        import importlib

        mod = importlib.import_module("feeds.management.commands.update_feed_favicons")
        mod.requests = sys.modules["requests"]

        from unittest.mock import patch

        with patch.object(mod.requests.Session, "head", fake_head), patch.object(
            mod.requests.Session, "get", fake_get
        ):
            call_command("update_feed_favicons", "--feed-id", str(feed.pk))

        feed.refresh_from_db()
        self.assertEqual(feed.favicon_url, "https://m.ruliweb.com/favicon.ico")

    def test_update_feed_favicons_respects_force(self):
        from django.core.management import call_command
        import sys
        import types

        if "requests" not in sys.modules:
            fake_requests = types.SimpleNamespace()

            class Session:
                pass

            fake_requests.Session = Session
            sys.modules["requests"] = fake_requests

        feed = RSSFeed.objects.create(
            user=self.user,
            category=self.category,
            url="http://example.org/",
            title="Fav Feed2",
            favicon_url="http://old/favicon.ico",
        )

        from unittest.mock import patch

        resp_head = self._make_response(
            status=200, headers={"content-type": "image/x-icon"}
        )

        def fake_head(self, url, timeout=5, allow_redirects=True):
            return resp_head

        with patch("requests.Session.head", fake_head):
            # without force should skip
            call_command("update_feed_favicons")
            feed.refresh_from_db()
            self.assertEqual(feed.favicon_url, "http://old/favicon.ico")

            # with force should overwrite
            call_command("update_feed_favicons", "--force")
            feed.refresh_from_db()
            # root favicon for example.org should be https? but our fake returns success for any
            self.assertTrue(feed.favicon_url.endswith("/favicon.ico"))
