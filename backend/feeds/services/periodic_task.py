"""
Periodic Task Service - 주기적 태스크 관련 비즈니스 로직
"""

import json
from typing import Optional

from django.db.models import QuerySet
from django_celery_beat.models import PeriodicTask, IntervalSchedule

from feeds.models import RSSFeed


class PeriodicTaskService:
    """주기적 태스크 관련 비즈니스 로직을 처리하는 서비스"""

    @staticmethod
    def get_user_feed_ids(user) -> list[int]:
        """사용자의 피드 ID 목록"""
        return list(RSSFeed.objects.filter(user=user).values_list("id", flat=True))

    @staticmethod
    def get_feed_id_from_task(task: PeriodicTask) -> Optional[int]:
        """태스크에서 피드 ID 추출"""
        try:
            args = json.loads(task.args) if task.args else []
            if args and len(args) > 0:
                return int(args[0])
        except (json.JSONDecodeError, ValueError, IndexError):
            pass
        return None

    @staticmethod
    def list_periodic_tasks(
        user,
        feed_id: Optional[int] = None,
        enabled: Optional[bool] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> dict:
        """사용자의 주기적 태스크 목록 조회"""
        user_feed_ids = PeriodicTaskService.get_user_feed_ids(user)

        # 모든 RSS 피드 업데이트 태스크 조회
        queryset = PeriodicTask.objects.filter(
            task="feeds.tasks.update_feed_items"
        ).select_related("interval")

        # 사용자의 피드에 해당하는 태스크만 필터링
        tasks_with_feeds = []
        feeds_map = {
            f.id: f.title for f in RSSFeed.objects.filter(id__in=user_feed_ids)
        }

        for task in queryset:
            task_feed_id = PeriodicTaskService.get_feed_id_from_task(task)
            if task_feed_id and task_feed_id in user_feed_ids:
                # 피드 필터 적용
                if feed_id is not None and task_feed_id != feed_id:
                    continue
                # enabled 필터 적용
                if enabled is not None and task.enabled != enabled:
                    continue
                tasks_with_feeds.append(
                    (task, task_feed_id, feeds_map.get(task_feed_id, "Unknown"))
                )

        total = len(tasks_with_feeds)
        paginated = tasks_with_feeds[offset : offset + limit]

        return {
            "items": paginated,
            "total": total,
        }

    @staticmethod
    def get_periodic_task(user, task_id: int) -> tuple:
        """특정 주기적 태스크 조회"""
        user_feed_ids = PeriodicTaskService.get_user_feed_ids(user)

        try:
            task = PeriodicTask.objects.select_related("interval").get(id=task_id)
        except PeriodicTask.DoesNotExist:
            raise ValueError("Task not found")

        task_feed_id = PeriodicTaskService.get_feed_id_from_task(task)
        if not task_feed_id or task_feed_id not in user_feed_ids:
            raise ValueError("Task not found")

        feed = RSSFeed.objects.filter(id=task_feed_id).first()
        return (task, task_feed_id, feed.title if feed else "Unknown")

    @staticmethod
    def update_periodic_task(
        user, task_id: int, enabled: Optional[bool] = None, interval_minutes: Optional[int] = None
    ) -> tuple:
        """주기적 태스크 업데이트"""
        task, feed_id, feed_title = PeriodicTaskService.get_periodic_task(user, task_id)

        if enabled is not None:
            task.enabled = enabled

        if interval_minutes is not None and interval_minutes > 0:
            schedule, _ = IntervalSchedule.objects.get_or_create(
                every=interval_minutes,
                period=IntervalSchedule.MINUTES,
            )
            task.interval = schedule

        task.save()
        return (task, feed_id, feed_title)

    @staticmethod
    def toggle_periodic_task(user, task_id: int) -> tuple:
        """주기적 태스크 활성화/비활성화 토글"""
        task, feed_id, feed_title = PeriodicTaskService.get_periodic_task(user, task_id)
        task.enabled = not task.enabled
        task.save()
        return (task, feed_id, feed_title)

    @staticmethod
    def delete_periodic_task(user, task_id: int) -> bool:
        """주기적 태스크 삭제"""
        task, _, _ = PeriodicTaskService.get_periodic_task(user, task_id)
        task.delete()
        return True

    @staticmethod
    def get_task_stats(user) -> dict:
        """주기적 태스크 통계"""
        result = PeriodicTaskService.list_periodic_tasks(user, limit=1000, offset=0)
        tasks = result["items"]

        enabled_count = sum(1 for t, _, _ in tasks if t.enabled)
        disabled_count = len(tasks) - enabled_count

        return {
            "total": len(tasks),
            "enabled": enabled_count,
            "disabled": disabled_count,
        }
