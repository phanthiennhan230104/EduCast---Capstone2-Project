from django.db.models import Q
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import ChatRoom, ChatRoomMember, Message
from apps.users.models import User
from .models import ChatRoom, Message
from .serializers import (
    ChatUserSerializer,
    ConversationSerializer,
    MessageSerializer,
    StartDirectChatSerializer,
    UploadAttachmentSerializer,
)
from .services import (
    broadcast_room_snapshot,
    get_or_create_direct_room,
    mark_room_as_read,
    user_is_room_member,
)
from .storage import save_chat_attachment


class ConversationListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ConversationSerializer

    def get_queryset(self):
        return (
            ChatRoom.objects.filter(members__user=self.request.user)
            .prefetch_related("members__user", "messages__sender", "messages__reads")
            .distinct()
            .order_by("-created_at")
        )


class MessagesView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = MessageSerializer

    def get_queryset(self):
        room_id = self.kwargs["room_id"]
        if not user_is_room_member(self.request.user, room_id):
            return Message.objects.none()
        return (
            Message.objects.filter(room_id=room_id)
            .select_related("sender", "room")
            .prefetch_related("reads")
            .order_by("created_at")
        )

    def list(self, request, *args, **kwargs):
        room_id = self.kwargs["room_id"]
        if not user_is_room_member(request.user, room_id):
            return Response({"detail": "Bạn không thuộc room này."}, status=status.HTTP_403_FORBIDDEN)
        return super().list(request, *args, **kwargs)


class StartChatView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = StartDirectChatSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)

        target_user = User.objects.get(id=serializer.validated_data["target_user_id"])
        room = get_or_create_direct_room(request.user, target_user)
        broadcast_room_snapshot(room=room, event_type="conversation_created")
        return Response({"room_id": room.id}, status=status.HTTP_200_OK)


class MarkReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, room_id):
        if not user_is_room_member(request.user, room_id):
            return Response({"detail": "Bạn không thuộc room này."}, status=status.HTTP_403_FORBIDDEN)

        room = ChatRoom.objects.get(id=room_id)
        read_count = mark_room_as_read(room=room, user=request.user)
        return Response({"read_count": read_count}, status=status.HTTP_200_OK)

class DeleteRoomView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, room_id):
        if not user_is_room_member(request.user, room_id):
            return Response(
                {"detail": "Bạn không thuộc room này."},
                status=status.HTTP_403_FORBIDDEN,
            )

        room = ChatRoom.objects.filter(id=room_id).first()
        if not room:
            return Response(
                {"detail": "Room không tồn tại."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Xoá toàn bộ room chat cho cả 2 người
        Message.objects.filter(room_id=room_id).delete()
        ChatRoomMember.objects.filter(room_id=room_id).delete()
        room.delete()

        return Response(
            {"detail": "Đã xoá cuộc trò chuyện.", "room_id": room_id},
            status=status.HTTP_200_OK,
        )

class UploadAttachmentView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = UploadAttachmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        file_obj = serializer.validated_data["file"]
        content_type = getattr(file_obj, "content_type", "") or ""

        if content_type.startswith("image/"):
            message_type = "image"
        elif content_type.startswith("audio/"):
            message_type = "audio"
        else:
            message_type = "file"

        attachment_url = request.build_absolute_uri(save_chat_attachment(file_obj))

        return Response(
            {
                "attachment_url": attachment_url,
                "message_type": message_type,
                "filename": file_obj.name,
                "size": file_obj.size,
            },
            status=status.HTTP_201_CREATED,
        )


class ChatUserSearchView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ChatUserSerializer

    def get_queryset(self):
        from apps.social.models import Follow

        q = (self.request.query_params.get("q") or "").strip()
        me = self.request.user

        # Lấy danh sách những người tôi đang follow
        i_follow = set(
            Follow.objects.filter(follower=me).values_list("following_id", flat=True)
        )
        # Lấy danh sách những người đang follow tôi
        follow_me = set(
            Follow.objects.filter(following=me).values_list("follower_id", flat=True)
        )
        # Mutual follow (bạn bè) = giao 2 tập
        friend_ids = i_follow & follow_me

        queryset = User.objects.filter(id__in=friend_ids)

        if q:
            query = (
                Q(username__icontains=q) |
                Q(email__icontains=q)
            )
            if hasattr(User, "display_name"):
                query = query | Q(display_name__icontains=q)
            queryset = queryset.filter(query)

        return queryset.order_by("username")[:20]