from django.urls import re_path
from .consumers import ChatConsumer, ChatInboxConsumer

websocket_urlpatterns = [
    re_path(r"ws/chat/inbox/$", ChatInboxConsumer.as_asgi()),
    re_path(r"ws/chat/(?P<room_id>[A-Za-z0-9]+)/$", ChatConsumer.as_asgi()),
]