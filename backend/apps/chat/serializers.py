from rest_framework import serializers

from apps.users.models import User
from .models import ChatRoom, Message
from .services import (
    get_room_last_message,
    get_room_other_user,
    get_room_unread_count,
    is_user_online,
)


class ChatUserSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()
    is_online = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "email", "display_name", "avatar_url", "is_online"]

    def get_display_name(self, obj):
        return getattr(obj, "display_name", None) or getattr(obj, "full_name", None) or obj.username

    def get_avatar_url(self, obj):
        return getattr(obj, "avatar_url", None)

    def get_is_online(self, obj):
        return is_user_online(obj.id)


class MessageSerializer(serializers.ModelSerializer):
    sender = ChatUserSerializer(read_only=True)
    read_by_user_ids = serializers.SerializerMethodField()
    is_mine = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            "id",
            "room",
            "sender",
            "content",
            "message_type",
            "attachment_url",
            "is_edited",
            "is_deleted",
            "created_at",
            "updated_at",
            "read_by_user_ids",
            "is_mine",
        ]

    def get_read_by_user_ids(self, obj):
        return list(obj.reads.values_list("user_id", flat=True))

    def get_is_mine(self, obj):
        request = self.context.get("request")
        return bool(request and request.user and str(request.user.id) == str(obj.sender_id))


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