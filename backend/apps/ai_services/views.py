from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.ai_services.serializers import AssistantChatSerializer
from apps.ai_services.services.assistant_orchestrator import chat_with_assistant


class AssistantChatView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = AssistantChatSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        payload = chat_with_assistant(
            user_message=serializer.validated_data["message"],
            chat_history=serializer.validated_data.get("history", []),
        )

        return Response(
            {"message": payload},
            status=status.HTTP_200_OK,
        )
    