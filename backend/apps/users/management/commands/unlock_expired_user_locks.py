from django.core.management.base import BaseCommand
from apps.users.utils import unlock_expired_locks


class Command(BaseCommand):
    help = "Tu dong mo khoa cac tai khoan da het han khoa tam thoi"

    def handle(self, *args, **options):
        count = unlock_expired_locks()
        self.stdout.write(self.style.SUCCESS(f"Da mo khoa {count} tai khoan het han."))