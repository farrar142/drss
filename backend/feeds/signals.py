from django.db.models.signals import post_save
from django.dispatch import receiver
from django.apps import apps
import json


@receiver(post_save, sender="feeds.RSSFeed")
def schedule_feed_update(sender, instance, created, **kwargs):
    """
    RSSFeed가 생성되거나 업데이트될 때 주기적 업데이트 task를 스케줄링
    """
    from django_celery_beat.models import PeriodicTask, IntervalSchedule

    # 모델이 아직 로드되지 않았을 수 있으므로 apps를 통해 가져옴
    RSSFeed = apps.get_model("feeds", "RSSFeed")

    if created or instance.refresh_interval != getattr(
        instance, "_old_refresh_interval", instance.refresh_interval
    ):
        # 기존 task 삭제
        PeriodicTask.objects.filter(
            name=f"update_feed_{instance.id}", task="feeds.tasks.update_feed_items"
        ).delete()

        # 새로운 interval schedule 생성 또는 가져오기
        schedule, created = IntervalSchedule.objects.get_or_create(
            every=instance.refresh_interval,
            period=IntervalSchedule.MINUTES,
        )

        # 새로운 periodic task 생성
        PeriodicTask.objects.create(
            name=f"update_feed_{instance.id}",
            task="feeds.tasks.update_feed_items",
            interval=schedule,
            args=json.dumps([instance.id]),
            enabled=instance.visible,
        )

        # 이전 값 저장
        instance._old_refresh_interval = instance.refresh_interval


def schedule_existing_feeds():
    """
    앱 시작 시 기존 피드들의 업데이트 task를 스케줄링
    """
    from django_celery_beat.models import PeriodicTask, IntervalSchedule

    # 모델이 로드된 후에 실행되도록 함
    RSSFeed = apps.get_model("feeds", "RSSFeed")
    feeds = RSSFeed.objects.all()
    for feed in feeds:
        # signal을 통해 task 스케줄링
        schedule_feed_update(RSSFeed, feed, created=False)
