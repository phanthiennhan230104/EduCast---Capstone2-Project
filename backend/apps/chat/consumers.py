import json
import logging

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

from .models import ChatRoom
from .serializers import MessageSerializer
from .services import (
    create_message,
    mark_room_as_read,
    mark_user_offline,
    mark_user_online,
    user_is_room_member,
)

logger = logging.getLogger(__name__)


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_id = self.scope["url_route"]["kwargs"]["room_id"]
        self.group_name = f"chat_{self.room_id}"
        self.user = self.scope.get("user")

        logger.info("WS connect room_id=%s user=%s", self.room_id, getattr(self.user, "id", None))

        if not self.user:
            logger.warning("WS rejected: no user in scope")
            await self.close(code=4001)
            return

        is_member = await self._is_member()
        logger.info("WS membership check room_id=%s user_id=%s is_member=%s", self.room_id, self.user.id, is_member)

        if not is_member:
            logger.warning("WS rejected: user %s not in room %s", self.user.id, self.room_id)
            await self.close(code=4003)
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        await self._mark_online()
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "presence_event",
                "user_id": str(self.user.id),
                "status": "online",
            },
        )

    async def disconnect(self, close_code):
        if getattr(self, "user", None):
            await self._mark_offline()
            if getattr(self, "channel_layer", None):
                await self.channel_layer.group_send(
                    self.group_name,
                    {
                        "type": "presence_event",
                        "user_id": str(self.user.id),
                        "status": "offline",
                    },
                )
        if getattr(self, "channel_layer", None):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        if not text_data:
            return

        payload = json.loads(text_data)
        action = payload.get("action")

        if action == "send_message":
            await self._handle_send_message(payload)
        elif action == "mark_read":
            await self._handle_mark_read()

    async def _handle_send_message(self, payload):
        message_type = payload.get("message_type", "text")
        content = (payload.get("content") or "").strip()
        attachment_url = payload.get("attachment_url")

        if message_type == "text" and not content:
            return

        if message_type in {"image", "audio", "file"} and not attachment_url:
            return

        serialized = await self._create_and_serialize_message(
            content=content,
            message_type=message_type,
            attachment_url=attachment_url,
        )

        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "message_event",
                "message": serialized,
            },
        )

    async def _handle_mark_read(self):
        read_count = await self._mark_room_read()
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "read_event",
                "room_id": self.room_id,
                "user_id": str(self.user.id),
                "read_count": read_count,
            },
        )

    async def message_event(self, event):
        await self.send(text_data=json.dumps({
            "type": "message_created",
            "message": event["message"],
        }))

    async def presence_event(self, event):
        await self.send(text_data=json.dumps({
            "type": "presence",
            "user_id": event["user_id"],
            "status": event["status"],
        }))

    async def read_event(self, event):
        await self.send(text_data=json.dumps({
            "type": "messages_read",
            "room_id": event["room_id"],
            "user_id": event["user_id"],
            "read_count": event["read_count"],
        }))

    @database_sync_to_async
    def _is_member(self):
        return user_is_room_member(self.user, self.room_id)

    @database_sync_to_async
    def _mark_online(self):
        mark_user_online(self.user.id)

    @database_sync_to_async
    def _mark_offline(self):
        mark_user_offline(self.user.id)

    @database_sync_to_async
    def _create_and_serialize_message(self, *, content, message_type, attachment_url):
        room = ChatRoom.objects.get(id=self.room_id)
        message = create_message(
            room=room,
            sender=self.user,
            content=content,
            message_type=message_type,
            attachment_url=attachment_url,
        )
        return MessageSerializer(message, context={"request": None}).data

    @database_sync_to_async
    def _mark_room_read(self):
        room = ChatRoom.objects.get(id=self.room_id)
        return mark_room_as_read(room=room, user=self.user)