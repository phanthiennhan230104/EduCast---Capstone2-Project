from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db import transaction

from django.db.models import Count, Sum, Q, OuterRef, Subquery, IntegerField, Value
from django.db.models.functions import Coalesce, TruncDate
from django.utils import timezone
from datetime import timedelta, datetime, time
from .permissions import IsAdminRole
from .models import UserSettings


from .models import User, UserLockLog
from apps.content.models import Post
from apps.social.models import (
    Comment,
    Follow,
    Notification,
    PostShare,
    PlaybackHistory,
    Report,
    PostLike,
)
from apps.chat.models import ChatRoom, Message



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


# class AdminUsersListView(APIView):
#     permission_classes = [IsAuthenticated, IsAdminRole]

#     def get(self, request):
#         unlock_expired_locks()

#         users = (
#             User.objects.select_related("profile")
#             .prefetch_related("lock_logs")
#             .filter(role="user")
#             .order_by("-created_at")
#         )

#         for user in users:
#             sync_user_lock_status(user)

#         serializer = AdminUserListSerializer(users, many=True)

#         total_users = users.count()
#         total_admins = User.objects.filter(role="admin").count()
#         total_active = User.objects.filter(role="user", status="active").count()
#         total_locked = User.objects.filter(role="user", status="locked").count()

#         return Response(
#             {
#                 "stats": {
#                     "total_users": total_users,
#                     "total_admins": total_admins,
#                     "total_active": total_active,
#                     "total_locked": total_locked,
#                 },
#                 "users": serializer.data,
#             },
#             status=status.HTTP_200_OK,
#         )


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

class AdminReportsListView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        status_filter = request.query_params.get("status")
        search_query = request.query_params.get("search")
        page = int(request.query_params.get("page", 1))
        page_size = int(request.query_params.get("page_size", 20))

        reports_qs = (
            Report.objects
            .filter(target_type="post")
            .select_related("user")
            .order_by("-created_at")
        )

        if status_filter and status_filter not in ["all", ""]:
            reports_qs = reports_qs.filter(status=status_filter)

        if search_query:
            reports_qs = reports_qs.filter(
                Q(reason__icontains=search_query) |
                Q(description__icontains=search_query) |
                Q(user__username__icontains=search_query) |
                Q(target_id__icontains=search_query)
            )

        total_count = reports_qs.count()

        counts_base = Report.objects.filter(target_type="post")
        counts = {
            "total": counts_base.count(),
            "pending": counts_base.filter(status="pending").count(),
            "resolved": counts_base.filter(status="resolved").count(),
            "reviewed": counts_base.filter(status="reviewed").count(),
            "rejected": counts_base.filter(status="rejected").count(),
        }

        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        reports_page = list(reports_qs[start_idx:end_idx])

        post_ids = [report.target_id for report in reports_page]

        posts_map = {
            post.id: post
            for post in Post.objects.filter(id__in=post_ids).select_related("user")
        }

        reports_data = []

        for report in reports_page:
            post = posts_map.get(report.target_id)

            reports_data.append({
                "id": report.id,
                "reason": report.reason,
                "description": report.description,
                "status": report.status,
                "target_type": report.target_type,
                "target_id": report.target_id,
                "created_at": report.created_at.isoformat() if report.created_at else None,
                "updated_at": report.updated_at.isoformat() if report.updated_at else None,

                "reporter_id": report.user_id,
                "reporter_username": report.user.username if report.user else "Unknown",

                "post_exists": bool(post),
                "post": {
                    "id": post.id,
                    "title": post.title,
                    "slug": post.slug,
                    "status": post.status,
                    "visibility": post.visibility,
                    "description": post.description,
                    "thumbnail_url": post.thumbnail_url,
                    "audio_url": post.audio_url,
                    "created_at": post.created_at.isoformat() if post.created_at else None,
                    "author_id": post.user_id,
                    "author_username": post.user.username if post.user else "Unknown",
                } if post else None,
            })

        return Response({
            "reports": reports_data,
            "counts": counts,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total": total_count,
                "total_pages": (total_count + page_size - 1) // page_size,
            },
        }, status=status.HTTP_200_OK)

