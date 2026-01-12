# feeds/tests/test_api.py
"""API 엔드포인트 테스트"""

from django.test import TestCase
from ninja.testing import TestClient

from feeds.models import RSSFeed
from feeds.routers import category_router, feed_router
from feeds.tests.conftest import BaseTestCase, create_auth_headers, get_user_id


class FeedAPITest(TestCase, BaseTestCase):
    """피드 API 테스트"""

    def setUp(self) -> None:
        self.user = self.create_user("feedapi")
        self.category = self.create_category(self.user, "Test Category")
        self.api_client = TestClient(feed_router)
        self.auth_headers = create_auth_headers(get_user_id(self.user))

    def test_list_feeds(self) -> None:
        """피드 목록 조회"""
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

        response = self.api_client.get("", headers=self.auth_headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 2)

    def test_create_feed(self) -> None:
        """피드 생성"""
        data = {
            "category_id": self.category.id,
            "url": "http://example.com/rss",
            "title": "New Feed",
            "description": "New Description",
        }

        response = self.api_client.post("", json=data, headers=self.auth_headers)
        self.assertEqual(response.status_code, 200)

    def test_create_feed_without_title(self) -> None:
        """제목 없이 피드를 생성하면 자동으로 RSS에서 제목을 추출해야 함"""
        data = {
            "category_id": self.category.id,
            "url": "http://example.com/rss",
            "description": "Test Description",
        }

        response = self.api_client.post("", json=data, headers=self.auth_headers)
        self.assertEqual(response.status_code, 200)

        # Check that feed was created
        feed_data = response.json()
        self.assertIn("id", feed_data)
        feed = RSSFeed.objects.get(id=feed_data["id"])
        self.assertEqual(feed.user, self.user)


class CategoryUpdateTest(TestCase, BaseTestCase):
    """Category 수정 API 테스트"""

    def setUp(self) -> None:
        self.user = self.create_user("catuser")
        self.category = self.create_category(self.user, "Original Name")
        self.api_client = TestClient(category_router)
        self.headers = create_auth_headers(get_user_id(self.user))

    def test_update_category_name(self) -> None:
        """카테고리 이름만 수정"""
        response = self.api_client.put(
            f"/{self.category.id}",
            json={"name": "Updated Name"},
            headers=self.headers,
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["name"], "Updated Name")
        self.assertEqual(data["description"], "Test Description")
        self.assertTrue(data["visible"])

    def test_update_category_visible(self) -> None:
        """카테고리 visible만 수정"""
        response = self.api_client.put(
            f"/{self.category.id}",
            json={"visible": False},
            headers=self.headers,
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["name"], "Original Name")
        self.assertFalse(data["visible"])

    def test_update_category_all_fields(self) -> None:
        """카테고리 모든 필드 수정"""
        response = self.api_client.put(
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
