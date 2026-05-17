from django.contrib.auth import get_user_model
from django.utils import timezone
import ulid

from .models import Notification
from apps.social.views import _send_admin_update

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

    _send_admin_update("new_post", {"post_id": str(post.id)})


def create_new_report_notifications_for_admins(report, actor_user):
    admins = User.objects.filter(role__iexact='admin')

    actor_name = (
        getattr(actor_user, 'username', None)
        or getattr(actor_user, 'email', None)
        or 'Người dùng'
    )

    reason_vn = {
        'spam': 'Spam',
        'inappropriate_content': 'Nội dung không phù hợp',
        'harassment': 'Quấy rối',
        'misinformation': 'Thông tin sai lệch',
        'copyright': 'Vi phạm bản quyền',
        'other': 'Lý do khác'
    }.get(report.reason, report.reason)

    notifications = []

    for admin in admins:
        notifications.append(
            Notification(
                id=str(ulid.new()),
                user=admin,
                actor_user=actor_user,
                type='report_update',
                title='Có báo cáo mới',
                body=f'{actor_name} vừa báo cáo một nội dung: {reason_vn}',
                reference_type='report',
                reference_id=report.id,
                is_read=False,
                created_at=timezone.now(),
            )
        )

    if notifications:
        Notification.objects.bulk_create(notifications)

    _send_admin_update("post_change", {"report_id": str(report.id)})