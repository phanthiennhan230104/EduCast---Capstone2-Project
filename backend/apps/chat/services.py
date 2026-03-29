from urllib.parse import urljoin

from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.db.models import Count

from apps.users.models import User
from .models import ChatRoom, ChatRoomMember, Message, MessageRead, generate_id

from types import SimpleNamespace
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

PRESENCE_TTL_SECONDS = 90
PRESENCE_CONNECTIONS_TTL_SECONDS = 120


def presence_connections_key(user_id: str) -> str:
    return f"chat:presence:connections:{user_id}"


def mark_user_online(user_id: str):
    user_id = str(user_id)
    key = presence_connections_key(user_id)

    try:
        connections = cache.get(key, 0) or 0
        connections = int(connections) + 1
    except Exception:
        connections = 1

    cache.set(key, connections, timeout=PRESENCE_CONNECTIONS_TTL_SECONDS)
    cache.set(presence_key(user_id), True, timeout=PRESENCE_TTL_SECONDS)
    return connections == 1


def mark_user_offline(user_id: str):
    user_id = str(user_id)
    key = presence_connections_key(user_id)

    try:
        connections = int(cache.get(key, 0) or 0)
    except Exception:
        connections = 0

    connections = max(connections - 1, 0)

    if connections <= 0:
        cache.delete(key)
        cache.delete(presence_key(user_id))
        return True

    cache.set(key, connections, timeout=PRESENCE_CONNECTIONS_TTL_SECONDS)
    cache.set(presence_key(user_id), True, timeout=PRESENCE_TTL_SECONDS)
    return False


def presence_key(user_id: str) -> str:
    return f"chat:presence:{user_id}"

def mark_user_online(user_id: str):
    cache.set(presence_key(str(user_id)), True, timeout=PRESENCE_TTL_SECONDS)

def mark_user_offline(user_id: str):
    cache.delete(presence_key(str(user_id)))


def is_user_online(user_id: str) -> bool:
    return bool(cache.get(presence_key(str(user_id))))


def user_is_room_member(user, room_id: str) -> bool:
    return ChatRoomMember.objects.filter(room_id=room_id, user=user).exists()


def get_or_create_direct_room(user_a: User, user_b: User) -> ChatRoom:
    room_ids_a = set(
        ChatRoomMember.objects.filter(user=user_a).values_list("room_id", flat=True)
    )
    room_ids_b = set(
        ChatRoomMember.objects.filter(user=user_b).values_list("room_id", flat=True)
    )
    common_room_ids = room_ids_a.intersection(room_ids_b)

    room = (
        ChatRoom.objects.filter(id__in=common_room_ids, room_type="direct")
        .annotate(member_count=Count("members"))
        .filter(member_count=2)
        .first()
    )
    if room:
        return room

    with transaction.atomic():
        room = ChatRoom.objects.create(
            id=generate_id(),
            room_type="direct",
            created_by=user_a,
        )
        ChatRoomMember.objects.create(id=generate_id(), room=room, user=user_a)
        ChatRoomMember.objects.create(id=generate_id(), room=room, user=user_b)

    return room

def normalize_attachment_url(url: str | None) -> str | None:
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

    media_url = getattr(settings, "MEDIA_URL", "/media/")
    if url.startswith(media_url) or url.startswith("/media/"):
        return url

    return url

def create_message(
        *,
        room: ChatRoom,
        sender: User,
        content: str = "",
        message_type: str = "text",
        attachment_url: str | None = None,
        original_filename: str | None = None,
        file_size: int | None = None,
    ) -> Message:
        return Message.objects.create(
            id=generate_id(),
            room=room,
            sender=sender,
            content=content or "",
            message_type=message_type,
            attachment_url=normalize_attachment_url(attachment_url),
            original_filename=original_filename,
            file_size=file_size,
        )

def mark_room_as_read(*, room: ChatRoom, user: User) -> int:
    unread_message_ids = list(
        Message.objects.filter(room=room)
        .exclude(sender=user)
        .exclude(reads__user=user)
        .values_list("id", flat=True)
    )

    MessageRead.objects.bulk_create(
        [
            MessageRead(id=generate_id(), message_id=message_id, user=user)
            for message_id in unread_message_ids
        ],
        ignore_conflicts=True,
    )

    return len(unread_message_ids)

def get_room_unread_count(*, room: ChatRoom, user: User) -> int:
    return (
        Message.objects.filter(room=room)
        .exclude(sender=user)
        .exclude(reads__user=user)
        .count()
    )

def get_room_last_message(room: ChatRoom):
    return room.messages.select_related("sender").order_by("-created_at").first()


def get_room_other_user(room: ChatRoom, current_user: User):
    member = room.members.exclude(user=current_user).select_related("user").first()
    return member.user if member else None

# Realtime create RoomID
def inbox_group_name(user_id: str) -> str:
    return f"chat_inbox_{user_id}"


def get_room_members(room: ChatRoom):
    return User.objects.filter(chat_room_memberships__room=room).distinct()

def get_related_users_for_presence(user: User):
    room_ids = ChatRoomMember.objects.filter(user=user).values_list("room_id", flat=True)

    return (
        User.objects.filter(chat_room_memberships__room_id__in=room_ids)
        .exclude(id=user.id)
        .distinct()
    )


def push_presence_to_user(*, target_user: User, changed_user: User, status: str):
    channel_layer = get_channel_layer()
    if not channel_layer:
        return

    async_to_sync(channel_layer.group_send)(
        inbox_group_name(target_user.id),
        {
            "type": "presence_event",
            "user_id": str(changed_user.id),
            "status": status,
        },
    )


def broadcast_presence_to_related_users(*, user: User, status: str):
    for related_user in get_related_users_for_presence(user):
        push_presence_to_user(
            target_user=related_user,
            changed_user=user,
            status=status,
        )


def serialize_conversation_for_user(room: ChatRoom, user: User):
    from .serializers import ConversationSerializer

    fake_request = SimpleNamespace(user=user)
    return ConversationSerializer(room, context={"request": fake_request}).data

def push_room_snapshot_to_user(*, room: ChatRoom, user: User, event_type: str = "conversation_updated"):
    channel_layer = get_channel_layer()
    if not channel_layer:
        return

    payload = serialize_conversation_for_user(room, user)
    async_to_sync(channel_layer.group_send)(
        inbox_group_name(user.id),
        {
            "type": "inbox_event",
            "event_type": event_type,
            "conversation": payload,
        },
    )

def broadcast_room_snapshot(*, room: ChatRoom, event_type: str = "conversation_updated"):
    for member in get_room_members(room):
        push_room_snapshot_to_user(room=room, user=member, event_type=event_type)