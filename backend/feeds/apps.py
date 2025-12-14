from django.apps import AppConfig


class FeedsConfig(AppConfig):
    name = "feeds"

    def ready(self):
        # 앱 시작 시 기존 피드들의 업데이트 task 스케줄링
        from .signals import schedule_existing_feeds

        schedule_existing_feeds()
