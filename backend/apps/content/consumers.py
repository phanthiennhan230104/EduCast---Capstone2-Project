import json
from channels.generic.websocket import AsyncWebsocketConsumer

class AudioProgressConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # Lấy task_id từ URL pattern
        self.task_id = self.scope['url_route']['kwargs']['task_id']
        self.group_name = f"audio_progress_{self.task_id}"

        # Join room group
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        # Leave room group
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )

    # Receive message from room group
    async def progress_update(self, event):
        # Send message to WebSocket
        await self.send(text_data=json.dumps(event))
