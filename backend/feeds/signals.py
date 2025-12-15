from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.apps import apps
import logging

logger = logging.getLogger(__name__)


@receiver(post_save, sender="feeds.RSSFeed")
def schedule_feed_update(sender, instance, created, **kwargs):
    """
    RSSFeed가 생성되거나 업데이트될 때 스케줄 생성/업데이트
    """
    from .management.commands.setup_feed_schedules import setup_feed_schedule

    logger.info(
        f"RSSFeed {instance.title} {'created' if created else 'updated'}. "
        f"Refresh interval: {instance.refresh_interval} minutes, Visible: {instance.visible}"
    )

    # 스케줄 생성/업데이트
    setup_feed_schedule(instance)


@receiver(post_delete, sender="feeds.RSSFeed")
def remove_feed_schedule(sender, instance, **kwargs):
    """
    RSSFeed가 삭제될 때 스케줄 제거
    """
    from django_celery_beat.models import PeriodicTask

    logger.info(f"RSSFeed {instance.title} deleted.")

    # 해당 피드의 스케줄 제거
    # 제목이 바뀌어 있을 수 있으니 args (feed.pk) 기준으로 삭제하고, 이름 기준으로도 한 번 더 시도
    import json

    PeriodicTask.objects.filter(args=json.dumps([instance.pk])).delete()
    PeriodicTask.objects.filter(name=f"Update RSS feed: {instance.title}").delete()


def schedule_existing_feeds():
    """
    더 이상 사용하지 않음 - Celery beat로 대체됨
    """
    pass
