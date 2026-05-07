from django.urls import path

from apps.ai_services.views import AssistantChatView

urlpatterns = [
    path('assistant/chat/', AssistantChatView.as_view(), name='assistant-chat'),
]
