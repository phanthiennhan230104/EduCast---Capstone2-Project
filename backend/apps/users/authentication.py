from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.tokens import UntypedToken

from .models import User


# ==========================================
# CUSTOM JWT AUTHENTICATION
# - đọc Bearer token từ header Authorization
# - verify token bằng SimpleJWT
# - lấy user_id trong token rồi query bảng users
# ==========================================
class CustomJWTAuthentication(BaseAuthentication):
    def authenticate(self, request):
        auth_header = request.headers.get("Authorization", "")

        if not auth_header.startswith("Bearer "):
            return None

        token = auth_header.replace("Bearer ", "").strip()

        if not token:
            return None

        try:
            # Kiểm tra token có hợp lệ không
            validated_token = UntypedToken(token)
        except Exception:
            raise AuthenticationFailed("Token không hợp lệ hoặc đã hết hạn.")

        user_id = validated_token.get("user_id")
        if not user_id:
            raise AuthenticationFailed("Token không chứa user_id.")

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            raise AuthenticationFailed("Không tìm thấy người dùng.")

        return (user, validated_token)