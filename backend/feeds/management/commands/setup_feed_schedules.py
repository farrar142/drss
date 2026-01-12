from django.core.management.base import BaseCommand
from django_celery_beat.models import PeriodicTask, IntervalSchedule
from feeds.models import RSSFeed
import json


def setup_feed_schedules():
    """
    Setup periodic tasks for RSS feed updates using Celery Beat
    """
    # 기존 task들 제거
    PeriodicTask.objects.filter(name__startswith="Update RSS feed:").delete()

    # 모든 활성화된 피드에 대해 스케줄 생성
    feeds = RSSFeed.objects.filter(visible=True, refresh_interval__gt=0)

    for feed in feeds:
        # Interval schedule 생성 또는 가져오기
        schedule, created = IntervalSchedule.objects.get_or_create(
            every=feed.refresh_interval,
            period=IntervalSchedule.MINUTES,
        )

        # Periodic task 생성
        task_name = f"Update RSS feed: {feed.title}"
        task, created = PeriodicTask.objects.get_or_create(
            name=task_name,
            defaults={
                "task": "feeds.tasks.update_feed_items",
                "interval": schedule,
                "args": json.dumps([feed.pk]),
                "enabled": True,
            },
        )

        if not created:
            # 기존 task 업데이트
            task.interval = schedule
            task.args = json.dumps([feed.pk])
            task.enabled = True
            task.save()


def setup_feed_schedule(feed):
    """
    특정 피드에 대한 스케줄 생성/업데이트
    """
    if not feed.visible or feed.refresh_interval <= 0:
        # 스케줄 제거: 제목이 바뀌었거나 중복이 있을 수 있으므로 args (feed.pk) 기준으로 삭제
        args_payload = json.dumps([feed.pk])
        PeriodicTask.objects.filter(args=args_payload).delete()
        # 기존 이름 기준으로도 한 번 더 삭제 (안전성)
        PeriodicTask.objects.filter(name=f"Update RSS feed: {feed.title}").delete()
        return

    # Interval schedule 생성 또는 가져오기
    schedule, created = IntervalSchedule.objects.get_or_create(
        every=feed.refresh_interval,
        period=IntervalSchedule.MINUTES,
    )

    # Periodic task 생성/업데이트
    task_name = f"Update RSS feed: {feed.title}"
    # 먼저 같은 피드 ID로 이미 존재하는 task가 있는지 확인합니다.
    # (피드 제목 변경 시 기존 task의 name이 달라져 중복 생성되는 것을 방지)
    args_payload = json.dumps([feed.pk])
    existing_tasks = PeriodicTask.objects.filter(args=args_payload)

    if existing_tasks.exists():
        # 기존 task 중 이름이 같은 것이 있으면 그것을 사용, 아니면 첫 번째를 갱신
        task = existing_tasks.filter(name=task_name).first() or existing_tasks.first()
        if not task:
            raise Exception("Unexpected error: No task found despite existing_tasks.exists() being True")
        task.name = task_name
        task.task = "feeds.tasks.update_feed_items"
        task.interval = schedule
        task.args = args_payload
        task.enabled = True
        task.save()

        # 동일 args를 가진 추가 항목이 있다면 정리 (중복 제거)
        if existing_tasks.count() > 1:
            existing_tasks.exclude(id=task.pk).delete()
        return

    # 없으면 이름으로 새로 생성
    task, created = PeriodicTask.objects.get_or_create(
        name=task_name,
        defaults={
            "task": "feeds.tasks.update_feed_items",
            "interval": schedule,
            "args": args_payload,
            "enabled": True,
        },
    )

    if not created:
        # 기존 task 업데이트
        task.interval = schedule
        task.args = args_payload
        task.enabled = True
        task.save()


class Command(BaseCommand):
    help = "Setup periodic tasks for RSS feed updates using Celery Beat"

    def handle(self, *args, **options):
        self.stdout.write("Setting up RSS feed update schedules...")

        setup_feed_schedules()

        feeds = RSSFeed.objects.filter(visible=True, refresh_interval__gt=0)
        self.stdout.write(
            self.style.SUCCESS(
                f"Setup complete. Created schedules for {feeds.count()} feeds."
            )
        )
