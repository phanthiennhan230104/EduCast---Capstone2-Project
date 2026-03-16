import json
from datetime import timedelta

from django.core import signing
from django.contrib.auth.hashers import make_password, check_password
from django.db import transaction
from django.db.models import Q
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import User, UserProfile, UserSettings

TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 7  # 7 days
TOKEN_SALT = "educast-auth-token"


def parse_json_body(request):
    try:
        return json.loads(request.body.decode("utf-8"))
    except Exception:
        return None


def make_token(user):
    payload = {
        "user_id": user.id,
        "email": user.email,
        "username": user.username,
        "exp": (timezone.now() + timedelta(seconds=TOKEN_MAX_AGE_SECONDS)).timestamp(),
    }
    return signing.dumps(payload, salt=TOKEN_SALT)


def get_user_from_token(request):
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None

    token = auth_header.replace("Bearer ", "").strip()

    try:
        payload = signing.loads(token, salt=TOKEN_SALT, max_age=TOKEN_MAX_AGE_SECONDS)
        user_id = payload.get("user_id")
        return User.objects.filter(id=user_id).first()
    except Exception:
        return None


def user_to_dict(user):
    profile = getattr(user, "profile", None)

    return {
        "id": user.id,
        "email": user.email,
        "username": user.username,
        "role": user.role,
        "status": user.status,
        "is_verified": user.is_verified,
        "display_name": profile.display_name if profile else user.username,
        "avatar_url": profile.avatar_url if profile else None,
        "preferred_language": profile.preferred_language if profile else "vi",
    }


@csrf_exempt
@require_http_methods(["POST"])
def register_view(request):
    data = parse_json_body(request)
    if data is None:
        return JsonResponse({"message": "Invalid JSON body."}, status=400)

    full_name = str(data.get("full_name", "")).strip()
    username = str(data.get("username", "")).strip()
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", "")).strip()
    confirm_password = str(data.get("confirm_password", "")).strip()

    if not full_name:
        return JsonResponse({"message": "Full name is required."}, status=400)

    if not username:
        return JsonResponse({"message": "Username is required."}, status=400)

    if not email:
        return JsonResponse({"message": "Email is required."}, status=400)

    if not password:
        return JsonResponse({"message": "Password is required."}, status=400)

    if len(password) < 6:
        return JsonResponse({"message": "Password must be at least 6 characters."}, status=400)

    if password != confirm_password:
        return JsonResponse({"message": "Passwords do not match."}, status=400)

    if User.objects.filter(email__iexact=email).exists():
        return JsonResponse({"message": "Email already exists."}, status=400)

    if User.objects.filter(username__iexact=username).exists():
        return JsonResponse({"message": "Username already exists."}, status=400)

    with transaction.atomic():
        user = User.objects.create(
            email=email,
            username=username,
            password_hash=make_password(password),
            role="user",
            status="active",
            auth_provider="local",
            is_verified=False,
        )

        UserProfile.objects.create(
            user=user,
            display_name=full_name,
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

    token = make_token(user)

    return JsonResponse(
        {
            "message": "Register successful.",
            "token": token,
            "user": user_to_dict(user),
        },
        status=201,
    )


@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
def login_view(request):
    if request.method == "OPTIONS":
        return JsonResponse({"message": "OK"}, status=200)

    data = parse_json_body(request)
    if data is None:
        return JsonResponse({"message": "Invalid JSON body."}, status=400)

    identifier = str(data.get("identifier", "")).strip()
    password = str(data.get("password", "")).strip()

    if not identifier or not password:
        return JsonResponse({"message": "Identifier and password are required."}, status=400)

    user = User.objects.filter(
        Q(email__iexact=identifier) | Q(username__iexact=identifier)
    ).first()

    if not user:
        return JsonResponse({"message": "Invalid email/username or password."}, status=401)

    if user.status != "active":
        return JsonResponse({"message": f"Your account is currently {user.status}."}, status=403)

    if not check_password(password, user.password_hash):
        return JsonResponse({"message": "Invalid email/username or password."}, status=401)

    user.last_login_at = timezone.now()
    user.save(update_fields=["last_login_at", "updated_at"])

    token = make_token(user)

    return JsonResponse(
        {
            "message": "Login successful.",
            "token": token,
            "user": user_to_dict(user),
        },
        status=200,
    )


@csrf_exempt
@require_http_methods(["GET", "OPTIONS"])
def me_view(request):
    if request.method == "OPTIONS":
        return JsonResponse({"message": "OK"}, status=200)

    user = get_user_from_token(request)
    if not user:
        return JsonResponse({"message": "Unauthorized."}, status=401)

    return JsonResponse(
        {
            "user": user_to_dict(user),
        },
        status=200,
    )


@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
def logout_view(request):
    if request.method == "OPTIONS":
        return JsonResponse({"message": "OK"}, status=200)

    return JsonResponse({"message": "Logout successful."}, status=200)