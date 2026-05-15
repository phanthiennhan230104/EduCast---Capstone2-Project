import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter

django_asgi_app = get_asgi_application()

from apps.chat.routing import websocket_urlpatterns as chat_websocket_urlpatterns
from apps.content.routing import websocket_urlpatterns as content_websocket_urlpatterns
from apps.social.routing import websocket_urlpatterns as social_websocket_urlpatterns
from apps.chat.ws_auth import JwtQueryAuthMiddlewareStack

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": JwtQueryAuthMiddlewareStack(
        URLRouter(
            chat_websocket_urlpatterns + content_websocket_urlpatterns + social_websocket_urlpatterns
        )
    ),
})