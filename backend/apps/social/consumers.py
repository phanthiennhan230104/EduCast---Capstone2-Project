import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer

logger = logging.getLogger(__name__)

class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope.get("user")
        self.global_group_name = "social_updates"
        self.group_name = None

        if self.user and self.user.is_authenticated:
            self.group_name = f"user_notifications_{self.user.id}"
            await self.channel_layer.group_add(
                self.group_name,
                self.channel_name
            )
        
        # All users (including guests) join global group for public updates
        await self.channel_layer.group_add(
            self.global_group_name,
            self.channel_name
        )

        if getattr(self.user, "role", "").lower() == "admin":
            await self.channel_layer.group_add(
                "admin_notifications",
                self.channel_name
            )
            logger.info(f"NotificationConsumer: Admin {self.user.id} joined admin_notifications.")

        await self.accept()
        logger.info(f"NotificationConsumer: Connected (User: {self.user.id if self.user and self.user.is_authenticated else 'Guest'})")

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name
            )
        if hasattr(self, "global_group_name"):
            await self.channel_layer.group_discard(
                self.global_group_name,
                self.channel_name
            )
            logger.info(f"NotificationConsumer: User {self.user.id} disconnected from {self.group_name}.")

        if getattr(self.user, "role", "").lower() == "admin":
            await self.channel_layer.group_discard(
                "admin_notifications",
                self.channel_name
            )
            logger.info(f"NotificationConsumer: Admin {self.user.id} left admin_notifications.")

    # Receive message from room group
    async def send_notification(self, event):
        notification = event["notification"]

        # Send message to WebSocket
        await self.send(text_data=json.dumps({
            "type": "new_notification",
            "notification": notification
        }))

    async def social_update(self, event):
        social_update = event["social_update"]
        # Send social update (follow/unfollow) to WebSocket
        await self.send(text_data=json.dumps({
            "type": "social_update",
            "social_update": social_update
        }))

    async def admin_update(self, event):
        admin_update = event["admin_update"]
        await self.send(text_data=json.dumps({
            "type": "admin_update",
            "admin_update": admin_update
        }))
