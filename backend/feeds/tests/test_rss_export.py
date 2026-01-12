# feeds/tests/test_rss_export.py
"""RSS/Atom 피드 공개 내보내기 테스트"""

import uuid
from datetime import timedelta

from asgiref.sync import async_to_sync
from django.test import TestCase
from django.utils import timezone
from ninja.testing import TestAsyncClient

from feeds.models import RSSCategory, RSSFeed, RSSItem
from feeds.routers import item_router
from feeds.tests.conftest import BaseTestCase, unique_guid


class RSSExportPublicTest(TestCase, BaseTestCase):
    """RSS/Atom 피드 공개 내보내기 테스트"""

    def setUp(self) -> None:
        self.user = self.create_user("rssexport")

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

        # 비공개 카테고리 안의 공개 피드
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

        self.api_client = TestAsyncClient(item_router)

    def test_all_items_rss_only_public(self) -> None:
        """/rss 엔드포인트는 공개 카테고리+공개 피드의 아이템만 반환"""
        response = async_to_sync(self.api_client.get)("/rss")
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

    def test_all_items_atom_only_public(self) -> None:
        """/rss?format=atom 엔드포인트도 공개 아이템만 반환"""
        response = async_to_sync(self.api_client.get)("/rss?format=atom")
        self.assertEqual(response.status_code, 200)
        self.assertIn("application/atom+xml", response["Content-Type"])

        content = response.content.decode("utf-8")
        self.assertIn("Public Item", content)
        self.assertNotIn("Private Item", content)

    def test_category_rss_public_category_exists(self) -> None:
        """공개 카테고리의 RSS 엔드포인트는 200 반환"""
        response = async_to_sync(self.api_client.get)(
            f"/category/{self.public_category.id}/rss"
        )
        self.assertEqual(response.status_code, 200)

        content = response.content.decode("utf-8")
        # 공개 피드의 아이템만 포함
        self.assertIn("Public Item", content)
        # 비공개 피드의 아이템은 제외
        self.assertNotIn("Private Feed Item", content)

    def test_category_rss_private_category_404(self) -> None:
        """비공개 카테고리의 RSS 엔드포인트는 404 반환"""
        response = async_to_sync(self.api_client.get)(
            f"/category/{self.private_category.id}/rss"
        )
        self.assertEqual(response.status_code, 404)

    def test_category_rss_nonexistent_404(self) -> None:
        """존재하지 않는 카테고리의 RSS 엔드포인트는 404 반환"""
        response = async_to_sync(self.api_client.get)("/category/99999/rss")
        self.assertEqual(response.status_code, 404)

    def test_feed_rss_public_feed(self) -> None:
        """공개 피드(공개 카테고리 내)의 RSS 엔드포인트는 200 반환"""
        response = async_to_sync(self.api_client.get)(f"/feed/{self.public_feed.id}/rss")
        self.assertEqual(response.status_code, 200)

        content = response.content.decode("utf-8")
        self.assertIn("Public Item", content)

    def test_feed_rss_private_feed_404(self) -> None:
        """비공개 피드의 RSS 엔드포인트는 404 반환"""
        response = async_to_sync(self.api_client.get)(f"/feed/{self.private_feed.id}/rss")
        self.assertEqual(response.status_code, 404)

    def test_feed_rss_public_feed_in_private_category_404(self) -> None:
        """비공개 카테고리 내 공개 피드의 RSS 엔드포인트는 404 반환"""
        response = async_to_sync(self.api_client.get)(
            f"/feed/{self.public_feed_in_private_category.id}/rss"
        )
        self.assertEqual(response.status_code, 404)

    def test_feed_rss_private_feed_in_public_category_404(self) -> None:
        """공개 카테고리 내 비공개 피드의 RSS 엔드포인트는 404 반환"""
        response = async_to_sync(self.api_client.get)(
            f"/feed/{self.private_feed_in_public_category.id}/rss"
        )
        self.assertEqual(response.status_code, 404)

    def test_rss_no_auth_required(self) -> None:
        """RSS 엔드포인트는 인증 없이 접근 가능"""
        # 인증 헤더 없이 요청
        response = async_to_sync(self.api_client.get)("/rss")
        self.assertEqual(response.status_code, 200)

        response = async_to_sync(self.api_client.get)(
            f"/category/{self.public_category.id}/rss"
        )
        self.assertEqual(response.status_code, 200)

        response = async_to_sync(self.api_client.get)(f"/feed/{self.public_feed.id}/rss")
        self.assertEqual(response.status_code, 200)

    def test_rss_pagination(self) -> None:
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
        response = async_to_sync(self.api_client.get)("/rss?page=1&page_size=5")
        self.assertEqual(response.status_code, 200)
        content = response.content.decode("utf-8")
        # 아이템 개수 확인 (최신 5개)
        item_count = content.count("<item>")
        self.assertEqual(item_count, 5)
