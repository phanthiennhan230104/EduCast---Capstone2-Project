import uuid
import requests 
import logging
from django.conf import settings
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import api_view, permission_classes
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth.hashers import make_password
from django.utils import timezone
from datetime import timedelta
from rest_framework_simplejwt.tokens import RefreshToken
from .permissions import IsAdminRole

from .models import User
from .serializers import (
    RegisterSerializer,
    MyTokenObtainPairSerializer,
    ResetPasswordSerializer,
    AdminUserListSerializer,
)
from .permissions import IsAdminRole
from .utils import (
    verify_otp,
    verify_reset_token,
    send_register_otp_email,
    send_forgot_password_otp_email,
    save_reset_token,
)

logger = logging.getLogger(__name__)


# ==========================================================
# API ĐĂNG KÝ
# - dùng generics.CreateAPIView giống DNF
# - serializer chịu trách nhiệm validate + create user
# - sau khi tạo user thì gửi OTP qua email
# ==========================================================
class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        # Log request data để debug
        logger.info(f"Register request data: {request.data}")
        
        # Tự xử lý create để tránh DRF cố serialize lại field full_name
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            logger.error(f"Register validation errors: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


        # save() sẽ gọi hàm create() trong RegisterSerializer
        user = serializer.save()

        # Gửi mã OTP xác thực tài khoản qua email
        send_register_otp_email(user)

        # Frontend sẽ lấy email này để gọi API verify-otp
        return Response(
            {
                "message": "Đăng ký thành công. OTP đã được gửi về email.",
                "email": user.email,
            },
            status=status.HTTP_201_CREATED,
        )



# ==========================================================
# API XÁC THỰC OTP SAU ĐĂNG KÝ
# - nếu OTP đúng thì kích hoạt tài khoản
# ==========================================================
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken

class VerifyOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email", "").strip().lower()
        otp = request.data.get("otp", "").strip()
        remember_me = request.data.get("remember_me", True)

        if not email or not otp:
            return Response(
                {"error": "Email và OTP là bắt buộc."},
                status=status.HTTP_400_BAD_REQUEST
            )

        ok, msg = verify_otp(email, otp)
        if not ok:
            return Response(
                {"error": msg},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response(
                {"error": "Không tìm thấy người dùng."},
                status=status.HTTP_404_NOT_FOUND
            )

        user.status = "active"
        user.is_verified = True
        user.last_login_at = timezone.now()
        user.save(update_fields=["status", "is_verified", "last_login_at", "updated_at"])

        if remember_me:
            access_lifetime = timedelta(days=7)
            refresh_lifetime = timedelta(days=30)
        else:
            access_lifetime = timedelta(hours=8)
            refresh_lifetime = timedelta(days=1)

        refresh = RefreshToken()
        refresh.set_exp(lifetime=refresh_lifetime)

        refresh["user_id"] = str(user.id)
        refresh["email"] = user.email
        refresh["username"] = user.username
        refresh["role"] = user.role
        refresh["remember_me"] = remember_me

        access = refresh.access_token
        access.set_exp(lifetime=access_lifetime)

        access["user_id"] = str(user.id)
        access["email"] = user.email
        access["username"] = user.username
        access["role"] = user.role
        access["remember_me"] = remember_me

        profile = getattr(user, "profile", None)

        return Response(
            {
                "message": "Xác thực OTP thành công.",
                "refresh": str(refresh),
                "access": str(access),
                "remember_me": remember_me,
                "user": {
                    "id": str(user.id),
                    "email": user.email,
                    "username": user.username,
                    "role": user.role,
                    "status": user.status,
                    "is_verified": user.is_verified,
                    "display_name": profile.display_name if profile else user.username,
                    "avatar_url": profile.avatar_url if profile else None,
                    "preferred_language": profile.preferred_language if profile else "vi",
                }
            },
            status=status.HTTP_200_OK
        )

# ==========================================================
# API ĐĂNG NHẬP
# - serializer kiểm tra tài khoản + tạo JWT
# - view chỉ việc gọi serializer và trả data
# ==========================================================
class MyTokenObtainPairView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = MyTokenObtainPairSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data, status=status.HTTP_200_OK)


# ==========================================================
# API LẤY USER HIỆN TẠI
# - cần access token hợp lệ
# - request.user sẽ được DRF + SimpleJWT gắn vào
# ==========================================================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_current_user(request):
    user = request.user
    profile = getattr(user, "profile", None)

    return Response(
        {
            "user": {
                "id": str(user.id),
                "email": user.email,
                "username": user.username,
                "role": user.role,
                "status": user.status,
                "is_verified": user.is_verified,
                "display_name": profile.display_name if profile else user.username,
                "avatar_url": profile.avatar_url if profile else None,
                "preferred_language": profile.preferred_language if profile else "vi",
            }
        },
        status=status.HTTP_200_OK,
    )


# ==========================================================
# API QUÊN MẬT KHẨU
# - nhận email
# - nếu user tồn tại thì gửi OTP reset
# ==========================================================
class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email")

        if not email:
            return Response(
                {"error": "Email là bắt buộc."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            User.objects.get(email=email)
        except User.DoesNotExist:
            return Response(
                {"error": "Không tìm thấy người dùng."},
                status=status.HTTP_404_NOT_FOUND,
            )

        send_forgot_password_otp_email(email)

        return Response(
            {"message": "OTP đặt lại mật khẩu đã được gửi về email."},
            status=status.HTTP_200_OK,
        )


# ==========================================================
# API VERIFY OTP RESET PASSWORD
# - nếu OTP đúng thì tạo reset_token tạm thời
# ==========================================================
class VerifyResetOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email")
        otp = request.data.get("otp")

        if not email or not otp:
            return Response(
                {"error": "Email và OTP là bắt buộc."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ok, msg = verify_otp(email, otp)
        if not ok:
            return Response(
                {"error": msg},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Tạo token reset ngẫu nhiên sau khi OTP hợp lệ
        reset_token = str(uuid.uuid4())
        save_reset_token(email, reset_token)

        return Response(
            {
                "message": "OTP hợp lệ.",
                "reset_token": reset_token,
            },
            status=status.HTTP_200_OK,
        )


# ==========================================================
# API RESET PASSWORD
# - nhận email + reset_token + password1/password2
# - verify reset_token trước khi đổi mật khẩu
# ==========================================================
class ResetPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = request.data.get("email")
        reset_token = request.data.get("reset_token")

        if not email or not reset_token:
            return Response(
                {"error": "Email và reset_token là bắt buộc."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ok, msg = verify_reset_token(email, reset_token)
        if not ok:
            return Response(
                {"error": msg},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response(
                {"error": "Không tìm thấy người dùng."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Project này dùng password_hash nên hash thủ công
        user.password_hash = make_password(serializer.validated_data["password1"])
        user.status = "active"
        user.save(update_fields=["password_hash", "status", "updated_at"])

        return Response(
            {"message": "Đặt lại mật khẩu thành công."},
            status=status.HTTP_200_OK,
        )


# ==========================================================
# API GOOGLE LOGIN
# - giống tinh thần DNF
# - verify id_token với Google
# - tìm hoặc tạo user
# - trả refresh/access token
# ==========================================================
class GoogleLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        id_token = request.data.get("id_token")

        if not id_token:
            return Response(
                {"detail": "Thiếu id_token"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            r = requests.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"id_token": id_token},
                timeout=5,
            )
        except Exception:
            return Response(
                {"detail": "Lỗi xác thực token với Google"},
                status=status.HTTP_400_BAD_REQUEST
            )

        if r.status_code != 200:
            return Response(
                {"detail": "Google token không hợp lệ"},
                status=status.HTTP_400_BAD_REQUEST
            )

        data = r.json()
        aud = data.get("aud")
        email = data.get("email")
        email_verified = str(data.get("email_verified", "")).lower() in ["true", "1"]

        # Kiểm tra đúng Google client id của project
        if aud != settings.GOOGLE_CLIENT_ID:
            return Response(
                {"detail": "Sai client_id"},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not email or not email_verified:
            return Response(
                {"detail": "Email chưa được Google xác thực"},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = User.objects.filter(email=email).first()

        # Nếu chưa có user thì tạo mới
        if not user:
            # username sinh tự động từ phần trước @
            base_username = email.split("@")[0]
            username = base_username

            # Nếu username trùng thì nối thêm số
            counter = 1
            while User.objects.filter(username=username).exists():
                username = f"{base_username}{counter}"
                counter += 1

            user = User.objects.create(
            email=email,
            username=username,
            password_hash="",
            role="user",
            status="active",
            auth_provider="google",
            is_verified=True,
            )

        refresh = RefreshToken()
        refresh["user_id"] = str(user.id)
        refresh["email"] = user.email
        refresh["username"] = user.username
        refresh["role"] = user.role

        access = refresh.access_token
        access["user_id"] = str(user.id)
        access["email"] = user.email
        access["username"] = user.username
        access["role"] = user.role

        profile = getattr(user, "profile", None)

        return Response(
            {
                "refresh": str(refresh),
                "access": str(access),
                "user": {
                    "id": str(user.id),
                    "email": user.email,
                    "username": user.username,
                    "role": user.role,
                    "status": user.status,
                    "is_verified": user.is_verified,
                    "display_name": profile.display_name if profile else user.username,
                    "avatar_url": profile.avatar_url if profile else None,
                    "preferred_language": profile.preferred_language if profile else "vi",
                }
            },
            status=status.HTTP_200_OK
        )

class AdminUsersListView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        users = User.objects.select_related("profile").order_by("-created_at")
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