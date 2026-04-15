from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db import transaction

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