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
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.contrib.auth.hashers import make_password
from django.utils import timezone
from .permissions import IsAdminRole
from datetime import timedelta
from django.shortcuts import get_object_or_404
from django.db.models import Q, Count


from .models import User, UserProfile, UserSettings
from .serializers import (
    RegisterSerializer,
    MyTokenObtainPairSerializer,
    ResetPasswordSerializer,
    UserProfileSerializer,
    AdminUserListSerializer,
)
from .utils import (
    get_active_lock,
    sync_user_lock_status,
    verify_otp,
    verify_reset_token,
    send_register_otp_email,
    send_forgot_password_otp_email,
    save_reset_token,
    send_google_password_email,
    generate_random_password,
    unlock_expired_lock_for_user,
    save_signup_temp_data,
    get_signup_temp_data,
    delete_signup_temp_data,
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
        
        # Validate dữ liệu
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            logger.error(f"Register validation errors: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # Lấy dữ liệu validate từ serializer
        validated_data = serializer.validated_data
        email = validated_data["email"]

        # Lưu dữ liệu tạm vào cache (chưa lưu vào database)
        # Dữ liệu sẽ được xóa sau 15 phút nếu không verify OTP
        signup_data = {
            "full_name": validated_data["full_name"],
            "username": validated_data["username"],
            "email": email,
            "password": validated_data["password"],
        }
        save_signup_temp_data(email, signup_data)

        # Gửi OTP xác thực
        send_register_otp_email(email)

        logger.info(f"Register temp data saved for email: {email}")

        # Trả về email để frontend dùng cho bước verify OTP
        return Response(
            {
                "message": "Đăng ký thành công. OTP đã được gửi về email.",
                "email": email,
            },
            status=status.HTTP_201_CREATED,
        )



# ==========================================================
# API XÁC THỰC OTP SAU ĐĂNG KÝ
# - nếu OTP đúng thì:
#   1) Lấy dữ liệu từ cache
#   2) Tạo user vào database
#   3) Tạo profile + settings
#   4) Tạo JWT tokens
#   5) Xóa dữ liệu tạm từ cache
# ==========================================================
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

        # Verify OTP
        ok, msg = verify_otp(email, otp)
        if not ok:
            return Response(
                {"error": msg},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Lấy dữ liệu tạm từ cache
        signup_data = get_signup_temp_data(email)
        if not signup_data:
            return Response(
                {"error": "Dữ liệu đăng ký đã hết hạn. Vui lòng đăng ký lại."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Tạo user vào database
        try:
            user = User.objects.create(
                email=email,
                username=signup_data["username"],
                password_hash=make_password(signup_data["password"]),
                role="user",
                status="active",  # Active ngay sau verify OTP
                auth_provider="local",
                is_verified=True,
                last_login_at=timezone.now(),
            )

            # Tạo profile
            UserProfile.objects.create(
                user=user,
                display_name=signup_data["full_name"],
                preferred_language="vi",
                interests=[],
            )

            # Tạo settings
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
                language_code="en" if mode == "translate" else "vi",
            )

            logger.info(f"User account created for email: {email}")
        except Exception as e:
            logger.error(f"Error creating user account: {str(e)}")
            # Nếu user đã tồn tại, xóa dữ liệu tạm từ cache
            delete_signup_temp_data(email)
            
            error_msg = str(e)
            if "unique constraint" in error_msg.lower() or "duplicate" in error_msg.lower():
                return Response(
                    {"error": "Email hoặc username này đã tồn tại. Vui lòng thử lại với email khác."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            return Response(
                {"error": "Lỗi tạo tài khoản. Vui lòng thử lại."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        # Tạo JWT tokens
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

        # Xóa dữ liệu tạm từ cache
        delete_signup_temp_data(email)

        return Response(
            {
                "message": "Xác thực OTP thành công. Tài khoản đã được tạo.",
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
        logger.info(f"Login request data: {request.data}")
        serializer = MyTokenObtainPairSerializer(data=request.data)
        if not serializer.is_valid():
            logger.error(f"Login validation errors: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        user = serializer.user
        user.last_login_at = timezone.now()
        user.save(update_fields=["last_login_at", "updated_at"])
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
                "bio": profile.bio if profile else "",
                "avatar_url": profile.avatar_url if profile else None,
                "preferred_language": profile.preferred_language if profile else "vi",
                "favorite_topics": [{'id': t.id, 'name': t.name} for t in profile.favorite_topics.all()] if profile else [],
            }
        },
        status=status.HTTP_200_OK,
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def get_user_profile(request, user_id):
    """Get user profile by user_id - respects profile_visibility settings"""
    try:
        user = User.objects.filter(Q(id=user_id) | Q(username=user_id)).first()
        if not user:
            raise User.DoesNotExist
        user_id = user.id
        profile = getattr(user, "profile", None)
        
        # Get user settings to check profile_visibility
        user_settings, _ = UserSettings.objects.get_or_create(
            user=user,
            defaults={
                "profile_visibility": "public",
                "allow_messages_from": "everyone",
            }
        )
        
        # Import Follow and Post models
        from apps.social.models import Follow
        from apps.content.models import Post
        
        # Check visibility permissions
        current_user = request.user if request.user.is_authenticated else None
        can_view_profile = False
        not_accessible_reason = None
        
        if user_settings.profile_visibility == "public":
            # Bất kỳ ai cũng có thể xem
            can_view_profile = True
        elif user_settings.profile_visibility == "followers_only":
            # Chỉ những người theo dõi mới xem được
            if current_user and current_user.id != user_id:
                is_follower = Follow.objects.filter(
                    follower_id=current_user.id,
                    following_id=user_id
                ).exists()
                can_view_profile = is_follower
                if not can_view_profile:
                    not_accessible_reason = "followers_only"
            elif current_user and current_user.id == user_id:
                # Chính user đó luôn xem được
                can_view_profile = True
            else:
                # Chưa đăng nhập
                not_accessible_reason = "followers_only"
        elif user_settings.profile_visibility == "private":
            # Chỉ chính user đó mới xem được (hoặc admin)
            if current_user:
                can_view_profile = (current_user.id == user_id or current_user.role == "admin")
                if not can_view_profile:
                    not_accessible_reason = "private"
            else:
                not_accessible_reason = "private"
        
        # Nếu không thể xem profile - trả về thông báo thân thiện
        if not can_view_profile:
            response_data = {
                "data": {
                    "id": str(user.id),
                    "username": user.username,
                    "display_name": profile.display_name if profile else user.username,
                    "avatar_url": profile.avatar_url if profile else None,
                    "profile_visibility": user_settings.profile_visibility,
                }
            }
            
            if not_accessible_reason == "private":
                response_data["is_accessible"] = False
                response_data["message"] = "Người này đã để trang cá nhân riêng tư"
            elif not_accessible_reason == "followers_only":
                response_data["is_accessible"] = False
                response_data["message"] = "Chỉ những người theo dõi mới xem được bài viết của người này"
            
            return Response(response_data, status=status.HTTP_200_OK)
        
        # Get follower/following counts
        followers_count = Follow.objects.filter(following_id=user_id).count()
        following_count = Follow.objects.filter(follower_id=user_id).count()
        
        # Get podcast count (published posts by this user)
        podcast_count = Post.objects.filter(
            user_id=user_id,
            status="published"
        ).count()
        
        return Response(
            {
                "data": {
                    "id": str(user.id),
                    "email": user.email,
                    "username": user.username,
                    "display_name": profile.display_name if profile else user.username,
                    "avatar_url": profile.avatar_url if profile else None,
                    "cover_url": profile.cover_url if profile else None,
                    "bio": profile.bio if profile else "",
                    "followers_count": followers_count,
                    "following_count": following_count,
                    "podcast_count": podcast_count,
                    "preferred_language": profile.preferred_language if profile else "vi",
                    "profile_visibility": user_settings.profile_visibility,
                },
                "is_accessible": True,
            },
            status=status.HTTP_200_OK,
        )
    except User.DoesNotExist:
        return Response(
            {"error": "User not found"},
            status=status.HTTP_404_NOT_FOUND,
        )
    except Exception as e:
        logger.error(f"Error getting user profile: {str(e)}")
        return Response(
            {"error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
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

        unlock_expired_lock_for_user(user)
        sync_user_lock_status(user)
        active_lock = get_active_lock(user)
        if active_lock or user.status == "locked":
            return Response(
                {"error": "Tài khoản của bạn đang bị khóa."},
                status=status.HTTP_400_BAD_REQUEST,
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
        google_name = data.get("name", "").strip()
        google_picture = data.get("picture", "").strip()

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

        
        # email_domain = email.split('@')[-1].lower()
        # if email_domain in ['dtu.edu.vn', 'gmail.com']:
        #     return Response(
        #         {"detail": "Tài khoản email thuộc tên miền này đã bị chặn đăng nhập trên hệ thống."},
        #         status=status.HTTP_400_BAD_REQUEST
        #     )

        user = User.objects.filter(email=email).first()

        if user:
            unlock_expired_lock_for_user(user)
            sync_user_lock_status(user)
            active_lock = get_active_lock(user)
            if active_lock or user.status == "locked":
                return Response(
                    {"detail": "Tài khoản của bạn đang bị khóa."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if user.status != "active":
                return Response(
                    {"detail": "Tài khoản hiện không hoạt động."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if not user:
            base_username = email.split("@")[0]
            username = base_username

            counter = 1
            while User.objects.filter(username=username).exists():
                username = f"{base_username}{counter}"
                counter += 1

            raw_password = generate_random_password()

            user = User.objects.create(
                email=email,
                username=username,
                password_hash=make_password(raw_password),
                role="user",
                status="active",
                auth_provider="google",
                is_verified=True,
            )
            send_google_password_email(email, raw_password)

        profile, created = UserProfile.objects.get_or_create(
            user=user,
            defaults={
                "display_name": google_name or user.username,
                "avatar_url": google_picture or None,
            }
        )

        update_fields = []

        if google_name and not profile.display_name:
            profile.display_name = google_name
            update_fields.append("display_name")

        if google_picture and not profile.avatar_url:
            profile.avatar_url = google_picture
            update_fields.append("avatar_url")

        if update_fields:
            update_fields.append("updated_at")
            profile.save(update_fields=update_fields)
        
        user.last_login_at = timezone.now()
        user.save(update_fields=["last_login_at", "updated_at"])

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


class UpdateUserProfileView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        try:
            user = request.user
            profile, _ = UserProfile.objects.get_or_create(
    user=user,
    defaults={
        "display_name": user.username,
        "preferred_language": "vi",
        "interests": [],
    }
)
            
            # Import cloudinary service
            from apps.content.services.cloudinary_service import upload_file_to_cloudinary
            
            # Update display_name if provided
            if 'display_name' in request.data:
                profile.display_name = request.data['display_name']
            
            # Update bio if provided
            if 'bio' in request.data:
                profile.bio = request.data['bio']
            
            # Handle avatar upload
            if 'avatar' in request.FILES:
                avatar_file = request.FILES['avatar']
                
                # Upload to Cloudinary
                result = upload_file_to_cloudinary(
                    avatar_file,
                    folder='avatars',
                    resource_type='image'
                )
                
                if result and 'secure_url' in result:
                    profile.avatar_url = result['secure_url']
                    logger.info(f"Avatar uploaded: {profile.avatar_url}")
                else:
                    return Response(
                        {"error": "Failed to upload avatar"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            # Save profile (cần lưu trước khi set ManyToMany)
            profile.save()

            # Handle favorite topics
            if 'favorite_topics' in request.data:
                topics_data = request.data.getlist('favorite_topics') if hasattr(request.data, 'getlist') else request.data.get('favorite_topics')
                
                # Nếu gửi dưới dạng chuỗi JSON
                if isinstance(topics_data, str) or (isinstance(topics_data, list) and len(topics_data) == 1 and isinstance(topics_data[0], str) and topics_data[0].startswith('[')):
                    import json
                    try:
                        val = topics_data[0] if isinstance(topics_data, list) else topics_data
                        topics_data = json.loads(val)
                    except:
                        pass
                
                if isinstance(topics_data, list):
                    profile.favorite_topics.set(topics_data)
            
            return Response(
                {
                    "message": "Profile updated successfully",
                    "data": {
                        "display_name": profile.display_name,
                        "bio": profile.bio,
                        "avatar_url": profile.avatar_url,
                    }
                },
                status=status.HTTP_200_OK
            )
        except Exception as e:
            logger.error(f"Error updating profile: {str(e)}", exc_info=True)
            return Response(
                {"error": f"Failed to update profile: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )


class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, user_id):
        profile = get_object_or_404(UserProfile, user_id=user_id)
        serializer = UserProfileSerializer(profile)
        return Response(serializer.data)
    
class AdminUsersListView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        users = (
            User.objects.select_related("profile")
            .filter(role="user")
            .annotate(
                podcast_count=Count('posts', distinct=True),
                followers_count=Count('follower_relations', distinct=True)
            )
            .order_by("-created_at")
        )
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


class ListLoginHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        history = LoginHistory.objects.filter(user=request.user).order_by("-created_at")[:10]
        serializer = LoginHistorySerializer(history, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
