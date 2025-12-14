from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
import logging

logger = logging.getLogger(__name__)


@receiver(post_save, sender="feeds.RSSFeed")
def schedule_feed_update(sender, instance, created, **kwargs):
    """
    RSSFeed가 생성되거나 업데이트될 때 - Celery beat에서 관리하므로 별도 처리 불필요
    """
    logger.info(
        f"RSSFeed {instance.title} {'created' if created else 'updated'}. "
        f"Refresh interval: {instance.refresh_interval} minutes, Visible: {instance.visible}"
    )
    # Celery beat를 사용하므로 여기서는 로깅만 수행


@receiver(post_delete, sender="feeds.RSSFeed")
def remove_feed_schedule(sender, instance, **kwargs):
    """
    RSSFeed가 삭제될 때 - Celery beat에서 관리하므로 별도 처리 불필요
    """
    logger.info(f"RSSFeed {instance.title} deleted.")
    # Celery beat를 사용하므로 여기서는 로깅만 수행


def schedule_existing_feeds():
    """
    더 이상 사용하지 않음 - Celery beat로 대체됨
    """
    pass
