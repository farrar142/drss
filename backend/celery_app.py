import os
from celery import Celery
from celery.schedules import crontab

# Django 설정 모듈 설정
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "base.settings")

app = Celery("drss")

# Django 설정에서 Celery 설정 로드
app.config_from_object("django.conf:settings", namespace="CELERY")

# Django 앱에서 task 자동 검색
app.autodiscover_tasks()


@app.task(bind=True)
def debug_task(self):
    print(f"Request: {self.request!r}")