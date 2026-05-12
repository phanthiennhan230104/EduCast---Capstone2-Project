from django.apps import AppConfig


class UsersConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.users'
    label = 'users'

    def ready(self):
        from apps.users.bootstrap import run_create_default_admin_once
        run_create_default_admin_once()