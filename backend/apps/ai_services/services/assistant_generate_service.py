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
            "Search public published EduCast feed posts when the user asks to find, "
            "lookup, recommend, retrieve, or explore existing posts in the platform feed."
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


def build_fallback_generate_payload(raw_content: str, intent: str) -> dict[str, Any]:
    return {
        "type": "generate",
        "intent": intent,
        "summary": "AI đã tạo nội dung nhưng phản hồi chưa đúng định dạng chuẩn.",
        "content": {
            "title": "",
            "description": "",
            "body": (raw_content or "").strip(),
            "bullets": [],
            "hashtags": [],
        },
        "suggestions": [
            "Viết lại ngắn gọn hơn",
            "Đổi sang script podcast",
        ],
    }


def build_search_result_payload(posts: list[dict[str, Any]], keyword: str) -> dict[str, Any]:
    return {
        "type": "search_result",
        "intent": "search",
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

    posts = search_published_posts(keyword=keyword, limit=limit)
    return keyword, posts, json.dumps(posts, ensure_ascii=False)


def generate_educast_content(
    *,
    user_message: str,
    intent: str,
    chat_history: list[dict[str, Any]] | None = None,
    context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    client = _create_client()

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
        first_completion = client.chat.completions.create(
            model=settings.GROQ_MODEL,
            temperature=0.2,
            messages=messages,
            tools=[SEARCH_POSTS_TOOL],
            tool_choice="auto",
        )

        assistant_message = first_completion.choices[0].message
        tool_calls = assistant_message.tool_calls or []

        if tool_calls:
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
                normalized["content"]["posts"] = last_posts
                normalized["type"] = "search_result"
                normalized["intent"] = "search"
                return normalized
            except Exception:
                return build_search_result_payload(last_posts, last_keyword)

        raw_content = assistant_message.content or ""
        parsed = extract_json_object(raw_content)
        return normalize_generate_payload(parsed)

    except Exception as exc:
        return build_fallback_generate_payload(
            raw_content=f"Không thể xử lý yêu cầu AI Assistant: {exc}",
            intent=intent,
        )