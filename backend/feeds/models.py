from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()


class RSSCategory(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class RSSFeed(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    category = models.ForeignKey(RSSCategory, on_delete=models.CASCADE)
    url = models.URLField(unique=True)
    title = models.CharField(max_length=200, blank=True)
    favicon_url = models.URLField(blank=True)
    description = models.TextField(blank=True)
    visible = models.BooleanField(default=True)
    custom_headers = models.JSONField(default=dict, blank=True)
    refresh_interval = models.IntegerField(
        default=60, help_text="자동 새로고침 주기 (분)"
    )
    last_updated = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title


class RSSItem(models.Model):
    feed = models.ForeignKey(RSSFeed, on_delete=models.CASCADE)
    title = models.CharField(max_length=200)
    link = models.URLField()
    description = models.TextField(blank=True)
    published_at = models.DateTimeField()
    guid = models.CharField(max_length=500, unique=True)
    is_read = models.BooleanField(default=False)
    is_favorite = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-published_at"]

    def __str__(self):
        return self.title
