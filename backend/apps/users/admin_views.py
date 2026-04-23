from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db import transaction

from django.db.models import Count, Sum
from django.db.models.functions import Coalesce, TruncDate
from django.utils import timezone
from datetime import timedelta

from .models import User, UserLockLog
from apps.content.models import Post
from apps.social.models import (
    Comment,
    Follow,
    Notification,
    PostShare,
    PlaybackHistory,
    Report,
)
from apps.chat.models import ChatRoom, Message

from .models import User
from .permissions import IsAdminRole
from .serializers import (
    AdminLockUserSerializer,
    AdminUnlockUserSerializer,
    AdminUserListSerializer,
)
from .utils import (
    get_active_lock,
    lock_user_account,
    sync_user_lock_status,
    send_lock_notification_email,
    send_unlock_notification_email,
    unlock_expired_locks,
    unlock_user_account,
)


class AdminUsersListView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        unlock_expired_locks()

        users = (
            User.objects.select_related("profile")
            .prefetch_related("lock_logs")
            .filter(role="user")
            .order_by("-created_at")
        )

        for user in users:
            sync_user_lock_status(user)

        serializer = AdminUserListSerializer(users, many=True)

        total_users = users.count()
        total_admins = User.objects.filter(role="admin").count()
        total_active = User.objects.filter(role="user", status="active").count()
        total_locked = User.objects.filter(role="user", status="locked").count()

        return Response(
            {
                "stats": {
                    "total_users": total_users,
                    "total_admins": total_admins,
                    "total_active": total_active,
                    "total_locked": total_locked,
                },
                "users": serializer.data,
            },
            status=status.HTTP_200_OK,
        )


