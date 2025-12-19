from typing import Any, Dict


class SettingService:
    @staticmethod
    def get_global_setting():
        from users.models import GlobalSetting
        return GlobalSetting.get_instance()

    @staticmethod
    def set_admin_signed(signed: bool):
        setting = SettingService.get_global_setting()
        setting.admin_signed = signed
        setting.save()
        return setting

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
