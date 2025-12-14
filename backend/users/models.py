from django.db import models
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    # 추가 필드 예시

    def __str__(self):
        return self.username
