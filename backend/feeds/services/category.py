"""
Category Service - 카테고리 관련 비즈니스 로직
"""

from django.shortcuts import get_object_or_404
from django.db.models import QuerySet, Prefetch

from feeds.models import RSSCategory, RSSFeed, RSSItem
from feeds.schemas import (
    CategoryCreateSchema,
    CategoryUpdateSchema,
    CategoryReorderSchema,
)


class CategoryService:
    """카테고리 관련 비즈니스 로직을 처리하는 서비스"""

    @staticmethod
    def get_user_categories(user) -> QuerySet[RSSCategory]:
        """사용자의 카테고리 목록 조회"""
        return RSSCategory.objects.filter(user=user)

    @staticmethod
    def get_user_categories_with_feeds(user) -> QuerySet[RSSCategory]:
        """사용자의 카테고리 목록 + 피드 목록 조회 (초기 로딩 최적화)"""
        return (
            RSSCategory.objects.filter(user=user)
            .prefetch_related(
                Prefetch(
                    "feeds",
                    queryset=RSSFeed.objects.with_item_counts().prefetch_related(
                        "sources"
                    ),
                )
            )
            .order_by("order")
        )

    @staticmethod
    def create_category(user, data: CategoryCreateSchema) -> RSSCategory:
        """새 카테고리 생성"""
        return RSSCategory.objects.create(
            user=user,
            name=data.name,
            description=data.description,
            visible=data.visible,
            is_public=data.is_public,
        )

    @staticmethod
    def update_category(
        user, category_id: int, data: CategoryUpdateSchema
    ) -> RSSCategory:
        """카테고리 수정"""
        category = get_object_or_404(RSSCategory, id=category_id, user=user)

        if data.name is not None:
            category.name = data.name
        if data.description is not None:
            category.description = data.description
        if data.visible is not None:
            category.visible = data.visible
        if data.is_public is not None:
            category.is_public = data.is_public
        if data.order is not None:
            category.order = data.order

        category.save()
        return category

    @staticmethod
    def reorder_categories(user, data: CategoryReorderSchema) -> list[RSSCategory]:
        """카테고리 순서 일괄 변경"""
        categories = []
        for order, category_id in enumerate(data.category_ids):
            category = get_object_or_404(RSSCategory, id=category_id, user=user)
            category.order = order
            category.save()
            categories.append(category)
        return categories

    @staticmethod
    def delete_category(user, category_id: int) -> bool:
        """카테고리 삭제"""
        category = get_object_or_404(RSSCategory, id=category_id, user=user)
        category.delete()
        return True

    @staticmethod
    def refresh_category_feeds(user, category_id: int) -> bool:
        """카테고리의 모든 피드 새로고침"""
        from feeds.tasks import update_feeds_by_category

        category = get_object_or_404(RSSCategory, id=category_id, user=user)
        update_feeds_by_category.delay(category.pk)
        return True

    @staticmethod
    def get_category_stats(user, category_id: int) -> dict:
        """카테고리 통계 조회 (최적화: 단일 쿼리로 집계)"""
        from django.db.models import Count, Q

        category = get_object_or_404(RSSCategory, id=category_id, user=user)

        # 단일 쿼리로 모든 통계 집계
        stats = RSSItem.objects.filter(feed__category=category).aggregate(
            total_items=Count("id"),
            unread_items=Count("id", filter=Q(is_read=False)),
            favorite_items=Count("id", filter=Q(is_favorite=True)),
        )

        return {
            "total_items": stats["total_items"] or 0,
            "unread_items": stats["unread_items"] or 0,
            "favorite_items": stats["favorite_items"] or 0,
        }
