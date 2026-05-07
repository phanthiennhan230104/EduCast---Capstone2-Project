from datetime import timedelta
import uuid
import logging

from django.contrib.auth.hashers import make_password, check_password
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User, UserProfile, UserSettings, UserTagPreference
from .utils import get_active_lock, sync_user_lock_status, unlock_expired_lock_for_user

logger = logging.getLogger(__name__)


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
        # Không tạo user ở bước này
        # Dữ liệu sẽ được lưu vào database chỉ sau khi verify OTP thành công
        # Trả về dict để RegisterView lưu vào cache
        return {
            "email": validated_data["email"],
            "username": validated_data["username"],
            "full_name": validated_data["full_name"],
            "password": validated_data["password"],
        }
    


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

        logger.info(f"Validating login - identifier: {identifier}, remember_me: {remember_me}")

        if not identifier:
            error = {"identifier": "Email hoặc username là bắt buộc."}
            logger.error(f"Login validation failed: {error}")
            raise serializers.ValidationError(error)

        if not password:
            error = {"password": "Mật khẩu là bắt buộc."}
            logger.error(f"Login validation failed: {error}")
            raise serializers.ValidationError(error)

        user = User.objects.filter(email__iexact=identifier).first()
        if not user:
            user = User.objects.filter(username__iexact=identifier).first()

        if not user:
            error = {"detail": "Sai email/username hoặc mật khẩu."}
            logger.error(f"Login validation failed: user not found for identifier {identifier}")
            raise serializers.ValidationError(error)

        if not check_password(password, user.password_hash):
            error = {"detail": "Sai email/username hoặc mật khẩu."}
            logger.error(f"Login validation failed: invalid password for user {user.id}")
            raise serializers.ValidationError(error)

        unlock_expired_lock_for_user(user)
        sync_user_lock_status(user)
        active_lock = get_active_lock(user)
        if active_lock:
            if active_lock.lock_type == "permanent":
                error = {
                    "detail": f"Tài khoản của bạn đã bị khóa vĩnh viễn. Lý do: {active_lock.reason}"
                }
                logger.error(f"Login validation failed: user {user.id} account permanently locked")
                raise serializers.ValidationError(error)

            error = {
                "detail": f"Tài khoản của bạn đang bị khóa đến {active_lock.locked_until}. Lý do: {active_lock.reason}"
            }
            logger.error(f"Login validation failed: user {user.id} account locked until {active_lock.locked_until}")
            raise serializers.ValidationError(error)

        if user.status == "locked":
            error = {"detail": "Tài khoản của bạn đang bị khóa."}
            logger.error(f"Login validation failed: user {user.id} status is locked")
            raise serializers.ValidationError(error)

        if user.status != "active":
            error = {"detail": "Tài khoản hiện không hoạt động."}
            logger.error(f"Login validation failed: user {user.id} status is {user.status}")
            raise serializers.ValidationError(error)

        logger.info(f"Login validation successful for user {user.id}")
        self.user = user

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
    display_name = serializers.CharField(source="profile.display_name", read_only=True)
    avatar_url = serializers.CharField(source="profile.avatar_url", read_only=True)
    lock_history = serializers.SerializerMethodField()
    current_lock = serializers.SerializerMethodField()

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
            "updated_at",
            "display_name",
            "avatar_url",
            
            "current_lock",
            "lock_history",
        ]

    def get_lock_history(self, obj):
        logs = obj.lock_logs.all()[:10]
        return [
            {
                "id": log.id,
                "reason": log.reason,
                "lock_type": log.lock_type,
                "locked_at": log.locked_at,
                "locked_until": log.locked_until,
                "unlocked_at": log.unlocked_at,
                "unlock_reason": log.unlock_reason,
                "locked_by_id": log.locked_by_id,
                "unlocked_by_id": log.unlocked_by_id,
            }
            for log in logs
        ]

    def get_current_lock(self, obj):
        log = get_active_lock(obj)
        if not log:
            return None
        return {
            "id": log.id,
            "reason": log.reason,
            "lock_type": log.lock_type,
            "locked_at": log.locked_at,
            "locked_until": log.locked_until,
            "locked_by_id": log.locked_by_id,
        }

class AdminLockUserSerializer(serializers.Serializer):
    LOCK_TYPE_CHOICES = (
        ("temporary", "temporary"),
        ("permanent", "permanent"),
    )

    LOCK_PRESET_CHOICES = (
        ("24h", "24h"),
        ("1d", "1d"),
        ("3d", "3d"),
        ("7d", "7d"),
        ("custom", "custom"),
        ("permanent", "permanent"),
    )

    reason = serializers.CharField()
    preset = serializers.ChoiceField(choices=LOCK_PRESET_CHOICES, required=False, allow_null=True)
    lock_type = serializers.ChoiceField(choices=LOCK_TYPE_CHOICES, required=False)
    locked_until = serializers.DateTimeField(required=False, allow_null=True)

    def validate(self, attrs):
        preset = attrs.get("preset")
        lock_type = attrs.get("lock_type")
        locked_until = attrs.get("locked_until")
        now = timezone.now()

        # Ưu tiên preset nếu frontend gửi preset
        if preset:
            if preset == "permanent":
                attrs["lock_type"] = "permanent"
                attrs["locked_until"] = None
                return attrs

            attrs["lock_type"] = "temporary"

            if preset == "24h":
                attrs["locked_until"] = now + timedelta(hours=24)
            elif preset == "1d":
                attrs["locked_until"] = now + timedelta(days=1)
            elif preset == "3d":
                attrs["locked_until"] = now + timedelta(days=3)
            elif preset == "7d":
                attrs["locked_until"] = now + timedelta(days=7)
            elif preset == "custom":
                if not locked_until:
                    raise serializers.ValidationError({
                        "locked_until": "Vui lòng chọn ngày giờ khóa."
                    })
                if locked_until <= now:
                    raise serializers.ValidationError({
                        "locked_until": "Thời gian khóa phải lớn hơn hiện tại."
                    })
            return attrs

        # Fallback cho kiểu cũ nếu frontend vẫn gửi lock_type + locked_until
        if lock_type == "temporary":
            if not locked_until:
                raise serializers.ValidationError({
                    "locked_until": "Khóa tạm thời cần thời gian hết hạn."
                })
            if locked_until <= now:
                raise serializers.ValidationError({
                    "locked_until": "Thời gian khóa phải lớn hơn hiện tại."
                })

        if lock_type == "permanent":
            attrs["locked_until"] = None

        return attrs

class AdminUnlockUserSerializer(serializers.Serializer):
    unlock_reason = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class UserTagPreferenceSerializer(serializers.ModelSerializer):
    tag_name = serializers.CharField(source='tag.name', read_only=True)
    tag_id = serializers.CharField(source='tag.id', read_only=True)

    class Meta:
        model = UserTagPreference
        fields = ['id', 'tag_id', 'tag_name', 'score', 'created_at', 'updated_at']
        read_only_fields = ['id', 'tag_id', 'tag_name', 'created_at', 'updated_at']