import json
import logging
import traceback

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

from .models import ChatRoom
from .serializers import MessageSerializer
from .services import (
    broadcast_presence_to_related_users,
    broadcast_room_snapshot,
    create_message,
    inbox_group_name,
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

        if not self.user or self.user.is_anonymous:
            logger.warning("WS rejected: anonymous user")
            await self.close(code=4001)
            return

        try:
            is_member = await self._is_member()
            logger.info("WS membership check room_id=%s user_id=%s is_member=%s", self.room_id, self.user.id, is_member)

            if not is_member:
                logger.warning("WS rejected")
                await self.accept()
                await self.send(text_data="NOT MEMBER")
                await self.close(code=4003)
                return
            
            await self.channel_layer.group_add(self.group_name, self.channel_name)
            await self.accept()

            became_online = await self._mark_online()
            if became_online:
                await self._broadcast_presence("online")
        except Exception as e:
            logger.error("CHAT CONSUMER CONNECT ERROR: %s", e, exc_info=True)
            await self.close(code=1011)

    async def disconnect(self, close_code):
        logger.info(
            "WS disconnect room_id=%s user=%s code=%s",
            self.room_id,
            getattr(self.user, "id", None),
            close_code,
        )
        if getattr(self, "user", None):
            became_offline = await self._mark_offline()
            if became_offline:
                await self._broadcast_presence("offline")

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
        original_filename = payload.get("filename")
        file_size = payload.get("size")

        if message_type == "text" and not content:
            return

        if message_type in {"image", "audio", "file"} and not attachment_url:
            return

        serialized = await self._create_and_serialize_message(
            content=content,
            message_type=message_type,
            attachment_url=attachment_url,
            original_filename=original_filename,
            file_size=file_size,
        )

        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "message_event",
                "event_type": "message_created",
                "message": serialized,
            },
        )

        await self._broadcast_room_snapshot("conversation_updated")

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

        await self._broadcast_room_snapshot("conversation_updated")

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
        return mark_user_online(self.user.id)

    @database_sync_to_async
    def _mark_offline(self):
        return mark_user_offline(self.user.id)

    @database_sync_to_async
    def _broadcast_presence(self, status):
        broadcast_presence_to_related_users(user=self.user, status=status)

    @database_sync_to_async
    def _create_and_serialize_message(
        self,
        *,
        content,
        message_type,
        attachment_url,
        original_filename=None,
        file_size=None,
    ):
        room = ChatRoom.objects.get(id=self.room_id)
        message = create_message(
            room=room,
            sender=self.user,
            content=content,
            message_type=message_type,
            attachment_url=attachment_url,
            original_filename=original_filename,
            file_size=file_size,
        )
        return MessageSerializer(message, context={"request": None, "user": self.user}).data

    @database_sync_to_async
    def _broadcast_room_snapshot(self, event_type):
        room = ChatRoom.objects.get(id=self.room_id)
        broadcast_room_snapshot(room=room, event_type=event_type)

    @database_sync_to_async
    def _mark_room_read(self):
        room = ChatRoom.objects.get(id=self.room_id)
        return mark_room_as_read(room=room, user=self.user)
    
class ChatInboxConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        try:
            logger.info("CHAT INBOX CONNECT START")
            self.user = self.scope.get("user")
            logger.info(
                "CHAT INBOX USER=%s",
                getattr(self.user, "id", None),
            )    
            if not self.user:
                await self.close(code=4001)
                return

            self.group_name = inbox_group_name(self.user.id)
            await self.channel_layer.group_add(self.group_name, self.channel_name)
            await self.accept()

        except Exception as e:
            print("INBOX CONNECT ERROR:", e)

            traceback.print_exc()

            await self.close(code=1011)

        logger.info("CHAT INBOX ACCEPTED")  

        became_online = await self._mark_online()
        if became_online:
            await self._broadcast_presence("online")

    async def disconnect(self, close_code):
        logger.info(
            "CHAT INBOX DISCONNECT code=%s",
            close_code,
        )
        if getattr(self, "user", None):
            became_offline = await self._mark_offline()
            if became_offline:
                await self._broadcast_presence("offline")

        if getattr(self, "channel_layer", None) and getattr(self, "group_name", None):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def inbox_event(self, event):
        await self.send(text_data=json.dumps({
            "type": event["event_type"],
            "conversation": event["conversation"],
        }))

    async def presence_event(self, event):
        await self.send(text_data=json.dumps({
            "type": "presence",
            "user_id": event["user_id"],
            "status": event["status"],
        }))

    @database_sync_to_async
    def _mark_online(self):
        return mark_user_online(self.user.id)

    @database_sync_to_async
    def _mark_offline(self):
        return mark_user_offline(self.user.id)

    @database_sync_to_async
    def _broadcast_presence(self, status):
        broadcast_presence_to_related_users(user=self.user, status=status)