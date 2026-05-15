import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer

logger = logging.getLogger(__name__)

class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope.get("user")
        
        if not self.user or not self.user.is_authenticated:
            logger.warning("NotificationConsumer: WebSocket connection rejected (unauthenticated).")
            await self.close()
            return

        self.group_name = f"user_notifications_{self.user.id}"
        
        # Join room group
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )

        await self.accept()
        logger.info(f"NotificationConsumer: User {self.user.id} connected to {self.group_name}.")

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name
            )
            logger.info(f"NotificationConsumer: User {self.user.id} disconnected from {self.group_name}.")

    # Receive message from room group
    async def send_notification(self, event):
        notification = event["notification"]

        # Send message to WebSocket
        await self.send(text_data=json.dumps({
            "type": "new_notification",
            "notification": notification
        }))
