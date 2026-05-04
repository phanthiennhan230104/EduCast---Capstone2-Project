from typing import Any

from apps.ai_services.services.assistant_generate_service import generate_educast_content
from apps.ai_services.services.assistant_intent_service import detect_assistant_intent


def chat_with_assistant(
    user_message: str,
    chat_history: list[dict[str, Any]] | None = None,
    context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    normalized_message = (user_message or "").strip()
    if not normalized_message:
        raise ValueError("User message must not be empty.")

    intent = detect_assistant_intent(normalized_message)

    return generate_educast_content(
        user_message=normalized_message,
        intent=intent,
        chat_history=chat_history or [],
        context=context or {},
    )