class AdminOverviewView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        unlock_expired_locks()

        today = timezone.localdate()

        # Tuần hiện tại: T2 -> CN
        start_of_week = today - timedelta(days=today.weekday())
        end_of_week = start_of_week + timedelta(days=6)

        tz = timezone.get_current_timezone()

        # Lọc bằng datetime range, không dùng __date
        start_of_week_dt = timezone.make_aware(
            datetime.combine(start_of_week, time.min),
            tz
        )

        next_week_dt = timezone.make_aware(
            datetime.combine(end_of_week + timedelta(days=1), time.min),
            tz
        )

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
            total_post_saves=Coalesce(Sum("save_count"), 0),
            total_post_shares=Coalesce(Sum("share_count"), 0),
            total_downloads=Coalesce(Sum("download_count"), 0),
        )

        engagement_data["total_post_likes"] = PostLike.objects.count()
        engagement_data["total_post_comments"] = Comment.objects.filter(status="active").count()

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

        like_count_subquery = (
            PostLike.objects
            .filter(post_id=OuterRef("pk"))
            .values("post_id")
            .annotate(total=Count("id"))
            .values("total")
        )

        comment_count_subquery = (
            Comment.objects
            .filter(post_id=OuterRef("pk"), status="active")
            .values("post_id")
            .annotate(total=Count("id"))
            .values("total")
        )

        top_posts = list(
            Post.objects.filter(status="published", visibility="public")
            .annotate(
                db_like_count=Coalesce(
                    Subquery(like_count_subquery, output_field=IntegerField()),
                    Value(0),
                ),
                db_comment_count=Coalesce(
                    Subquery(comment_count_subquery, output_field=IntegerField()),
                    Value(0),
                ),
            )
            .values(
                "id",
                "title",
                "slug",
                "view_count",
                "listen_count",
                "share_count",
                "db_like_count",
                "db_comment_count",
            )
            .order_by("-listen_count", "-view_count")
        )
        

        for post in top_posts:
            post["like_count"] = post.pop("db_like_count", 0)
            post["comment_count"] = post.pop("db_comment_count", 0)

        def fill_weekly_series(rows):
            mapped = {}

            for row in rows:
                day_value = row["day"]

                if hasattr(day_value, "date"):
                    day_key = day_value.date().isoformat()
                elif hasattr(day_value, "isoformat"):
                    day_key = day_value.isoformat()
                else:
                    day_key = str(day_value)[:10]

                mapped[day_key[:10]] = row["count"]

            result = []

            # T2 -> CN
            for i in range(7):
                day = start_of_week + timedelta(days=i)
                key = day.isoformat()

                result.append({
                    "date": key,
                    "count": mapped.get(key, 0),
                })

            return result

        weekly_user_counts = {
            (start_of_week + timedelta(days=i)).isoformat(): 0
            for i in range(7)
        }

        weekly_users = User.objects.filter(
            role="user",
            status="active",
            created_at__gte=start_of_week_dt,
            created_at__lt=next_week_dt,
        ).only("id", "username", "email", "created_at")

        for user in weekly_users:
            local_created_at = timezone.localtime(user.created_at, tz)
            day_key = local_created_at.date().isoformat()

            if day_key in weekly_user_counts:
                weekly_user_counts[day_key] += 1

        new_users_7d = [
            {
                "date": day,
                "count": count,
            }
            for day, count in weekly_user_counts.items()
        ]

        print("NEW USERS WEEK:", new_users_7d)
        

        weekly_post_counts = {
            (start_of_week + timedelta(days=i)).isoformat(): 0
            for i in range(7)
        }

        weekly_posts = Post.objects.filter(
            visibility="public",
            status="published",
            created_at__gte=start_of_week_dt,
            created_at__lt=next_week_dt,
        ).only("id", "title", "created_at")

        for post in weekly_posts:
            local_created_at = timezone.localtime(post.created_at, tz)
            day_key = local_created_at.date().isoformat()

            if day_key in weekly_post_counts:
                weekly_post_counts[day_key] += 1

        new_posts_7d = [
            {
                "date": day,
                "count": count,
            }
            for day, count in weekly_post_counts.items()
        ]

        

        reports_7d = fill_weekly_series(
            Report.objects.filter(
                created_at__date__gte=start_of_week,
                created_at__date__lte=end_of_week,
            )
            .annotate(day=TruncDate("created_at", tzinfo=timezone.get_current_timezone()))
            .values("day")
            .annotate(count=Count("id"))
            .order_by("day")
        )

        messages_7d = fill_weekly_series(
            Message.objects.filter(
                created_at__date__gte=start_of_week,
                created_at__date__lte=end_of_week,
                is_deleted=False,
            )
            .annotate(day=TruncDate("created_at", tzinfo=timezone.get_current_timezone()))
            .values("day")
            .annotate(count=Count("id"))
            .order_by("day")
        )

        direct_posts = Post.objects.filter(
            visibility="public",
            status="published",
            created_at__gte=start_of_week_dt,
            created_at__lt=next_week_dt,
        )

        print("DIRECT POSTS COUNT:", direct_posts.count())
        print(list(direct_posts.values(
            "id",
            "title",
            "visibility",
            "status",
            "created_at",
        )))
        print("NEW POSTS WEEK:", new_posts_7d)
        print("================================")

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
class AdminSystemNotificationSettingsView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get_or_create_settings(self, user):
        settings_obj, _ = UserSettings.objects.get_or_create(
            user=user,
            defaults={
                "email_notifications": True,
                "push_notifications": True,
                "notify_likes": True,
                "notify_comments": True,
                "notify_follows": True,
                "notify_messages": True,
                "profile_visibility": "public",
                "allow_messages_from": "everyone",
                "autoplay_audio": True,
                "theme_mode": "dark",
                "language_code": "vi",
            }
        )
        return settings_obj

    def get(self, request):
        settings_obj = self.get_or_create_settings(request.user)

        return Response(
            {
                "email_admin_on_new_report": settings_obj.email_notifications,
                "daily_statistics_report": settings_obj.notify_messages,
                "notify_on_new_user": settings_obj.push_notifications,
            },
            status=status.HTTP_200_OK
        )

    def patch(self, request):
        settings_obj = self.get_or_create_settings(request.user)

        if "email_admin_on_new_report" in request.data:
            settings_obj.email_notifications = bool(request.data.get("email_admin_on_new_report"))

        if "daily_statistics_report" in request.data:
            settings_obj.notify_messages = bool(request.data.get("daily_statistics_report"))

        if "notify_on_new_user" in request.data:
            settings_obj.push_notifications = bool(request.data.get("notify_on_new_user"))

        settings_obj.save(
            update_fields=[
                "email_notifications",
                "notify_messages",
                "push_notifications",
                "updated_at",
            ]
        )

        return Response(
            {
                "message": "Cập nhật thông báo hệ thống thành công",
                "email_admin_on_new_report": settings_obj.email_notifications,
                "daily_statistics_report": settings_obj.notify_messages,
                "notify_on_new_user": settings_obj.push_notifications,
            },
            status=status.HTTP_200_OK
        )