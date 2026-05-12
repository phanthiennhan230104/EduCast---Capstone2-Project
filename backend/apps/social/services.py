from django.contrib.auth import get_user_model
from django.utils import timezone
import ulid

from .models import Notification

User = get_user_model()


def create_new_post_notifications_for_admins(post, actor_user):
    admins = User.objects.filter(role__iexact='admin')

    actor_name = (
        getattr(actor_user, 'username', None)
        or getattr(actor_user, 'email', None)
        or 'Người dùng'
    )

    post_title = getattr(post, 'title', None) or 'Không có tiêu đề'

    notifications = []

    for admin in admins:
        notifications.append(
            Notification(
                id=str(ulid.new()),
                user=admin,
                actor_user=actor_user,
                type='new_post',
                title='Có bài đăng mới',
                body=f'{actor_name} vừa đăng bài mới: {post_title}',
                reference_type='post',
                reference_id=post.id,
                is_read=False,
                created_at=timezone.now(),
            )
        )

    if notifications:
        Notification.objects.bulk_create(notifications)