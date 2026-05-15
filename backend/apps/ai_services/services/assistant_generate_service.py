import json
from typing import Any

from django.conf import settings
import google.generativeai as genai

from apps.ai_services.services.assistant_prompt_service import (
    build_system_prompt,
    build_user_prompt,
)
from apps.ai_services.services.assistant_response_parser import (
    extract_json_object,
    normalize_generate_payload,
)
from apps.content.services.post_search_service import search_published_posts


# Gemini Tool definition
def search_published_posts_tool(keyword: str, limit: int = 10) -> list[dict[str, Any]]:
    """
    Search public published EduCast feed posts ONLY when the user clearly asks 
    to find, search, lookup, retrieve, or explore existing posts in the platform feed.
    
    Args:
        keyword: Search keyword or topic from the user request.
        limit: Maximum number of posts to return.
    """
    keyword = str(keyword or "").strip()
    limit = max(1, min(int(limit or 10), 20))
    return search_published_posts(keyword=keyword, limit=limit)


SEARCH_INTENTS = {
    "search_content",
    "search",
    "find_post",
    "find_content",
}


def build_fallback_generate_payload(raw_content: str, intent: str) -> dict[str, Any]:
    return {
        "type": "error",
        "intent": intent,
        "summary": "chatAssistant.error.fallback.summary",
        "content": {
            "title": "",
            "description": "",
            "body": "chatAssistant.error.fallback.body",
            "bullets": [],
            "hashtags": [],
        },
        "suggestions": [
            "chatAssistant.error.fallback.suggestions.shorter",
            "chatAssistant.error.fallback.suggestions.changeTopic",
            "chatAssistant.error.fallback.suggestions.network",
        ],
    }


def build_search_result_payload(posts: list[dict[str, Any]], keyword: str) -> dict[str, Any]:
    return {
        "type": "search_result",
        "intent": "search_content",
        "summary": f"Mình tìm thấy {len(posts)} podcast/bài viết có sẵn liên quan đến: {keyword}",
        "content": {
            "posts": posts,
        },
        "suggestions": [
            "Tạo bài mới theo chủ đề này",
            "Tìm thêm nội dung liên quan",
            "Gợi ý bài học tiếp theo",
        ],
    }


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
    api_key = getattr(settings, "GEMINI_API_KEY", "")
    model_name = getattr(settings, "GEMINI_MODEL", "gemini-3.1-flash-lite")

    if not api_key:
        return build_fallback_generate_payload("Gemini API key not configured.", intent)

    genai.configure(api_key=api_key)

    intent_data = intent_data or {}
    chat_history = chat_history or []
    context = context or {}

    allow_search_tool = _should_allow_search_tool(intent, intent_data)

    # Initial search check (logic from original code)
    if intent not in {"casual_chat", "summarize_content", "rewrite_content"}:
        search_keyword = intent_data.get("search_keyword") or user_message
        search_first_posts = search_published_posts(keyword=search_keyword, limit=10)
        if search_first_posts:
            return build_search_result_payload(posts=search_first_posts, keyword=search_keyword)

    try:
        # Prepare tools
        tools = [search_published_posts_tool] if allow_search_tool else None
        
        # Initialize model
        model = genai.GenerativeModel(
            model_name=model_name,
            tools=tools,
            system_instruction=build_system_prompt()
        )

        # Convert chat history to Gemini format if needed, 
        # but here we use a simple call with system prompt and user prompt
        user_content = build_user_prompt(
            user_message=user_message,
            intent=intent,
            history=chat_history,
            context=context,
        )

        # Start chat session for potential multi-turn tool calling
        chat = model.start_chat()
        response = chat.send_message(user_content)

        # Handle tool calls
        if allow_search_tool:
            # Gemini automatically handles one turn of tool calling if using chat.send_message 
            # and the tool is provided, but we might need to handle the response part.
            # Actually, with 'tools' provided, if it calls a tool, we need to execute it.
            
            last_posts = []
            last_keyword = user_message
            
            # Check for function calls in the last response parts
            for part in response.candidates[0].content.parts:
                if fn := part.function_call:
                    if fn.name == "search_published_posts_tool":
                        keyword = fn.args.get("keyword", user_message)
                        limit = fn.args.get("limit", 10)
                        
                        posts = search_published_posts_tool(keyword=keyword, limit=limit)
                        last_posts = posts
                        last_keyword = keyword
                        
                        # Send tool response back to Gemini
                        response = chat.send_message(
                            genai.protos.Content(
                                parts=[
                                    genai.protos.Part(
                                        function_response=genai.protos.FunctionResponse(
                                            name=fn.name,
                                            response={"result": posts}
                                        )
                                    )
                                ]
                            )
                        )
                        break

            if last_posts:
                raw_content = response.text or ""
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

        raw_content = response.text or ""
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
        print(f"❌ Gemini Generation Error: {exc}")
        return build_fallback_generate_payload(
            raw_content=(
                "Xin lỗi, AI Assistant chưa xử lý được yêu cầu này. "
                f"Chi tiết kỹ thuật: {exc}"
            ),
            intent=intent,
        )