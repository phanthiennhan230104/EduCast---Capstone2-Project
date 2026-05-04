import uuid
from django.conf import settings
from django.db import models


def generate_id():
    return uuid.uuid4().hex[:26]


gen_id = generate_id


class ChatRoom(models.Model):
    ROOM_TYPE_CHOICES = (
        ("direct", "Direct"),
        ("group", "Group"),
    )

    id = models.CharField(primary_key=True, max_length=26, default=generate_id, editable=False)
    room_type = models.CharField(max_length=20, choices=ROOM_TYPE_CHOICES, default="direct")
    name = models.CharField(max_length=255, null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column="created_by",
        related_name="created_chat_rooms",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "chat_rooms"
        managed = False

    def __str__(self):
        return f"{self.room_type}:{self.id}"


class ChatRoomMember(models.Model):
    id = models.CharField(primary_key=True, max_length=26, default=generate_id, editable=False)
    room = models.ForeignKey(
        ChatRoom,
        on_delete=models.CASCADE,
        db_column="room_id",
        related_name="members",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        db_column="user_id",
        related_name="chat_room_memberships",
    )
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "chat_room_members"
        managed = False
        unique_together = ("room", "user")

    def __str__(self):
        return f"{self.user_id}@{self.room_id}"


class Message(models.Model):
    MESSAGE_TYPE_CHOICES = (
        ("text", "Text"),
        ("image", "Image"),
        ("audio", "Audio"),
        ("file", "File"),
        ("podcast", "Podcast"),
    )

    id = models.CharField(primary_key=True, max_length=26, default=generate_id, editable=False)
    room = models.ForeignKey(
        ChatRoom,
        on_delete=models.CASCADE,
        db_column="room_id",
        related_name="messages",
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        db_column="sender_id",
        related_name="sent_chat_messages",
    )
    content = models.TextField(null=True, blank=True)
    message_type = models.CharField(max_length=20, choices=MESSAGE_TYPE_CHOICES, default="text")
    attachment_url = models.CharField(max_length=500, null=True, blank=True)
    original_filename = models.CharField(max_length=255, null=True, blank=True)
    file_size = models.BigIntegerField(null=True, blank=True)
    is_edited = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "messages"
        managed = False
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.id}:{self.message_type}"


class MessageRead(models.Model):
    id = models.CharField(primary_key=True, max_length=26, default=generate_id, editable=False)
    message = models.ForeignKey(
        Message,
        on_delete=models.CASCADE,
        db_column="message_id",
        related_name="reads",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        db_column="user_id",
        related_name="chat_message_reads",
    )
    read_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "message_reads"
        managed = False
        unique_together = ("message", "user")

    def __str__(self):
        return f"{self.user_id} read {self.message_id}"