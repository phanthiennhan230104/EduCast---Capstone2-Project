from django.urls import path
from .views import (
    ChatUserSearchView,
    ConversationListView,
    MarkReadView,
    MessagesView,
    StartChatView,
    UploadAttachmentView,
)

urlpatterns = [
    path("conversations/", ConversationListView.as_view(), name="chat-conversations"),
    path("messages/<str:room_id>/", MessagesView.as_view(), name="chat-messages"),
    path("start/", StartChatView.as_view(), name="chat-start"),
    path("rooms/<str:room_id>/read/", MarkReadView.as_view(), name="chat-mark-read"),
    path("attachments/upload/", UploadAttachmentView.as_view(), name="chat-upload-attachment"),
    path("users/search/", ChatUserSearchView.as_view(), name="chat-user-search"),
]