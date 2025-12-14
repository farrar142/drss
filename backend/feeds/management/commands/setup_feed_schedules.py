from django.core.management.base import BaseCommand
from django_celery_beat.models import PeriodicTask, IntervalSchedule
from feeds.models import RSSFeed
import json


class Command(BaseCommand):
    help = "Setup periodic tasks for RSS feed updates using Celery Beat"

    def handle(self, *args, **options):
        self.stdout.write("Setting up RSS feed update schedules...")

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
                    "args": json.dumps([feed.id]),
                    "enabled": True,
                },
            )

            if created:
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Created schedule for {feed.title} (every {feed.refresh_interval} minutes)"
                    )
                )
            else:
                # 기존 task 업데이트
                task.interval = schedule
                task.args = json.dumps([feed.id])
                task.enabled = True
                task.save()
                self.stdout.write(
                    self.style.WARNING(f"Updated schedule for {feed.title}")
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"Setup complete. Created schedules for {feeds.count()} feeds."
            )
        )
