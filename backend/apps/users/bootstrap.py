import os
import threading

from django.contrib.auth.hashers import make_password
from django.db import close_old_connections, transaction


_has_run = False


def model_has_field(model, field_name):
    try:
        model._meta.get_field(field_name)
        return True
    except Exception:
        return False


def create_default_admin():
    from apps.users.models import User, UserProfile

    close_old_connections()

    try:
        with transaction.atomic():
            admin_user = User.objects.filter(username='admin').first()

            if not admin_user:
                admin_user = User(username='admin')

                # Nếu model User có email thì set luôn
                if model_has_field(User, 'email'):
                    admin_user.email = 'admin@educast.local'

                # Nếu model User có password_hash thì dùng password_hash
                if model_has_field(User, 'password_hash'):
                    admin_user.password_hash = make_password('123456')
                # Nếu model User dùng field password chuẩn của Django
                elif hasattr(admin_user, 'set_password'):
                    admin_user.set_password('123456')

            # Luôn đảm bảo admin có role đúng
            if model_has_field(User, 'role'):
                admin_user.role = 'admin'

            # Nếu model có các field quyền phổ biến thì bật lên
            if model_has_field(User, 'is_active'):
                admin_user.is_active = True

            if model_has_field(User, 'is_staff'):
                admin_user.is_staff = True

            if model_has_field(User, 'is_superuser'):
                admin_user.is_superuser = True

            admin_user.save()

            UserProfile.objects.get_or_create(
                user=admin_user,
                defaults={
                    'display_name': 'admin',
                }
            )

            print('Default admin is ready: username=admin password=123456')

    except Exception as error:
        print(f'Create default admin failed: {error}')

    finally:
        close_old_connections()


def run_create_default_admin_once():
    global _has_run

    if _has_run:
        return

    _has_run = True

    # Với django runserver, tránh chạy ở process reload cha
    if os.environ.get('RUN_MAIN') == 'false':
        return

    thread = threading.Thread(target=create_default_admin)
    thread.daemon = True
    thread.start()