class AdminUserLockView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def post(self, request, user_id):
        serializer = AdminLockUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            user = User.objects.get(id=user_id, role="user")
        except User.DoesNotExist:
            return Response(
                {"error": "Không tìm thấy người dùng."},
                status=status.HTTP_404_NOT_FOUND,
            )

        sync_user_lock_status(user)
        active_lock = get_active_lock(user)
        if active_lock:
            return Response(
                {"error": "Người dùng này đang bị khóa."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reason = serializer.validated_data["reason"].strip()
        lock_type = serializer.validated_data["lock_type"]
        locked_until = serializer.validated_data.get("locked_until")
        with transaction.atomic():
            lock_user_account(
                user=user,
                locked_by=request.user,
                reason=reason,
                lock_type=lock_type,
                locked_until=locked_until,
            )

        send_lock_notification_email(user, reason, lock_type, locked_until)

        return Response(
            {
                "message": "Khóa người dùng thành công.",
                "user": AdminUserListSerializer(user).data,
            },
            status=status.HTTP_200_OK,
        )


class AdminUserUnlockView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def post(self, request, user_id):
        serializer = AdminUnlockUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            user = User.objects.get(id=user_id, role="user")
        except User.DoesNotExist:
            return Response(
                {"error": "Không tìm thấy người dùng."},
                status=status.HTTP_404_NOT_FOUND,
            )

        active_lock = get_active_lock(user)
        if not active_lock and user.status != "locked":
            return Response(
                {"error": "Người dùng này hiện không bị khóa."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        unlock_reason = (
            serializer.validated_data.get("unlock_reason", "").strip()
            or "Admin đã mở khóa tài khoản."
        )

        unlock_user_account(
            user,
            unlocked_by=request.user,
            unlock_reason=unlock_reason,
        )

        send_unlock_notification_email(user, unlock_reason)

        return Response(
            {
                "message": "Mở khóa người dùng thành công.",
                "user": AdminUserListSerializer(user).data,
            },
            status=status.HTTP_200_OK,
        )


class AdminOverviewView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        unlock_expired_locks()

        today = timezone.localdate()
        seven_days_ago = today - timedelta(days=6)
        thirty_days_ago = timezone.now() - timedelta(days=30)

        users_qs = User.objects.all()
        posts_qs = Post.objects.all()

        users_data = {
            "total_users": users_qs.filter(role="user").count(),
            "total_admins": users_qs.filter(role="admin").count(),
            "active_users": users_qs.filter(role="user", status="active").count(),
            "inactive_users": users_qs.filter(role="user", status="inactive").count(),
            "suspended_users": users_qs.filter(role="user", status="suspended").count(),
            "banned_users": users_qs.filter(role="user", status="banned").count(),
            "locked_users": users_qs.filter(role="user", status="locked").count(),
            "verified_users": users_qs.filter(role="user", is_verified=True).count(),
            "google_users": users_qs.filter(role="user", auth_provider="google").count(),
            "new_users_30d": users_qs.filter(role="user", created_at__gte=thirty_days_ago).count(),
        }

        posts_data = {
            "total_posts": posts_qs.count(),
            "published_posts": posts_qs.filter(status="published").count(),
            "draft_posts": posts_qs.filter(status="draft").count(),
            "processing_posts": posts_qs.filter(status="processing").count(),
            "hidden_posts": posts_qs.filter(status="hidden").count(),
            "archived_posts": posts_qs.filter(status="archived").count(),
            "failed_posts": posts_qs.filter(status="failed").count(),
            "public_posts": posts_qs.filter(visibility="public").count(),
            "private_posts": posts_qs.filter(visibility="private").count(),
            "unlisted_posts": posts_qs.filter(visibility="unlisted").count(),
            "ai_generated_posts": posts_qs.filter(is_ai_generated=True).count(),
            "new_posts_30d": posts_qs.filter(created_at__gte=thirty_days_ago).count(),
        }

        engagement_data = posts_qs.aggregate(
            total_views=Coalesce(Sum("view_count"), 0),
            total_listens=Coalesce(Sum("listen_count"), 0),
            total_post_likes=Coalesce(Sum("like_count"), 0),
            total_post_comments=Coalesce(Sum("comment_count"), 0),
            total_post_saves=Coalesce(Sum("save_count"), 0),
            total_post_shares=Coalesce(Sum("share_count"), 0),
            total_downloads=Coalesce(Sum("download_count"), 0),
        )

        shares_data = {
            "total_shares": PostShare.objects.count(),
            "personal_shares": PostShare.objects.filter(share_type="personal").count(),
            "message_shares": PostShare.objects.filter(share_type="message").count(),
        }

        interactions_data = {
            "total_comments": Comment.objects.count(),
            "active_comments": Comment.objects.filter(status="active").count(),
            "hidden_comments": Comment.objects.filter(status="hidden").count(),
            "deleted_comments": Comment.objects.filter(status="deleted").count(),
            "total_follows": Follow.objects.count(),
            "total_notifications": Notification.objects.count(),
            "unread_notifications": Notification.objects.filter(is_read=False).count(),
            "total_chat_rooms": ChatRoom.objects.count(),
            "total_messages": Message.objects.filter(is_deleted=False).count(),
            "deleted_messages": Message.objects.filter(is_deleted=True).count(),
            "total_playback_records": PlaybackHistory.objects.count(),
        }

        moderation_data = {
            "total_reports": Report.objects.count(),
            "pending_reports": Report.objects.filter(status="pending").count(),
            "reviewed_reports": Report.objects.filter(status="reviewed").count(),
            "resolved_reports": Report.objects.filter(status="resolved").count(),
            "rejected_reports": Report.objects.filter(status="rejected").count(),
            "active_lock_cases": UserLockLog.objects.filter(unlocked_at__isnull=True).count(),
            "temporary_locks": UserLockLog.objects.filter(
                unlocked_at__isnull=True,
                lock_type="temporary"
            ).count(),
            "permanent_locks": UserLockLog.objects.filter(
                unlocked_at__isnull=True,
                lock_type="permanent"
            ).count(),
        }

        top_posts = list(
            Post.objects.filter(status="published")
            .values(
                "id",
                "title",
                "slug",
                "view_count",
                "listen_count",
                "like_count",
                "comment_count",
                "share_count",
            )
            .order_by("-listen_count", "-view_count")[:5]
        )

        def fill_daily_series(rows):
            mapped = {str(row["day"]): row["count"] for row in rows}
            result = []

            for i in range(7):
                day = seven_days_ago + timedelta(days=i)
                result.append({
                    "date": day.isoformat(),
                    "count": mapped.get(day.isoformat(), 0),
                })

            return result

        new_users_7d = fill_daily_series(
            User.objects.filter(role="user", created_at__date__gte=seven_days_ago)
            .annotate(day=TruncDate("created_at"))
            .values("day")
            .annotate(count=Count("id"))
            .order_by("day")
        )

        new_posts_7d = fill_daily_series(
            Post.objects.filter(created_at__date__gte=seven_days_ago)
            .annotate(day=TruncDate("created_at"))
            .values("day")
            .annotate(count=Count("id"))
            .order_by("day")
        )

        reports_7d = fill_daily_series(
            Report.objects.filter(created_at__date__gte=seven_days_ago)
            .annotate(day=TruncDate("created_at"))
            .values("day")
            .annotate(count=Count("id"))
            .order_by("day")
        )

        messages_7d = fill_daily_series(
            Message.objects.filter(created_at__date__gte=seven_days_ago, is_deleted=False)
            .annotate(day=TruncDate("created_at"))
            .values("day")
            .annotate(count=Count("id"))
            .order_by("day")
        )

        return Response(
            {
                "overview": {
                    "users": users_data,
                    "posts": posts_data,
                    "engagement": engagement_data,
                    "shares": shares_data,
                    "interactions": interactions_data,
                    "moderation": moderation_data,
                    "top_posts": top_posts,
                    "charts": {
                        "new_users_7d": new_users_7d,
                        "new_posts_7d": new_posts_7d,
                        "reports_7d": reports_7d,
                        "messages_7d": messages_7d,
                    },
                }
            },
            status=status.HTTP_200_OK,
        )
    
class AdminUsersListView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        users = User.objects.select_related("profile").filter(role="user").order_by("-created_at")
        serializer = AdminUserListSerializer(users, many=True)

        total_users = users.count()
        total_admins = users.filter(role="admin").count()
        total_active = users.filter(status="active").count()
        total_locked = users.filter(status__in=["suspended", "banned"]).count()

        return Response(
            {
                "stats": {
                    "total_users": total_users,
                    "total_admins": total_admins,
                    "total_active": total_active,
                    "total_locked": total_locked,
                },
                "users": serializer.data,
            },
            status=status.HTTP_200_OK,
        )