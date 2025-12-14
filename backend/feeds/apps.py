from django.apps import AppConfig


class FeedsConfig(AppConfig):
    name = "feeds"

    def ready(self):
        # Celery beat를 사용하므로 APScheduler는 제거됨
        pass
