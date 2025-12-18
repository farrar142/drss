"""
Task Result Service - 태스크 결과 관련 비즈니스 로직
"""

from typing import Optional

from django.shortcuts import get_object_or_404
from django.db.models import QuerySet

from feeds.models import FeedTaskResult, RSSFeed


class TaskResultService:
    """태스크 결과 관련 비즈니스 로직을 처리하는 서비스"""

    @staticmethod
    def get_user_feed_ids(user) -> list[int]:
        """사용자의 피드 ID 목록"""
        return list(RSSFeed.objects.filter(user=user).values_list("id", flat=True))

    @staticmethod
    def list_task_results(
        user,
        feed_id: Optional[int] = None,
        status: Optional[str] = None,
    ) -> QuerySet[FeedTaskResult]:
        """태스크 결과 목록 조회 - QuerySet 반환 (페이지네이션용)"""
        user_feeds = TaskResultService.get_user_feed_ids(user)
        queryset = FeedTaskResult.objects.filter(feed_id__in=user_feeds).select_related("feed")

        if feed_id:
            queryset = queryset.filter(feed_id=feed_id)

        if status:
            queryset = queryset.filter(status=status)

        return queryset

    @staticmethod
    def get_task_stats(user, feed_id: Optional[int] = None) -> dict:
        """태스크 통계 조회"""
        user_feeds = TaskResultService.get_user_feed_ids(user)
        queryset = FeedTaskResult.objects.filter(feed_id__in=user_feeds)

        if feed_id:
            queryset = queryset.filter(feed_id=feed_id)

        return {
            "total": queryset.count(),
            "success": queryset.filter(status=FeedTaskResult.Status.SUCCESS).count(),
            "failure": queryset.filter(status=FeedTaskResult.Status.FAILURE).count(),
            "pending": queryset.filter(status=FeedTaskResult.Status.PENDING).count(),
            "running": queryset.filter(status=FeedTaskResult.Status.RUNNING).count(),
        }

    @staticmethod
    def get_task_result(user, result_id: int) -> FeedTaskResult:
        """특정 태스크 결과 조회"""
        return get_object_or_404(
            FeedTaskResult,
            id=result_id,
            feed__user=user,
        )

    @staticmethod
    def delete_task_result(user, result_id: int) -> bool:
        """특정 태스크 결과 삭제"""
        result = get_object_or_404(
            FeedTaskResult,
            id=result_id,
            feed__user=user,
        )
        result.delete()
        return True

    @staticmethod
    def clear_task_results(
        user,
        feed_id: Optional[int] = None,
        status: Optional[str] = None,
    ) -> int:
        """태스크 결과 일괄 삭제"""
        user_feeds = TaskResultService.get_user_feed_ids(user)
        queryset = FeedTaskResult.objects.filter(feed_id__in=user_feeds)

        if feed_id:
            queryset = queryset.filter(feed_id=feed_id)

        if status:
            queryset = queryset.filter(status=status)

        deleted_count = queryset.count()
        queryset.delete()

        return deleted_count
