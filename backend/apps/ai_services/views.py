from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import ValidationError
import logging

from apps.ai_services.serializers import AssistantChatSerializer
from apps.ai_services.services.assistant_orchestrator import chat_with_assistant

logger = logging.getLogger(__name__)


class AssistantChatView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            serializer = AssistantChatSerializer(data=request.data)
            if not serializer.is_valid():
                logger.warning(f"Validation errors: {serializer.errors}")
                return Response(
                    serializer.errors,
                    status=status.HTTP_400_BAD_REQUEST
                )

            payload = chat_with_assistant(
                user_message=serializer.validated_data["message"],
                chat_history=serializer.validated_data.get("history", []),
                context=serializer.validated_data.get("context", {}),
            )

            return Response({"message": payload}, status=status.HTTP_200_OK)
        
        except Exception as exc:
            logger.error(f"Assistant chat error: {exc}", exc_info=True)
            return Response(
                {
                    "detail": "Có lỗi xảy ra khi xử lý yêu cầu của bạn.",
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )