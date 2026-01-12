# feeds/tests/conftest.py
"""테스트 공통 유틸리티 및 fixture"""

from __future__ import annotations

import uuid
from datetime import timedelta
from typing import TYPE_CHECKING, cast

import jwt
from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from ninja.testing import TestAsyncClient, TestClient

from feeds.models import RSSCategory, RSSFeed, RSSItem
from feeds.routers import category_router, feed_router, item_router

if TYPE_CHECKING:
    from django.contrib.auth.models import AbstractBaseUser

User = get_user_model()


def unique_username(prefix: str = "user") -> str:
    """테스트용 고유 username 생성"""
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


def unique_guid(prefix: str = "guid") -> str:
    """테스트용 고유 guid 생성"""
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


def create_jwt_token(user_id: int) -> str:
    """JWT 토큰 생성"""
    payload = {"user_id": user_id}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


def create_auth_headers(user_id: int) -> dict[str, str]:
    """인증 헤더 생성"""
    token = create_jwt_token(user_id)
    return {"Authorization": f"Bearer {token}"}


class BaseTestCase:
    """테스트 기본 클래스"""

    @classmethod
    def create_user(cls, username_prefix: str = "user", password: str = "testpass123") -> AbstractBaseUser:
        """테스트 유저 생성"""
        return User.objects.create_user(
            username=unique_username(username_prefix),
            password=password,
        )

    @classmethod
    def create_category(
        cls,
        user: AbstractBaseUser,
        name: str = "Test Category",
        visible: bool = True,
        is_public: bool = False,
    ) -> RSSCategory:
        """테스트 카테고리 생성"""
        return RSSCategory.objects.create(
            user=user,
            name=name,
            description="Test Description",
            visible=visible,
            is_public=is_public,
        )

    @classmethod
    def create_feed(
        cls,
        user: AbstractBaseUser,
        category: RSSCategory,
        title: str = "Test Feed",
        visible: bool = True,
        is_public: bool = False,
        url: str | None = None,
    ) -> RSSFeed:
        """테스트 피드 생성"""
        feed_data: dict[str, object] = {
            "user": user,
            "category": category,
            "title": title,
            "visible": visible,
            "is_public": is_public,
        }
        if url:
            feed_data["url"] = url
        return RSSFeed.objects.create(**feed_data)

    @classmethod
    def create_item(
        cls,
        feed: RSSFeed,
        title: str = "Test Item",
        link: str = "http://example.com/item",
        guid: str | None = None,
        published_at: timezone.datetime | None = None,
        is_read: bool = False,
    ) -> RSSItem:
        """테스트 아이템 생성"""
        return RSSItem.objects.create(
            feed=feed,
            title=title,
            link=link,
            published_at=published_at or timezone.now(),
            guid=guid or unique_guid(),
            is_read=is_read,
        )

    @classmethod
    def create_items_batch(
        cls,
        feed: RSSFeed,
        count: int,
        title_prefix: str = "Test Item",
        base_time: timezone.datetime | None = None,
        time_delta_minutes: int = 1,
    ) -> list[RSSItem]:
        """여러 아이템 일괄 생성"""
        base_time = base_time or timezone.now()
        guid_prefix = uuid.uuid4().hex[:8]
        items: list[RSSItem] = []
        for i in range(count):
            item = RSSItem.objects.create(
                feed=feed,
                title=f"{title_prefix} {i}",
                link=f"http://example.com/item{i}",
                published_at=base_time - timedelta(minutes=i * time_delta_minutes),
                guid=f"guid-{guid_prefix}-{i}",
            )
            items.append(item)
        return items


def get_user_id(user: AbstractBaseUser) -> int:
    """User에서 id를 안전하게 추출"""
    return cast(int, user.pk)


# 테스트 클라이언트 인스턴스
def get_item_client() -> TestAsyncClient:
    return TestAsyncClient(item_router)


def get_feed_client() -> TestClient:
    return TestClient(feed_router)


def get_category_client() -> TestClient:
    return TestClient(category_router)
