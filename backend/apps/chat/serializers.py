from urllib.parse import urljoin

from django.conf import settings
from rest_framework import serializers

from apps.users.models import User
from .models import ChatRoom, Message
from .services import (
    get_room_last_message,
    get_room_other_user,
    get_room_unread_count,
    is_user_online,
)


def build_attachment_url(url: str | None) -> str | None:
    if not url:
        return None

    url = str(url).strip()
    if not url:
        return None

    if url.startswith("http://") or url.startswith("https://"):
        return url

    base_url = getattr(settings, "BACKEND_BASE_URL", "") or getattr(settings, "SITE_URL", "")
    if base_url:
        return urljoin(base_url.rstrip("/") + "/", url.lstrip("/"))

    return url


class ChatUserSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()
    is_online = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "email", "display_name", "avatar_url", "is_online"]

    def get_display_name(self, obj):
        profile = getattr(obj, "profile", None)

        return (
            profile.display_name
            if profile and profile.display_name
            else getattr(obj, "display_name", None)
            or getattr(obj, "full_name", None)
            or obj.username
        )

    def get_avatar_url(self, obj):
        profile = getattr(obj, "profile", None)

        return (
            profile.avatar_url
            if profile and profile.avatar_url
            else getattr(obj, "avatar_url", None)
        )

    def get_is_online(self, obj):
        return is_user_online(obj.id)


class MessageSerializer(serializers.ModelSerializer):
    sender = ChatUserSerializer(read_only=True)
    read_by_user_ids = serializers.SerializerMethodField()
    is_mine = serializers.SerializerMethodField()
    attachment_url = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            "id",
            "room",
            "sender",
            "content",
            "message_type",
            "attachment_url",
            "original_filename",
            "file_size",
            "is_edited",
            "is_deleted",
            "created_at",
            "updated_at",
            "read_by_user_ids",
            "is_mine",
        ]

    def get_attachment_url(self, obj):
        return build_attachment_url(obj.attachment_url)

    def get_read_by_user_ids(self, obj):
        return list(obj.reads.values_list("user_id", flat=True))

    def get_is_mine(self, obj):
        request = self.context.get("request")
        if request and getattr(request, "user", None):
            return str(request.user.id) == str(obj.sender_id)

        user = self.context.get("user")
        if user:
            return str(user.id) == str(obj.sender_id)

        return False


class ConversationSerializer(serializers.ModelSerializer):
    peer = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = ChatRoom
        fields = ["id", "room_type", "name", "peer", "last_message", "unread_count", "created_at"]

    def get_peer(self, obj):
        request = self.context["request"]
        peer = get_room_other_user(obj, request.user)
        if not peer:
            return None
        return ChatUserSerializer(peer).data

    def get_last_message(self, obj):
        message = get_room_last_message(obj)
        if not message:
            return None
        return MessageSerializer(message, context=self.context).data

    def get_unread_count(self, obj):
        request = self.context["request"]
        return get_room_unread_count(room=obj, user=request.user)


class StartDirectChatSerializer(serializers.Serializer):
    target_user_id = serializers.CharField()

    def validate_target_user_id(self, value):
        request = self.context["request"]
        if str(value) == str(request.user.id):
            raise serializers.ValidationError("Không thể chat với chính mình.")
        if not User.objects.filter(id=value).exists():
            raise serializers.ValidationError("Người dùng không tồn tại.")
        return value


class UploadAttachmentSerializer(serializers.Serializer):
    file = serializers.FileField()

    def validate_file(self, file_obj):
        max_size = 25 * 1024 * 1024
        if file_obj.size > max_size:
            raise serializers.ValidationError("File vượt quá 25MB.")
        return file_obj