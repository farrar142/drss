from typing import Any, Dict


class SettingService:
    @staticmethod
    def get_global_setting():
        from users.models import GlobalSetting
        return GlobalSetting.get_instance()


    @staticmethod
    def is_signup_allowed() -> bool:
        """회원가입이 허용되는지 확인"""
        setting = SettingService.get_global_setting()
        return setting.allow_signup

    @staticmethod
    def set_allow_signup(allow: bool):
        setting = SettingService.get_global_setting()
        setting.allow_signup = allow
        setting.save()
        return setting

    @staticmethod
    def update_settings(data: Dict[str, Any]):
        """여러 설정을 한 번에 업데이트"""
        setting = SettingService.get_global_setting()

        # 허용된 필드만 업데이트
        allowed_fields = [
            'allow_signup',
            'site_name',
            'max_feeds_per_user',
            'default_refresh_interval'
        ]

        for field, value in data.items():
            if field in allowed_fields and hasattr(setting, field):
                setattr(setting, field, value)

        setting.save()
        return setting

    @staticmethod
    def get_max_feeds_per_user() -> int:
        """사용자당 최대 피드 수 반환"""
        setting = SettingService.get_global_setting()
        return setting.max_feeds_per_user

    @staticmethod
    def get_default_refresh_interval() -> int:
        """기본 새로고침 간격 반환 (분)"""
        setting = SettingService.get_global_setting()
        return setting.default_refresh_interval
