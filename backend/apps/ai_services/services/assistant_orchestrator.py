from typing import Any
import logging

from apps.ai_services.services.assistant_generate_service import generate_educast_content, build_fallback_generate_payload
from apps.ai_services.services.assistant_intent_service import classify_assistant_intent

logger = logging.getLogger(__name__)


def chat_with_assistant(
    user_message: str,
    chat_history: list[dict[str, Any]] | None = None,
    context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    try:
        normalized_message = (user_message or "").strip()
        if not normalized_message:
            raise ValueError("User message must not be empty.")

        intent_data = classify_assistant_intent(
            message=normalized_message,
            context=context or {},
            history=chat_history or [],
        )

        return generate_educast_content(
            user_message=normalized_message,
            intent=intent_data["intent"],
            intent_data=intent_data,
            chat_history=chat_history or [],
            context=context or {},
        )
    
    except Exception as exc:
        logger.error(f"Chat with assistant error: {exc}", exc_info=True)
        return build_fallback_generate_payload(
            raw_content="",
            intent="error"
        )