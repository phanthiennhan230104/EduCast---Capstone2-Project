from datetime import timedelta
import uuid

from django.contrib.auth.hashers import make_password, check_password
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User, UserProfile, UserSettings


# ==========================================================
# SERIALIZER ĐĂNG KÝ
# - validate dữ liệu đầu vào
# - create user mới
# - tạo profile và settings mặc định
# ==========================================================
class RegisterSerializer(serializers.Serializer):
    full_name = serializers.CharField(required=True, write_only=True)
    username = serializers.CharField(required=True)
    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, min_length=6)
    confirm_password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        full_name = attrs.get("full_name", "").strip()
        username = attrs.get("username", "").strip()
        email = attrs.get("email", "").strip().lower()
        password = attrs.get("password", "").strip()
        confirm_password = attrs.get("confirm_password", "").strip()

        if not full_name:
            raise serializers.ValidationError({"full_name": "Họ tên là bắt buộc."})

        if not username:
            raise serializers.ValidationError({"username": "Username là bắt buộc."})

        if not email:
            raise serializers.ValidationError({"email": "Email là bắt buộc."})

        if not password:
            raise serializers.ValidationError({"password": "Mật khẩu là bắt buộc."})

        if password != confirm_password:
            raise serializers.ValidationError({"confirm_password": "Mật khẩu xác nhận không khớp."})

        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError({"email": "Email đã tồn tại."})

        if User.objects.filter(username__iexact=username).exists():
            raise serializers.ValidationError({"username": "Username đã tồn tại."})

        attrs["full_name"] = full_name
        attrs["username"] = username
        attrs["email"] = email
        return attrs

    def create(self, validated_data):
        user = User.objects.create(
            email=validated_data["email"],
            username=validated_data["username"],
            password_hash=make_password(validated_data["password"]),
            role="user",
            status="inactive",
            auth_provider="local",
            is_verified=False,
        )

        UserProfile.objects.create(
            user=user,
            display_name=validated_data["full_name"],
            preferred_language="vi",
            interests=[],
        )

        UserSettings.objects.create(
            user=user,
            email_notifications=True,
            push_notifications=True,
            notify_likes=True,
            notify_comments=True,
            notify_follows=True,
            notify_messages=True,
            profile_visibility="public",
            allow_messages_from="everyone",
            autoplay_audio=True,
            theme_mode="dark",
            language_code="vi",
        )

        return user


# ==========================================================
# SERIALIZER LOGIN
# - kiểm tra email/username + password
# - kiểm tra trạng thái tài khoản
# - tạo JWT
# - nếu remember_me=True thì token sống lâu hơn
# ==========================================================
class MyTokenObtainPairSerializer(serializers.Serializer):
    identifier = serializers.CharField(required=True)
    password = serializers.CharField(write_only=True)
    remember_me = serializers.BooleanField(required=False, default=False)

    def validate(self, attrs):
        identifier = attrs.get("identifier", "").strip()
        password = attrs.get("password", "").strip()
        remember_me = attrs.get("remember_me", False)

        if not identifier:
            raise serializers.ValidationError({"identifier": "Email hoặc username là bắt buộc."})

        if not password:
            raise serializers.ValidationError({"password": "Mật khẩu là bắt buộc."})

        user = User.objects.filter(email__iexact=identifier).first()
        if not user:
            user = User.objects.filter(username__iexact=identifier).first()

        if not user:
            raise serializers.ValidationError({"detail": "Sai email/username hoặc mật khẩu."})

        if not check_password(password, user.password_hash):
            raise serializers.ValidationError({"detail": "Sai email/username hoặc mật khẩu."})

        if user.status != "active":
            raise serializers.ValidationError({"detail": "Tài khoản hiện không hoạt động."})

        # Thời gian sống token theo remember_me
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

        user.last_login_at = timezone.now()
        user.save(update_fields=["last_login_at", "updated_at"])

        profile = getattr(user, "profile", None)

        return {
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
        }


# ==========================================================
# SERIALIZER RESET PASSWORD
# ==========================================================
class ResetPasswordSerializer(serializers.Serializer):
    password1 = serializers.CharField(write_only=True, required=True, min_length=6)
    password2 = serializers.CharField(write_only=True, required=True, min_length=6)

    def validate(self, attrs):
        if attrs.get("password1") != attrs.get("password2"):
            raise serializers.ValidationError({"password": "Mật khẩu xác nhận không khớp."})
        return attrs
    
class AdminUserListSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "username",
            "role",
            "status",
            "is_verified",
            "last_login_at",
            "created_at",
            "display_name",
            "avatar_url",
        ]

    def get_display_name(self, obj):
        profile = getattr(obj, "profile", None)
        return profile.display_name if profile else obj.username

    def get_avatar_url(self, obj):
        profile = getattr(obj, "profile", None)
        return profile.avatar_url if profile else None