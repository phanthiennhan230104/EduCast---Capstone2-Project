from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from rest_framework_simplejwt.tokens import UntypedToken

from django.core.cache import cache

from apps.users.models import User


@database_sync_to_async
def get_user_by_id(user_id):
    cache_key = f"ws_user_{user_id}"
    user = cache.get(cache_key)
    if user is None:
        try:
            user = User.objects.get(id=user_id)
            cache.set(cache_key, user, timeout=300)  # Cache for 5 minutes
        except User.DoesNotExist:
            return None
    return user


class JwtQueryAuthMiddleware:
    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        query_string = scope.get("query_string", b"").decode()
        params = parse_qs(query_string)
        token = params.get("token", [None])[0]

        scope["user"] = None

        if token:
            try:
                validated = UntypedToken(token)
                user_id = validated.get("user_id")
                user = await get_user_by_id(user_id)
                scope["user"] = user
            except Exception:
                scope["user"] = None

        return await self.inner(scope, receive, send)


def JwtQueryAuthMiddlewareStack(inner):
    return JwtQueryAuthMiddleware(inner)