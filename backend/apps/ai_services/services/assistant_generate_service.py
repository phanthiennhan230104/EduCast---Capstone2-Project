import json
from typing import Any

from django.conf import settings
from groq import Groq

from apps.ai_services.services.assistant_prompt_service import (
    build_system_prompt,
    build_user_prompt,
)
from apps.ai_services.services.assistant_response_parser import (
    extract_json_object,
    normalize_generate_payload,
)
from apps.content.services.post_search_service import search_published_posts


SEARCH_POSTS_TOOL = {
    "type": "function",
    "function": {
        "name": "search_published_posts",
        "description": (
            "Search public published EduCast feed posts ONLY when the user clearly asks "
            "to find, search, lookup, retrieve, or explore existing posts in the platform feed."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "keyword": {
                    "type": "string",
                    "description": "Search keyword or topic from the user request.",
                },
                "limit": {
                    "type": "integer",
                    "description": "Maximum number of posts to return.",
                    "default": 10,
                },
            },
            "required": ["keyword"],
        },
    },
}


SEARCH_INTENTS = {
    "search_content",
    "search",
    "find_post",
    "find_content",
}


def build_fallback_generate_payload(raw_content: str, intent: str) -> dict[str, Any]:
    """
    Build fallback payload when JSON parsing fails.
    
    Thay vì wrap JSON string vào body, ta sẽ cố gắng parse lại.
    Nếu vẫn thất bại, trả về error message thân thiện.
    """
    return {
        "type": "generate",
        "intent": intent,
        "summary": "Có lỗi xảy ra khi xử lý yêu cầu của bạn.",
        "content": {
            "title": "",
            "description": "",
            "body": "Xin lỗi, AI Assistant không thể xử lý yêu cầu này. Vui lòng thử lại với yêu cầu khác.",
            "bullets": [],
            "hashtags": [],
        },
        "suggestions": [
            "Viết lại yêu cầu đơn giản hơn",
            "Thử với chủ đề khác",
            "Kiểm tra kết nối mạng",
        ],
    }


def build_search_result_payload(posts: list[dict[str, Any]], keyword: str) -> dict[str, Any]:
    return {
        "type": "search_result",
        "intent": "search_content",
        "summary": f"Tìm thấy {len(posts)} bài viết phù hợp với: {keyword}",
        "content": {
            "posts": posts,
        },
        "suggestions": [
            "Viết bài mới theo chủ đề này",
            "Gợi ý thêm nội dung liên quan",
        ],
    }


def _create_client() -> Groq:
    api_key = getattr(settings, "GROQ_API_KEY", "")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not configured.")
    return Groq(api_key=api_key)


def _safe_tool_arguments(raw_arguments: str | None) -> dict[str, Any]:
    if not raw_arguments:
        return {}

    try:
        parsed = json.loads(raw_arguments)
    except json.JSONDecodeError:
        return {}

    return parsed if isinstance(parsed, dict) else {}


def _execute_tool_call(tool_call: Any) -> tuple[str, list[dict[str, Any]], str]:
    function_name = tool_call.function.name
    arguments = _safe_tool_arguments(tool_call.function.arguments)

    if function_name != "search_published_posts":
        raise ValueError(f"Unsupported tool call: {function_name}")

    keyword = str(arguments.get("keyword", "")).strip()
    limit = int(arguments.get("limit", 10) or 10)

    if not keyword:
        keyword = ""

    limit = max(1, min(limit, 20))

    posts = search_published_posts(keyword=keyword, limit=limit)
    return keyword, posts, json.dumps(posts, ensure_ascii=False)


def _should_allow_search_tool(intent: str, intent_data: dict[str, Any] | None = None) -> bool:
    intent_data = intent_data or {}

    detected_intent = str(intent or "").strip()
    classifier_intent = str(intent_data.get("intent", "")).strip()

    return detected_intent in SEARCH_INTENTS or classifier_intent in SEARCH_INTENTS


def generate_educast_content(
    *,
    user_message: str,
    intent: str,
    intent_data: dict[str, Any] | None = None,
    chat_history: list[dict[str, Any]] | None = None,
    context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    client = _create_client()

    intent_data = intent_data or {}
    chat_history = chat_history or []
    context = context or {}

    allow_search_tool = _should_allow_search_tool(intent, intent_data)

    messages: list[dict[str, Any]] = [
        {"role": "system", "content": build_system_prompt()},
        {
            "role": "user",
            "content": build_user_prompt(
                user_message=user_message,
                intent=intent,
                history=chat_history,
                context=context,
            ),
        },
    ]

    try:
        completion_kwargs: dict[str, Any] = {
            "model": settings.GROQ_MODEL,
            "temperature": 0.2,
            "messages": messages,
        }

        if allow_search_tool:
            completion_kwargs["tools"] = [SEARCH_POSTS_TOOL]
            completion_kwargs["tool_choice"] = "auto"

        first_completion = client.chat.completions.create(**completion_kwargs)

        assistant_message = first_completion.choices[0].message
        tool_calls = assistant_message.tool_calls or []

        if tool_calls and allow_search_tool:
            messages.append(assistant_message)

            last_keyword = user_message
            last_posts: list[dict[str, Any]] = []

            for tool_call in tool_calls:
                keyword, posts, tool_content = _execute_tool_call(tool_call)
                last_keyword = keyword or user_message
                last_posts = posts

                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "name": tool_call.function.name,
                        "content": tool_content,
                    }
                )

            second_completion = client.chat.completions.create(
                model=settings.GROQ_MODEL,
                temperature=0.2,
                messages=messages,
            )

            raw_content = second_completion.choices[0].message.content or ""

            try:
                parsed = extract_json_object(raw_content)
                normalized = normalize_generate_payload(parsed)
                normalized["type"] = "search_result"
                normalized["intent"] = "search_content"
                normalized.setdefault("content", {})
                normalized["content"]["posts"] = last_posts
                return normalized
            except Exception:
                return build_search_result_payload(last_posts, last_keyword)

        raw_content = assistant_message.content or ""

        try:
            parsed = extract_json_object(raw_content)
            normalized = normalize_generate_payload(parsed)

            if normalized.get("type") == "search_result" and not allow_search_tool:
                normalized["type"] = "generate"

            normalized["intent"] = intent
            return normalized

        except Exception:
            return build_fallback_generate_payload(
                raw_content=raw_content,
                intent=intent,
            )

    except Exception as exc:
        return build_fallback_generate_payload(
            raw_content=(
                "Xin lỗi, AI Assistant chưa xử lý được yêu cầu này. "
                f"Chi tiết kỹ thuật: {exc}"
            ),
            intent=intent,
        )