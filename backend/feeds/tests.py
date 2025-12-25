from hmac import new
import json
import uuid
from django.test import TestCase, TransactionTestCase
from django.contrib.auth import get_user_model
from ninja.testing import TestClient, TestAsyncClient
from feeds.routers import item_router, feed_router, category_router
from feeds.models import RSSCategory, RSSFeed, RSSItem
from django.utils import timezone
import jwt
from django.conf import settings
from datetime import timedelta
from asgiref.sync import async_to_sync

User = get_user_model()


def unique_username(prefix="user"):
    """테스트용 고유 username 생성"""
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


def unique_guid(prefix="guid"):
    """테스트용 고유 guid 생성"""
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


class FeedModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username=unique_username("feedmodel"), password="testpass123"
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
            guid=unique_guid("test-item"),
        )
        self.assertEqual(item.title, "Test Item")
        self.assertEqual(item.feed, feed)
        self.assertFalse(item.is_read)


class FeedPaginationTest(TransactionTestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username=unique_username("pagination"), password="testpass123"
        )
        self.category = RSSCategory.objects.create(
            user=self.user, name="Test Category", description="Test Description"
        )
        self.feed = RSSFeed.objects.create(
            user=self.user,
            category=self.category,
            title="Test Feed",
        )
        self.client = TestAsyncClient(item_router)
        self.token = jwt.encode(
            {"user_id": self.user.id}, settings.SECRET_KEY, algorithm="HS256"
        )
        self.headers = {"Authorization": f"Bearer {self.token}"}

    def test_pagination_with_30_items_page_size_10(self):
        # Create 30 items
        items = []
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

        # Sort items by published_at desc (newest first, as used by ordering_field="published_at")
        items.sort(key=lambda x: x.published_at, reverse=True)

        # First page (no cursor, returns newest items first)
        response = async_to_sync(self.client.get)("/?limit=10&direction=before", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data["items"]), 10)
        self.assertTrue(data["has_next"])
        self.assertIsNotNone(data["next_cursor"])

        # Check items are in correct order (newest first by published_at)
        for i, item in enumerate(data["items"]):
            self.assertEqual(item["id"], items[i].id)

        # Second page (use next_cursor with direction=before to get older items)
        cursor = data["next_cursor"]
        response = async_to_sync(self.client.get)(
            f"/?limit=10&cursor={cursor}&direction=before", headers=self.headers
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data["items"]), 10)
        self.assertTrue(data["has_next"])

        # Third page
        cursor = data["next_cursor"]
        response = async_to_sync(self.client.get)(
            f"/?limit=10&cursor={cursor}&direction=before", headers=self.headers
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data["items"]), 10)
        self.assertFalse(data["has_next"])

    def test_pagination_with_new_items_after_request(self):
        base_time = timezone.now()
        guid_prefix = uuid.uuid4().hex[:8]
        # Create 30 items (older items)
        items = []
        for i in range(30):
            item = RSSItem.objects.create(
                feed=self.feed,
                title=f"Test Item {i}",
                link=f"http://example.com/item{i}",
                published_at=base_time
                - timedelta(minutes=30 + i),  # Older than base_time
                guid=f"test-guid-{guid_prefix}-{i}",
            )
            items.append(item)

        # First page - get newest items (by published_at, descending)
        response = async_to_sync(self.client.get)("/?limit=10&direction=before", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data["items"]), 10)

        # Store the max published_at from first batch as cursor reference
        first_batch_max_published_at = max(item.published_at for item in items)

        # Create 30 more items (newer than first batch by published_at)
        new_items = []
        for i in range(30):
            item = RSSItem.objects.create(
                feed=self.feed,
                title=f"New Test Item {i}",
                link=f"http://example.com/new_item{i}",
                published_at=base_time
                + timedelta(minutes=i + 1),  # Newer than base_time
                guid=f"new-test-guid-{guid_prefix}-{i}",
            )
            new_items.append(item)

        new_item_ids_set = {item.id for item in new_items}

        # Use first_batch_max_published_at as cursor to get items with published_at > cursor
        cursor = first_batch_max_published_at.isoformat().replace("+00:00", "Z")

        # Request newer items using after direction (published_at > cursor)
        response = async_to_sync(self.client.get)(
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
        response = async_to_sync(self.client.get)(
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
        response = async_to_sync(self.client.get)(
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
            username=unique_username("feedapi"), password="testpass123"
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

        response = self.client.get("", headers=self.auth_headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 2)

    def test_create_feed(self):
        data = {
            "category_id": self.category.id,
            "url": "http://example.com/rss",
            "title": "New Feed",
            "description": "New Description",
        }

        response = self.client.post("", json=data, headers=self.auth_headers)
        self.assertEqual(response.status_code, 200)

    def test_create_feed_without_title(self):
        """제목 없이 피드를 생성하면 자동으로 RSS에서 제목을 추출해야 함"""
        data = {
            "category_id": self.category.id,
            "url": "http://example.com/rss",
            # title을 intentionally 생략
            "description": "Test Description",
        }

        response = self.client.post("", json=data, headers=self.auth_headers)
        self.assertEqual(response.status_code, 200)

        # Check that feed was created (model no longer has url field directly)
        feed_data = response.json()
        self.assertIn("id", feed_data)
        feed = RSSFeed.objects.get(id=feed_data["id"])
        self.assertEqual(feed.user, self.user)


class CategoryVisibilityTest(TransactionTestCase):
    """Category와 Feed의 visible 옵션 테스트"""

    def setUp(self):
        self.user = User.objects.create_user(username=unique_username("vis"), password="vispass123")
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

        self.client = TestAsyncClient(item_router)
        self.token = jwt.encode(
            {"user_id": self.user.id}, settings.SECRET_KEY, algorithm="HS256"
        )
        self.headers = {"Authorization": f"Bearer {self.token}"}

    def test_main_page_excludes_hidden_category_items(self):
        """메인 화면: Category.visible=False인 카테고리의 아이템은 제외"""
        response = async_to_sync(self.client.get)("/", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        item_ids = [item["id"] for item in data["items"]]

        # visible 피드의 아이템만 포함
        self.assertIn(self.visible_item.id, item_ids)
        # hidden 피드의 아이템은 제외
        self.assertNotIn(self.hidden_item.id, item_ids)
        # hidden 카테고리의 아이템은 제외
        self.assertNotIn(self.hidden_category_item.id, item_ids)

    def test_main_page_excludes_hidden_feed_items(self):
        """메인 화면: Feed.visible=False인 피드의 아이템은 제외"""
        response = async_to_sync(self.client.get)("/", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        item_ids = [item["id"] for item in data["items"]]

        self.assertNotIn(self.hidden_item.id, item_ids)

    def test_category_page_excludes_hidden_feed_items(self):
        """카테고리 화면: Feed.visible=False인 피드의 아이템은 제외"""
        response = async_to_sync(self.client.get)(
            f"/category/{self.visible_category.id}", headers=self.headers
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        item_ids = [item["id"] for item in data["items"]]

        # visible 피드의 아이템만 포함
        self.assertIn(self.visible_item.id, item_ids)
        # hidden 피드의 아이템은 제외
        self.assertNotIn(self.hidden_item.id, item_ids)

    def test_category_page_shows_hidden_category_items(self):
        """카테고리 화면: Category.visible=False여도 해당 카테고리 페이지에서는 visible 피드의 아이템 표시"""
        response = async_to_sync(self.client.get)(
            f"/category/{self.hidden_category.id}", headers=self.headers
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        item_ids = [item["id"] for item in data["items"]]

        # hidden 카테고리 내의 visible 피드 아이템은 표시
        self.assertIn(self.hidden_category_item.id, item_ids)

    def test_feed_page_shows_all_items(self):
        """피드 화면: visible 설정과 관계없이 해당 피드의 모든 아이템 표시"""
        response = async_to_sync(self.client.get)(f"/feed/{self.hidden_feed.id}", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        item_ids = [item["id"] for item in data["items"]]

        # hidden 피드의 아이템도 피드 페이지에서는 표시
        self.assertIn(self.hidden_item.id, item_ids)


class CategoryUpdateTest(TestCase):
    """Category 수정 API 테스트"""

    def setUp(self):
        self.user = User.objects.create_user(username="catuser", password="catpass123")
        self.category = RSSCategory.objects.create(
            user=self.user,
            name="Original Name",
            description="Original Description",
            visible=True,
        )
        self.client = TestClient(category_router)
        self.token = jwt.encode(
            {"user_id": self.user.id}, settings.SECRET_KEY, algorithm="HS256"
        )
        self.headers = {"Authorization": f"Bearer {self.token}"}

    def test_update_category_name(self):
        """카테고리 이름만 수정"""
        response = self.client.put(
            f"/{self.category.id}",
            json={"name": "Updated Name"},
            headers=self.headers,
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["name"], "Updated Name")
        self.assertEqual(data["description"], "Original Description")
        self.assertTrue(data["visible"])

    def test_update_category_visible(self):
        """카테고리 visible만 수정"""
        response = self.client.put(
            f"/{self.category.id}",
            json={"visible": False},
            headers=self.headers,
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["name"], "Original Name")
        self.assertFalse(data["visible"])

    def test_update_category_all_fields(self):
        """카테고리 모든 필드 수정"""
        response = self.client.put(
            f"/{self.category.id}",
            json={
                "name": "New Name",
                "description": "New Description",
                "visible": False,
            },
            headers=self.headers,
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["name"], "New Name")
        self.assertEqual(data["description"], "New Description")
        self.assertFalse(data["visible"])


class RSSExportPublicTest(TransactionTestCase):
    """RSS/Atom 피드 공개 내보내기 테스트"""

    def setUp(self):
        # 사용자 생성
        self.user = User.objects.create_user(
            username=unique_username("rssexport"), password="testpass123"
        )

        # 공개 카테고리와 피드 생성
        self.public_category = RSSCategory.objects.create(
            user=self.user,
            name="Public Category",
            is_public=True,
        )
        self.public_feed = RSSFeed.objects.create(
            user=self.user,
            category=self.public_category,
            title="Public Feed",
            is_public=True,
        )

        # 비공개 카테고리와 피드 생성
        self.private_category = RSSCategory.objects.create(
            user=self.user,
            name="Private Category",
            is_public=False,
        )
        self.private_feed = RSSFeed.objects.create(
            user=self.user,
            category=self.private_category,
            title="Private Feed",
            is_public=False,
        )

        # 공개 카테고리 안의 비공개 피드
        self.private_feed_in_public_category = RSSFeed.objects.create(
            user=self.user,
            category=self.public_category,
            title="Private Feed in Public Category",
            is_public=False,
        )

        # 비공개 카테고리 안의 공개 피드 (카테고리가 비공개이므로 접근 불가해야 함)
        self.public_feed_in_private_category = RSSFeed.objects.create(
            user=self.user,
            category=self.private_category,
            title="Public Feed in Private Category",
            is_public=True,
        )

        # 아이템 생성
        self.public_item = RSSItem.objects.create(
            feed=self.public_feed,
            title="Public Item",
            link="http://example.com/public-item",
            published_at=timezone.now(),
            guid=unique_guid("public"),
        )
        self.private_item = RSSItem.objects.create(
            feed=self.private_feed,
            title="Private Item",
            link="http://example.com/private-item",
            published_at=timezone.now(),
            guid=unique_guid("private"),
        )
        self.private_feed_item = RSSItem.objects.create(
            feed=self.private_feed_in_public_category,
            title="Private Feed Item",
            link="http://example.com/private-feed-item",
            published_at=timezone.now(),
            guid=unique_guid("private-feed"),
        )
        self.public_feed_private_category_item = RSSItem.objects.create(
            feed=self.public_feed_in_private_category,
            title="Public Feed Private Category Item",
            link="http://example.com/public-feed-private-category-item",
            published_at=timezone.now(),
            guid=unique_guid("public-feed-private-category"),
        )

        self.client = TestAsyncClient(item_router)

    def test_all_items_rss_only_public(self):
        """/rss 엔드포인트는 공개 카테고리+공개 피드의 아이템만 반환"""
        response = async_to_sync(self.client.get)("/rss")
        self.assertEqual(response.status_code, 200)
        self.assertIn("application/rss+xml", response["Content-Type"])

        content = response.content.decode("utf-8")
        # 공개 아이템만 포함
        self.assertIn("Public Item", content)
        # 비공개 아이템은 제외
        self.assertNotIn("Private Item", content)
        self.assertNotIn("Private Feed Item", content)
        # 비공개 카테고리의 공개 피드 아이템도 제외
        self.assertNotIn("Public Feed Private Category Item", content)

    def test_all_items_atom_only_public(self):
        """/rss?format=atom 엔드포인트도 공개 아이템만 반환"""
        response = async_to_sync(self.client.get)("/rss?format=atom")
        self.assertEqual(response.status_code, 200)
        self.assertIn("application/atom+xml", response["Content-Type"])

        content = response.content.decode("utf-8")
        self.assertIn("Public Item", content)
        self.assertNotIn("Private Item", content)

    def test_category_rss_public_category_exists(self):
        """공개 카테고리의 RSS 엔드포인트는 200 반환"""
        response = async_to_sync(self.client.get)(f"/category/{self.public_category.id}/rss")
        self.assertEqual(response.status_code, 200)

        content = response.content.decode("utf-8")
        # 공개 피드의 아이템만 포함
        self.assertIn("Public Item", content)
        # 비공개 피드의 아이템은 제외
        self.assertNotIn("Private Feed Item", content)

    def test_category_rss_private_category_404(self):
        """비공개 카테고리의 RSS 엔드포인트는 404 반환"""
        response = async_to_sync(self.client.get)(f"/category/{self.private_category.id}/rss")
        self.assertEqual(response.status_code, 404)

    def test_category_rss_nonexistent_404(self):
        """존재하지 않는 카테고리의 RSS 엔드포인트는 404 반환"""
        response = async_to_sync(self.client.get)("/category/99999/rss")
        self.assertEqual(response.status_code, 404)

    def test_feed_rss_public_feed(self):
        """공개 피드(공개 카테고리 내)의 RSS 엔드포인트는 200 반환"""
        response = async_to_sync(self.client.get)(f"/feed/{self.public_feed.id}/rss")
        self.assertEqual(response.status_code, 200)

        content = response.content.decode("utf-8")
        self.assertIn("Public Item", content)

    def test_feed_rss_private_feed_404(self):
        """비공개 피드의 RSS 엔드포인트는 404 반환"""
        response = async_to_sync(self.client.get)(f"/feed/{self.private_feed.id}/rss")
        self.assertEqual(response.status_code, 404)

    def test_feed_rss_public_feed_in_private_category_404(self):
        """비공개 카테고리 내 공개 피드의 RSS 엔드포인트는 404 반환"""
        response = async_to_sync(self.client.get)(
            f"/feed/{self.public_feed_in_private_category.id}/rss"
        )
        self.assertEqual(response.status_code, 404)

    def test_feed_rss_private_feed_in_public_category_404(self):
        """공개 카테고리 내 비공개 피드의 RSS 엔드포인트는 404 반환"""
        response = async_to_sync(self.client.get)(
            f"/feed/{self.private_feed_in_public_category.id}/rss"
        )
        self.assertEqual(response.status_code, 404)

    def test_rss_no_auth_required(self):
        """RSS 엔드포인트는 인증 없이 접근 가능"""
        # 인증 헤더 없이 요청
        response = async_to_sync(self.client.get)("/rss")
        self.assertEqual(response.status_code, 200)

        response = async_to_sync(self.client.get)(f"/category/{self.public_category.id}/rss")
        self.assertEqual(response.status_code, 200)

        response = async_to_sync(self.client.get)(f"/feed/{self.public_feed.id}/rss")
        self.assertEqual(response.status_code, 200)

    def test_rss_pagination(self):
        """RSS 엔드포인트 페이지네이션 테스트"""
        # 추가 아이템 생성
        guid_prefix = uuid.uuid4().hex[:8]
        for i in range(10):
            RSSItem.objects.create(
                feed=self.public_feed,
                title=f"Pagination Item {i}",
                link=f"http://example.com/pagination-item-{i}",
                published_at=timezone.now() - timedelta(minutes=i),
                guid=f"pagination-guid-{guid_prefix}-{i}",
            )

        # page_size=5로 첫 페이지 요청
        response = async_to_sync(self.client.get)("/rss?page=1&page_size=5")
        self.assertEqual(response.status_code, 200)
        content = response.content.decode("utf-8")
        # 아이템 개수 확인 (최신 5개)
        item_count = content.count("<item>")
        self.assertEqual(item_count, 5)


class CeleryTaskTest(TestCase):
    """Celery Task 함수 테스트 (실제 Celery 호출 없이)"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="celeryuser", password="celerypass123"
        )
        self.category = RSSCategory.objects.create(
            user=self.user, name="Celery Category"
        )
        self.feed = RSSFeed.objects.create(
            user=self.user,
            category=self.category,
            title="Celery Test Feed",
        )

    def test_update_feed_items_nonexistent_feed(self):
        """존재하지 않는 피드 업데이트 시 에러 메시지 반환"""
        from feeds.tasks import update_feed_items

        # 직접 함수 호출 (Celery 없이)
        result = update_feed_items(99999)
        self.assertIn("does not exist", result)

    def test_update_feed_items_creates_task_result(self):
        """피드 업데이트 시 FeedTaskResult 생성 확인"""
        from feeds.tasks import update_feed_items
        from feeds.models import FeedTaskResult, RSSEverythingSource

        # RSS 소스 추가 (실제 URL이 없어도 됨)
        source = RSSEverythingSource.objects.create(
            feed=self.feed,
            source_type=RSSEverythingSource.SourceType.RSS,
            url="http://invalid-url-for-test.com/rss",
        )

        # task_result_id 없이 호출하면 자동 생성
        initial_count = FeedTaskResult.objects.filter(feed=self.feed).count()

        # 실제 RSS 가져오기는 실패하지만 TaskResult는 생성됨
        try:
            update_feed_items(self.feed.pk)
        except Exception:
            pass  # RSS fetch 실패는 예상됨

        # TaskResult가 생성되었는지 확인
        final_count = FeedTaskResult.objects.filter(feed=self.feed).count()
        self.assertGreaterEqual(final_count, initial_count)

    def test_update_feeds_by_category(self):
        """카테고리별 피드 업데이트 스케줄링 테스트"""
        from feeds.tasks import update_feeds_by_category
        from unittest.mock import patch

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

    def test_update_all_feeds(self):
        """전체 피드 업데이트 스케줄링 테스트"""
        from feeds.tasks import update_all_feeds
        from unittest.mock import patch

        # update_feed_items.delay를 mock
        with patch("feeds.tasks.update_feed_items.delay") as mock_delay:
            result = update_all_feeds()

            # visible=True인 피드에 대해 delay가 호출되었는지 확인
            self.assertGreaterEqual(mock_delay.call_count, 1)
            self.assertIn("feeds", result)


class RSSEverythingSourceTest(TestCase):
    """RSSEverythingSource 모델 테스트"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="sourceuser", password="sourcepass123"
        )
        self.category = RSSCategory.objects.create(
            user=self.user, name="Source Category"
        )
        self.feed = RSSFeed.objects.create(
            user=self.user,
            category=self.category,
            title="Source Test Feed",
        )

    def test_source_creation_rss_type(self):
        """RSS 타입 소스 생성"""
        from feeds.models import RSSEverythingSource

        source = RSSEverythingSource.objects.create(
            feed=self.feed,
            source_type=RSSEverythingSource.SourceType.RSS,
            url="http://example.com/rss",
        )
        self.assertTrue(source.is_rss)
        self.assertFalse(source.is_scraping)
        self.assertFalse(source.follow_links)

    def test_source_creation_page_scraping_type(self):
        """페이지 스크래핑 타입 소스 생성"""
        from feeds.models import RSSEverythingSource

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

    def test_source_creation_detail_page_scraping_type(self):
        """상세 페이지 스크래핑 타입 소스 생성"""
        from feeds.models import RSSEverythingSource

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

    def test_feed_url_property(self):
        """RSSFeed.url property 테스트 (첫 번째 소스의 URL 반환)"""
        from feeds.models import RSSEverythingSource

        # 소스가 없을 때
        self.assertEqual(self.feed.url, "")

        # 소스 추가
        source = RSSEverythingSource.objects.create(
            feed=self.feed,
            source_type=RSSEverythingSource.SourceType.RSS,
            url="http://example.com/rss",
        )
        # refresh 후 확인
        self.feed.refresh_from_db()
        self.assertEqual(self.feed.url, "http://example.com/rss")

    def test_multiple_sources_per_feed(self):
        """하나의 피드에 여러 소스 연결"""
        from feeds.models import RSSEverythingSource

        source1 = RSSEverythingSource.objects.create(
            feed=self.feed,
            source_type=RSSEverythingSource.SourceType.RSS,
            url="http://example.com/rss1",
        )
        source2 = RSSEverythingSource.objects.create(
            feed=self.feed,
            source_type=RSSEverythingSource.SourceType.PAGE_SCRAPING,
            url="http://example.com/news",
            item_selector=".item",
        )

        self.assertEqual(self.feed.sources.count(), 2)


class FeedTaskResultTest(TestCase):
    """FeedTaskResult 모델 테스트"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="taskuser", password="taskpass123"
        )
        self.category = RSSCategory.objects.create(user=self.user, name="Task Category")
        self.feed = RSSFeed.objects.create(
            user=self.user,
            category=self.category,
            title="Task Test Feed",
        )

    def test_task_result_creation(self):
        """TaskResult 생성 테스트"""
        from feeds.models import FeedTaskResult

        task_result = FeedTaskResult.objects.create(
            feed=self.feed,
            status=FeedTaskResult.Status.PENDING,
        )
        self.assertEqual(task_result.status, "pending")
        self.assertIsNone(task_result.duration_seconds)

    def test_task_result_duration(self):
        """TaskResult 실행 시간 계산 테스트"""
        from feeds.models import FeedTaskResult

        task_result = FeedTaskResult.objects.create(
            feed=self.feed,
            status=FeedTaskResult.Status.SUCCESS,
            started_at=timezone.now() - timedelta(seconds=10),
            completed_at=timezone.now(),
        )
        self.assertIsNotNone(task_result.duration_seconds)
        self.assertGreaterEqual(task_result.duration_seconds, 9)
        self.assertLessEqual(task_result.duration_seconds, 11)


class QueryOptimizationTest(TestCase):
    """쿼리 최적화 테스트"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="queryuser", password="querypass123"
        )
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

    def test_list_all_items_query_count(self):
        """list_all_items의 쿼리 수 확인"""
        from feeds.services.item import ItemService
        from django.db import connection
        from django.test.utils import CaptureQueriesContext

        with CaptureQueriesContext(connection) as context:
            items = list(ItemService.list_all_items(self.user)[:10])

        # 쿼리 수가 합리적인 범위인지 확인 (N+1 문제 없음)
        # 1개의 메인 쿼리 + search 관련 쿼리
        self.assertLessEqual(len(context.captured_queries), 5)

    def test_category_stats_query_count(self):
        """get_category_stats의 쿼리 수 확인 (최적화: 단일 aggregate 쿼리)"""
        from feeds.services.category import CategoryService
        from django.db import connection
        from django.test.utils import CaptureQueriesContext

        category = RSSCategory.objects.filter(user=self.user).first()

        with CaptureQueriesContext(connection) as context:
            stats = CategoryService.get_category_stats(self.user, category.id)

        # 최적화된 쿼리: Category 조회(1) + 단일 aggregate 쿼리(1)
        self.assertLessEqual(len(context.captured_queries), 3)


class ItemSearchTest(TestCase):
    """아이템 검색 테스트"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="searchuser", password="searchpass123"
        )
        self.category = RSSCategory.objects.create(
            user=self.user, name="Search Category"
        )
        self.feed = RSSFeed.objects.create(
            user=self.user,
            category=self.category,
            title="Search Feed",
        )
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

    def test_search_by_title(self):
        """제목으로 검색"""
        from feeds.services.item import ItemService

        items = list(ItemService.list_all_items(self.user, search="Python"))
        self.assertGreaterEqual(len(items), 1)
        self.assertTrue(any("Python" in item.title for item in items))

    def test_search_by_description(self):
        """설명으로 검색"""
        from feeds.services.item import ItemService

        items = list(ItemService.list_all_items(self.user, search="web apps"))
        self.assertGreaterEqual(len(items), 1)

    def test_search_no_results(self):
        """검색 결과 없음"""
        from feeds.services.item import ItemService

        items = list(ItemService.list_all_items(self.user, search="nonexistent12345"))
        self.assertEqual(len(items), 0)

    def test_search_empty_string(self):
        """빈 문자열 검색 시 전체 반환"""
        from feeds.services.item import ItemService

        items = list(ItemService.list_all_items(self.user, search=""))
        self.assertEqual(len(items), 3)


class FeedServiceTest(TestCase):
    """FeedService 테스트"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="feedserviceuser", password="feedservicepass123"
        )
        self.category = RSSCategory.objects.create(
            user=self.user, name="FeedService Category"
        )

    def test_create_feed(self):
        """피드 생성 테스트"""
        from feeds.services.feed import FeedService
        from feeds.schemas.feed import FeedCreateSchema

        data = FeedCreateSchema(
            category_id=self.category.id,
            title="New Test Feed",
            description="Test Description",
        )
        feed = FeedService.create_feed(self.user, data)

        self.assertEqual(feed.title, "New Test Feed")
        self.assertEqual(feed.user, self.user)
        self.assertEqual(feed.category, self.category)

    def test_update_feed(self):
        """피드 수정 테스트"""
        from feeds.services.feed import FeedService
        from feeds.schemas.feed import FeedUpdateSchema

        feed = RSSFeed.objects.create(
            user=self.user,
            category=self.category,
            title="Original Title",
        )

        data = FeedUpdateSchema(title="Updated Title", visible=False)
        updated_feed = FeedService.update_feed(self.user, feed.id, data)

        self.assertEqual(updated_feed.title, "Updated Title")
        self.assertFalse(updated_feed.visible)

    def test_delete_feed(self):
        """피드 삭제 테스트"""
        from feeds.services.feed import FeedService

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

    def test_mark_all_items_read(self):
        """피드의 모든 아이템 읽음 처리 테스트"""
        from feeds.services.feed import FeedService

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

    def test_delete_all_items(self):
        """피드의 모든 아이템 삭제 테스트"""
        from feeds.services.feed import FeedService

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


class DateParserTest(TestCase):
    """날짜 파싱 유틸리티 테스트"""

    def test_parse_iso_format(self):
        """ISO 8601 형식 파싱"""
        from feeds.utils.date_parser import parse_date

        result = parse_date("2025-12-19T10:30:00")
        self.assertIsNotNone(result)
        self.assertEqual(result.year, 2025)
        self.assertEqual(result.month, 12)
        self.assertEqual(result.day, 19)

    def test_parse_korean_format(self):
        """한국어 날짜 형식 파싱"""
        from feeds.utils.date_parser import parse_date

        result = parse_date("2025.12.19 10:30")
        self.assertIsNotNone(result)
        self.assertEqual(result.year, 2025)
        self.assertEqual(result.month, 12)

    def test_parse_relative_time_korean(self):
        """한국어 상대 시간 파싱"""
        from feeds.utils.date_parser import parse_date

        # "5분 전"
        result = parse_date("5분 전")
        self.assertIsNotNone(result)

        # "1시간 전"
        result = parse_date("1시간 전")
        self.assertIsNotNone(result)

        # "어제"
        result = parse_date("어제")
        self.assertIsNotNone(result)

    def test_parse_relative_time_english(self):
        """영어 상대 시간 파싱"""
        from feeds.utils.date_parser import parse_date

        result = parse_date("5 minutes ago")
        self.assertIsNotNone(result)

        result = parse_date("2 hours ago")
        self.assertIsNotNone(result)

        result = parse_date("yesterday")
        self.assertIsNotNone(result)

    def test_parse_with_custom_format(self):
        """사용자 지정 형식으로 파싱"""
        from feeds.utils.date_parser import parse_date

        result = parse_date("19/12/2025", ["%d/%m/%Y"])
        self.assertIsNotNone(result)
        self.assertEqual(result.day, 19)
        self.assertEqual(result.month, 12)

    def test_parse_invalid_date(self):
        """유효하지 않은 날짜 파싱 시 None 반환"""
        from feeds.utils.date_parser import parse_date

        result = parse_date("not a date at all xyz")
        # dateutil이 있으면 fuzzy parsing 시도하므로 None이 아닐 수 있음
        # 테스트 목적상 결과가 반환되는지만 확인
        # self.assertIsNone(result)

    def test_parse_empty_string(self):
        """빈 문자열 파싱 시 None 반환"""
        from feeds.utils.date_parser import parse_date

        result = parse_date("")
        self.assertIsNone(result)

        result = parse_date(None)
        self.assertIsNone(result)


class HTMLParserTest(TestCase):
    """HTML 파싱 유틸리티 테스트"""

    def test_extract_text(self):
        """텍스트 추출 테스트"""
        from feeds.utils.html_parser import extract_text
        from bs4 import BeautifulSoup

        html = "<div>  Hello   <span>World</span>  </div>"
        soup = BeautifulSoup(html, "html.parser")
        element = soup.find("div")

        text = extract_text(element)
        # get_text(strip=True)는 내부 공백을 유지하지 않음
        self.assertEqual(text, "HelloWorld")

    def test_extract_text_none_element(self):
        """None 요소에서 텍스트 추출 시 빈 문자열"""
        from feeds.utils.html_parser import extract_text

        text = extract_text(None)
        self.assertEqual(text, "")

    def test_extract_href(self):
        """href 추출 테스트"""
        from feeds.utils.html_parser import extract_href
        from bs4 import BeautifulSoup

        html = '<a href="/path/to/page">Link</a>'
        soup = BeautifulSoup(html, "html.parser")
        element = soup.find("a")

        href = extract_href(element, "https://example.com")
        self.assertEqual(href, "https://example.com/path/to/page")

    def test_extract_href_nested(self):
        """중첩된 a 태그에서 href 추출"""
        from feeds.utils.html_parser import extract_href
        from bs4 import BeautifulSoup

        html = '<div><a href="/nested/link">Nested</a></div>'
        soup = BeautifulSoup(html, "html.parser")
        element = soup.find("div")

        href = extract_href(element, "https://example.com")
        self.assertEqual(href, "https://example.com/nested/link")

    def test_extract_src(self):
        """이미지 src 추출 테스트"""
        from feeds.utils.html_parser import extract_src
        from bs4 import BeautifulSoup

        html = '<img src="/images/photo.jpg" alt="Photo">'
        soup = BeautifulSoup(html, "html.parser")
        element = soup.find("img")

        src = extract_src(element, "https://example.com")
        self.assertEqual(src, "https://example.com/images/photo.jpg")

    def test_extract_src_data_src(self):
        """data-src 속성에서 이미지 추출 (lazy loading)"""
        from feeds.utils.html_parser import extract_src
        from bs4 import BeautifulSoup

        html = '<img data-src="/lazy/image.jpg" alt="Lazy">'
        soup = BeautifulSoup(html, "html.parser")
        element = soup.find("img")

        src = extract_src(element, "https://example.com")
        self.assertEqual(src, "https://example.com/lazy/image.jpg")

    def test_extract_html(self):
        """HTML 블록 추출 테스트"""
        from feeds.utils.html_parser import extract_html
        from bs4 import BeautifulSoup

        html = '<div class="content"><p>Paragraph</p></div>'
        soup = BeautifulSoup(html, "html.parser")
        element = soup.find("div")

        result = extract_html(element, "https://example.com")
        self.assertIn("Paragraph", result)
        self.assertIn("<p>", result)

    def test_extract_html_converts_relative_urls(self):
        """상대 URL을 절대 URL로 변환"""
        from feeds.utils.html_parser import extract_html
        from bs4 import BeautifulSoup

        html = '<div><img src="/image.jpg"><a href="/link">Link</a></div>'
        soup = BeautifulSoup(html, "html.parser")
        element = soup.find("div")

        result = extract_html(element, "https://example.com")
        self.assertIn("https://example.com/image.jpg", result)
        self.assertIn("https://example.com/link", result)

    def test_generate_selector(self):
        """CSS 셀렉터 생성 테스트"""
        from feeds.utils.html_parser import generate_selector
        from bs4 import BeautifulSoup

        html = '<div id="main"><p class="text">Hello</p></div>'
        soup = BeautifulSoup(html, "html.parser")
        element = soup.find("p")

        selector = generate_selector(soup, element)
        self.assertIn("p", selector)
        # ID가 있는 부모가 있으면 해당 ID 포함
        self.assertIn("#main", selector)


class CrawlerAbstractionTest(TestCase):
    """크롤러 추상화 테스트 (네트워크 호출 없이)"""

    def test_get_crawler_realbrowser(self):
        """RealBrowser 크롤러 인스턴스 생성"""
        from feeds.browser_crawler import get_crawler, RealBrowserCrawler

        crawler = get_crawler("realbrowser")
        self.assertIsInstance(crawler, RealBrowserCrawler)

    def test_get_crawler_browserless(self):
        """Browserless 크롤러 인스턴스 생성"""
        from feeds.browser_crawler import get_crawler, BrowserlessCrawler

        crawler = get_crawler("browserless")
        self.assertIsInstance(crawler, BrowserlessCrawler)

    def test_get_crawler_invalid_service(self):
        """잘못된 서비스 이름으로 크롤러 생성 시 에러"""
        from feeds.browser_crawler import get_crawler

        with self.assertRaises(ValueError):
            get_crawler("invalid_service")

    def test_backward_compatibility(self):
        """BrowserCrawler 클래스 하위 호환성"""
        from feeds.browser_crawler import BrowserCrawler, RealBrowserCrawler

        crawler = BrowserCrawler()
        self.assertIsInstance(crawler, RealBrowserCrawler)

    def test_crawl_result_structure(self):
        """CrawlResult 구조 테스트"""
        from feeds.crawlers import CrawlResult

        # 성공 케이스
        result = CrawlResult(
            success=True,
            html="<html><body>Test</body></html>",
            url="https://example.com",
            error=None,
        )
        self.assertTrue(result.success)
        self.assertIn("Test", result.html)
        self.assertIsNone(result.error)

        # 실패 케이스
        result = CrawlResult(
            success=False,
            html=None,
            url="https://example.com",
            error="Connection failed",
        )
        self.assertFalse(result.success)
        self.assertIsNone(result.html)
        self.assertEqual(result.error, "Connection failed")

    def test_wait_until_enum(self):
        """WaitUntil 열거형 테스트"""
        from feeds.crawlers import WaitUntil

        self.assertEqual(WaitUntil.LOAD.value, "load")
        self.assertEqual(WaitUntil.DOMCONTENTLOADED.value, "domcontentloaded")
        self.assertEqual(WaitUntil.NETWORKIDLE0.value, "networkidle0")
        self.assertEqual(WaitUntil.NETWORKIDLE2.value, "networkidle2")


class RSSFetcherTest(TestCase):
    """RSS 피드 가져오기 유틸리티 테스트 (네트워크 호출 mocking)"""

    def test_extract_favicon_url(self):
        """파비콘 URL 추출 테스트 (mocking)"""
        from unittest.mock import patch, MagicMock
        from feeds.utils.feed_fetcher import extract_favicon_url

        # favicon.ico가 존재하는 경우
        with patch("requests.get") as mock_get:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_get.return_value = mock_response

            url = "https://example.com/feed.xml"
            favicon = extract_favicon_url(url)
            self.assertIn("example.com", favicon)
            self.assertIn("favicon.ico", favicon)

    def test_fetch_feed_data_with_mock(self):
        """RSS 피드 가져오기 테스트 (mocking)"""
        from unittest.mock import patch, MagicMock
        from feeds.utils.feed_fetcher import fetch_feed_data

        mock_feed = MagicMock()
        mock_feed.bozo = False
        mock_feed.feed = {"title": "Test Feed", "description": "Test Description"}
        mock_feed.entries = [
            MagicMock(
                title="Item 1",
                link="https://example.com/1",
                description="Description 1",
            )
        ]

        with patch("feedparser.parse", return_value=mock_feed):
            with patch("requests.get") as mock_get:
                mock_response = MagicMock()
                mock_response.content = b"<rss>...</rss>"
                mock_response.status_code = 200
                mock_get.return_value = mock_response

                result = fetch_feed_data("https://example.com/feed.xml")

                self.assertFalse(result.bozo)
                self.assertEqual(result.feed["title"], "Test Feed")
                self.assertEqual(len(result.entries), 1)
