from rest_framework.permissions import BasePermission


class IsAdminRole(BasePermission):
    message = "Bạn không có quyền truy cập khu vực quản trị."

    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        return bool(
            user
            and getattr(user, "is_authenticated", False)
            and getattr(user, "role", None) == "admin"
            
        )