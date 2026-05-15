import json
from typing import Any

from django.conf import settings
import google.generativeai as genai


ALLOWED_INTENTS = [
    "generate_lesson",
    "generate_podcast_script",
    "search_content",
    "summarize_content",
    "rewrite_content",
    "generate_ideas",
    "generate_outline",
    "english_learning",
    "programming_learning",
    "health_guidance",
    "life_skills",
    "casual_chat",
]


def _extract_json(text: str) -> dict[str, Any]:
    text = (text or "").strip()
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("No JSON object found")
    return json.loads(text[start : end + 1])


def _fallback_intent(message: str) -> dict[str, Any]:
    text = (message or "").lower()

    search_words = [
        "tìm bài",
        "tìm kiếm",
        "bài viết có sẵn",
        "trong feed",
        "đã đăng",
        "search",
        "xem bài viết",
    ]

    if any(word in text for word in search_words):
        return {
            "intent": "search_content",
            "confidence": 0.75,
            "domain": "general",
            "search_keyword": message,
            "reason": "Fallback search rule",
        }

    if "podcast" in text or "audio" in text or "kịch bản" in text:
        return {
            "intent": "generate_podcast_script",
            "confidence": 0.75,
            "domain": "audio_learning",
            "search_keyword": "",
            "reason": "Fallback podcast rule",
        }

    if "tiếng anh" in text or "english" in text or "toeic" in text:
        return {
            "intent": "english_learning",
            "confidence": 0.8,
            "domain": "english",
            "search_keyword": "",
            "reason": "Fallback English learning rule",
        }

    if "lập trình" in text or "code" in text or "python" in text or "javascript" in text:
        return {
            "intent": "programming_learning",
            "confidence": 0.8,
            "domain": "programming",
            "search_keyword": "",
            "reason": "Fallback programming rule",
        }

    if "người lớn tuổi" in text or "sức khỏe" in text or "bài tập" in text:
        return {
            "intent": "health_guidance",
            "confidence": 0.8,
            "domain": "elder_health",
            "search_keyword": "",
            "reason": "Fallback health rule",
        }

    if "kỹ năng mềm" in text or "giao tiếp" in text or "lối sống" in text:
        return {
            "intent": "life_skills",
            "confidence": 0.8,
            "domain": "life_skills",
            "search_keyword": "",
            "reason": "Fallback life skills rule",
        }

    return {
        "intent": "generate_lesson",
        "confidence": 0.7,
        "domain": "general_education",
        "search_keyword": "",
        "reason": "Default to content generation",
    }


def classify_assistant_intent(
    message: str,
    context: dict[str, Any] | None = None,
    history: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    normalized_message = (message or "").strip()
    if not normalized_message:
        return _fallback_intent(message)

    api_key = getattr(settings, "GEMINI_API_KEY", "")
    model_name = getattr(settings, "GEMINI_MODEL", "gemini-3.1-flash-lite")

    if not api_key:
        # Fallback to GROQ if Gemini is not configured, or use _fallback_intent
        return _fallback_intent(normalized_message)

    system_prompt = f"""
You are an intent classifier for EduCast, an AI audio learning platform.

Return ONLY one valid JSON object.

Allowed intents:
{", ".join(ALLOWED_INTENTS)}

Important routing rules:
- If user asks to CREATE, WRITE, MAKE, GENERATE, DESIGN, BUILD a lesson/content/script, choose generate_lesson or domain-specific learning intent.
- If user asks to FIND, SEARCH, LOOK UP existing posts/feed/articles, choose search_content.
- Do NOT choose search_content just because the topic exists in feed.
- "Tạo bài học tiếng Anh giao tiếp cho người mới bắt đầu" means english_learning, not search_content.
- Health advice must use health_guidance.
- Programming tutoring must use programming_learning.

JSON schema:
{{
  "intent": "one allowed intent",
  "confidence": 0.0,
  "domain": "english | programming | elder_health | life_skills | general_education | audio_learning | general",
  "search_keyword": "only fill when intent is search_content",
  "reason": "short reason"
}}
""".strip()

    user_prompt = f"""
User message:
{normalized_message}

Context:
{json.dumps(context or {}, ensure_ascii=False)}

Recent history:
{json.dumps(history[-4:] if history else [], ensure_ascii=False)}
""".strip()

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(
            model_name=model_name,
            system_instruction=system_prompt
        )
        
        response = model.generate_content(
            user_prompt,
            generation_config=genai.GenerationConfig(
                temperature=0,
                response_mime_type="application/json",
            )
        )

        raw = response.text or ""
        parsed = _extract_json(raw)

        intent = parsed.get("intent")
        if intent not in ALLOWED_INTENTS:
            return _fallback_intent(normalized_message)

        return {
            "intent": intent,
            "confidence": float(parsed.get("confidence", 0.7)),
            "domain": str(parsed.get("domain", "general")),
            "search_keyword": str(parsed.get("search_keyword", "")),
            "reason": str(parsed.get("reason", "")),
        }

    except Exception as e:
        print(f"❌ Gemini Intent Classification Error: {e}")
        return _fallback_intent(normalized_message)


def detect_assistant_intent(message: str) -> str:
    return classify_assistant_intent(message).get("intent", "generate_lesson")