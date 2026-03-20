import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter

django_asgi_app = get_asgi_application()

from apps.chat.routing import websocket_urlpatterns
from apps.chat.ws_auth import JwtQueryAuthMiddlewareStack

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": JwtQueryAuthMiddlewareStack(
        URLRouter(websocket_urlpatterns)
    ),
})