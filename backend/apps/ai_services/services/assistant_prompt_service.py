from typing import Any


def build_system_prompt() -> str:
    return """
Bạn là EduCast AI Assistant, chuyên hỗ trợ tạo nội dung giáo dục cho nền tảng audio learning.

Quy tắc bắt buộc:
- Chỉ trả về đúng 1 JSON object hợp lệ.
- Không được thêm bất kỳ câu giải thích nào trước hoặc sau JSON.
- Không được dùng markdown code fences.
- Không được dùng ```json.
- Mọi khóa JSON phải đúng schema yêu cầu.
- Nếu thiếu dữ liệu, vẫn phải trả về đủ schema với chuỗi rỗng hoặc mảng rỗng.
- Nội dung phải rõ ràng, hữu ích, tự nhiên, phù hợp để đăng feed giáo dục trên EduCast.
""".strip()

def build_json_schema_hint(intent: str) -> str:
    return f"""
Return exactly one valid JSON object with this schema:
{{
  "type": "generate",
  "intent": "{intent}",
  "summary": "string",
  "content": {{
    "title": "string",
    "description": "string",
    "body": "string",
    "bullets": ["string"],
    "hashtags": ["string"]
  }},
  "suggestions": ["string"]
}}
Do not include prose.
Do not include markdown.
Do not include code fences.
""".strip()


def build_user_prompt(
    user_message: str,
    intent: str,
    history: list[dict[str, Any]] | None = None,
    context: dict[str, Any] | None = None,
) -> str:
    context = context or {}
    history = history or []

    tone = context.get("tone", "")
    target_audience = context.get("target_audience", "")
    output_format = context.get("format", "feed_post")
    length = context.get("length", "medium")
    language = context.get("language", "vi")

    history_text = "\n".join(
        f'- {item.get("role", "user")}: {item.get("content", "")}'
        for item in history[-6:]
        if item.get("content")
    ).strip()

    intent_guides = {
        "idea": "Tạo 5 ý tưởng nội dung rõ ràng, thực tế, có thể dùng ngay.",
        "outline": "Tạo dàn ý mạch lạc, chia ý theo trình tự logic.",
        "draft": "Viết một bài hoàn chỉnh, dễ đọc, phù hợp đăng feed.",
        "podcast_script": "Viết thành script phù hợp để đọc audio, câu ngắn vừa phải, mượt khi nói.",
        "rewrite": "Viết lại nội dung cho dễ hiểu hơn, ngắn gọn hơn hoặc hấp dẫn hơn tùy ngữ cảnh.",
        "title_description_tags": "Tập trung mạnh vào title, description và hashtag.",
    }

    return f"""
Ngôn ngữ đầu ra: {language}
Tone: {tone or "friendly"}
Target audience: {target_audience or "general learners"}
Output format: {output_format}
Length: {length}

Hướng dẫn theo intent:
{intent_guides.get(intent, intent_guides["draft"])}

Lịch sử gần đây:
{history_text or "Không có"}

Yêu cầu người dùng:
{user_message}

{build_json_schema_hint(intent)}
""".strip()