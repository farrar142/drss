from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import MinValueValidator, MaxValueValidator


class User(AbstractUser):
    # 추가 필드 예시

    def __str__(self):
        return self.username


class GlobalSetting(models.Model):
    """
    글로벌 설정을 저장하는 싱글턴 모델
    새로운 설정을 추가하려면:
    1. 모델에 필드 추가
    2. SettingService에 getter/setter 추가
    3. GlobalSettingSchema에 필드 추가
    4. 프론트엔드 AdminPage의 ADMIN_SETTINGS에 설정 추가
    """
    # 관리자 관련 설정
    admin_signed = models.BooleanField(
        default=False,
        help_text="관리자가 가입했는지 여부"
    )
    allow_signup = models.BooleanField(
        default=True,
        help_text="새로운 사용자의 회원가입 허용 여부"
    )
    
    # 사이트 설정 예시
    site_name = models.CharField(
        max_length=100,
        default="DRSS",
        help_text="사이트 이름"
    )
    max_feeds_per_user = models.IntegerField(
        default=100,
        validators=[MinValueValidator(1), MaxValueValidator(1000)],
        help_text="사용자당 최대 피드 수"
    )
    default_refresh_interval = models.IntegerField(
        default=60,
        validators=[MinValueValidator(1), MaxValueValidator(1440)],
        help_text="기본 새로고침 간격 (분)"
    )
    
    class Meta:
        verbose_name = "Global Setting"
        verbose_name_plural = "Global Settings"
    
    def save(self, *args, **kwargs):
        # 싱글턴 패턴: 항상 pk=1로 저장
        self.pk = 1
        super().save(*args, **kwargs)
    
    @classmethod
    def get_instance(cls):
        """싱글턴 인스턴스 반환"""
        instance, _ = cls.objects.get_or_create(pk=1)
        return instance
