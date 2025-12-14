class SettingService:
    @staticmethod
    def get_global_setting():
        from users.models import GlobalSetting

        setting, created = GlobalSetting.objects.get_or_create(id=1)
        print(f"GlobalSetting retrieved: {setting}, created: {created}")
        return setting

    @staticmethod
    def set_admin_signed(signed: bool):
        setting = SettingService.get_global_setting()
        setting.admin_signed = signed
        setting.save()
        return setting
