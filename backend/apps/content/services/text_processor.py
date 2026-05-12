import os
import re
import requests


def _clean_text(text: str) -> str:
    text = (text or "").strip()
    text = re.sub(r"\s+", " ", text)
    return text


def _split_sentences(text: str) -> list[str]:
    text = _clean_text(text)
    if not text:
        return []
    parts = re.split(r"(?<=[.!?])\s+", text)
    return [p.strip() for p in parts if p.strip()]


def _word_count(text: str) -> int:
    return len(_clean_text(text).split())


def _target_summary_guidance(text: str) -> str:
    words = _word_count(text)

    if words < 120:
        return (
            "Nội dung gốc khá ngắn. Hãy chuyển hóa nó thành một thông điệp audio ngắn gọn, sắc nét, "
            "như một viên nang kiến thức. Phải giữ trọn vẹn nội dung, không cắt xén."
        )
    if words < 300:
        return (
            "Nội dung ở mức vừa. Hãy tạo ra một kịch bản audio có nhịp điệu lôi cuốn. "
            "Chỉ lược bỏ những từ ngữ lặp vòng vo, còn lại phải giữ nguyên các luận điểm và ví dụ quan trọng."
        )
    if words < 700:
        return (
            "Nội dung khá chi tiết. Hãy biến đây thành một bài audio phân tích. "
            "Sắp xếp cấu trúc logic chặt chẽ, dùng từ ngữ chuyển ý mượt mà."
        )
    return (
        "Nội dung gốc rất dài. Không được tóm tắt qua loa hay gộp ý hời hợt. "
        "Hãy thiết kế kịch bản như một tập podcast chuyên sâu, chia nhỏ các ý lớn, "
        "giữ trọn vẹn kiến thức cốt lõi nhưng vẫn dễ nghe."
    )


def _target_dialogue_guidance(text: str) -> str:
    words = _word_count(text)

    if words < 120:
        return "Tạo một màn đối đáp nhanh gọn, khoảng 6 đến 8 lượt, đi thẳng vào trọng tâm."
    if words < 300:
        return "Tạo hội thoại nhịp độ vừa, khoảng 8 đến 12 lượt, giải thích rõ các ý chính."
    if words < 700:
        return "Tạo một buổi talkshow có chiều sâu, khoảng 12 đến 16 lượt, có hỏi đáp và tóm ý tự nhiên."
    return (
        "Nội dung gốc rất dài. Hãy tạo cuộc trò chuyện chuyên sâu khoảng 16 đến 24 lượt thoại. "
        "MC đặt câu hỏi đào sâu, khách mời phân tích từng khía cạnh rõ ràng."
    )


def _fallback_summary(text: str) -> str:
    sentences = _split_sentences(text)
    if not sentences:
        return ""

    words = _word_count(text)
    if words < 120:
        keep_count = min(5, len(sentences))
    elif words < 300:
        keep_count = min(7, len(sentences))
    elif words < 700:
        keep_count = min(10, len(sentences))
    else:
        keep_count = min(14, len(sentences))

    intro = "Chào bạn, trong nội dung này, chúng ta sẽ cùng điểm qua những ý quan trọng nhất."
    body = sentences[:keep_count]
    outro = "Tóm lại, đây là những điểm cốt lõi bạn cần ghi nhớ. Cảm ơn bạn đã lắng nghe!"

    return " ".join([intro, *body, outro]).strip()


def _fallback_dialogue(text: str) -> str:
    sentences = _split_sentences(text)
    if not sentences:
        return ""

    words = _word_count(text)
    if words < 120:
        keep_count = min(3, len(sentences))
    elif words < 300:
        keep_count = min(5, len(sentences))
    elif words < 700:
        keep_count = min(7, len(sentences))
    else:
        keep_count = min(10, len(sentences))

    chunks = sentences[:keep_count]
    lines = [
        "MC: Chào các bạn khán giả! Hôm nay chúng ta sẽ cùng tìm hiểu nội dung chính của chủ đề này.",
        "Khách mời: Chào MC, mình sẽ tóm lược lại theo cách ngắn gọn và dễ hiểu nhất.",
    ]

    for idx, sentence in enumerate(chunks, start=1):
        if idx == 1:
            lines.append("MC: Trước tiên, ý quan trọng nhất ở đây là gì?")
            lines.append("Khách mời: " + sentence)
        else:
            lines.append("MC: Thật thú vị! Vậy còn khía cạnh tiếp theo thì sao?")
            lines.append("Khách mời: " + sentence)

    lines.append("MC: Nếu phải chốt lại ngắn gọn cho thính giả thì sao?")
    lines.append("Khách mời: Tóm lại, đây là nội dung nền tảng và rất đáng để ghi nhớ.")

    return "\n".join(lines)


def _fallback_translate(text: str) -> str:
    sentences = _split_sentences(text)
    if not sentences:
        return ""

    words = _word_count(text)
    if words < 120:
        keep_count = min(4, len(sentences))
    elif words < 300:
        keep_count = min(6, len(sentences))
    else:
        keep_count = min(8, len(sentences))

    intro = "Hello there! In this audio, we will quickly go through the most important ideas."
    body = " ".join(sentences[:keep_count])
    outro = "In short, these are the main points you should remember. Thanks for tuning in!"

    return f"{intro} {body} {outro}".strip()


def generate_short_description(text: str) -> str:
    text = _clean_text(text)
    if not text:
        return ""

    sentences = _split_sentences(text)
    if not sentences:
        return ""

    first = sentences[0]
    first = re.sub(r"\s+", " ", first).strip()
    first = re.sub(
        r"^(Trong audio này|Trong bài này|Bài viết này|Nội dung này)\s*[:,.-]?\s*",
        "",
        first,
        flags=re.IGNORECASE,
    )

    if len(first) > 220:
        first = first[:220].rsplit(" ", 1)[0].strip() + "..."

    return first


def generate_short_title(text: str) -> str:
    text = _clean_text(text)
    if not text:
        return "Bài audio"

    sentences = _split_sentences(text)
    title = sentences[0] if sentences else text
    title = re.sub(r"^(Hello there!|Chào bạn,?)\s*", "", title, flags=re.IGNORECASE)
    title = title.strip('"').strip("'").strip()

    if len(title) > 80:
        title = title[:80].rsplit(" ", 1)[0].strip()

    return title or "Bài audio"


def _call_openai_compatible_api(
    *,
    api_key: str,
    base_url: str,
    model: str,
    system_prompt: str,
    user_prompt: str,
) -> str:
    url = f"{base_url.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.7,
    }

    response = requests.post(url, headers=headers, json=payload, timeout=60)
    response.raise_for_status()
    data = response.json()

    return data["choices"][0]["message"]["content"].strip()


def _build_prompts(text: str, mode: str) -> tuple[str, str]:
    summary_guidance = _target_summary_guidance(text)
    dialogue_guidance = _target_dialogue_guidance(text)

    system_prompt = (
        "Bạn là một biên tập viên podcast giáo dục. "
        "Nhiệm vụ của bạn là biến văn bản thành nội dung audio tự nhiên, rõ ràng và dễ nghe. "
        "Không dùng markdown, không bullet, không emoji, không ký tự trang trí. "
        "Chỉ viết văn bản sạch, phù hợp để đưa vào hệ thống TTS."
    )

    if mode == "summary":
        user_prompt = f"""
Hãy chuyển nội dung dưới đây thành một kịch bản audio độc thoại bằng tiếng Việt.

Mục tiêu:
- Bắt buộc mở đầu bằng một lời chào thân thiện và giới thiệu chủ đề hấp dẫn.
- Giữ đầy đủ các ý quan trọng, không tóm tắt quá hời hợt.
- Diễn đạt theo ngôn ngữ nói (sử dụng các từ nối như: "Bạn biết không", "Thực tế là", "Để mình giải thích").
- Có lời kết và chào tạm biệt ngắn gọn.

Chiến lược xử lý theo độ dài:
{summary_guidance}

Yêu cầu:
- Không markdown
- Không bullet
- Không dùng dấu sao hoặc ký tự trang trí
- Viết thành các đoạn văn ngắn

Nội dung:
{text}
""".strip()
        return system_prompt, user_prompt

    if mode == "dialogue":
        user_prompt = f"""
Hãy chuyển nội dung dưới đây thành kịch bản talkshow podcast giữa MC và Khách mời.

Mục tiêu:
- Bắt buộc mở đầu bằng lời chào từ MC để dẫn dắt vào chương trình.
- Tự nhiên như một cuộc trò chuyện thật: Có sự tung hứng, đồng tình, ngạc nhiên.
- MC đặt câu hỏi gợi mở hoặc thay mặt người nghe thắc mắc chỗ khó hiểu.
- Khách mời giải thích rõ ràng, dùng ví dụ gần gũi.
- Giữ đủ các ý quan trọng của nội dung gốc.

Chiến lược xử lý theo độ dài:
{dialogue_guidance}

Yêu cầu:
- Mỗi lượt thoại dùng đúng format: MC: nội dung hoặc Khách mời: nội dung
- Không markdown
- Không bullet
- Không để một lượt thoại quá dài

Nội dung:
{text}
""".strip()
        return system_prompt, user_prompt

    if mode == "translate":
        user_prompt = f"""
Transform the following content into a natural English solo podcast script.

Goals:
- Translate and rewrite the content into fluent English
- Keep the important ideas and meaning
- Make it sound natural when read aloud
- Start with a short engaging opening
- End with a brief friendly conclusion
- Do not over-summarize the source

Requirements:
- Output English only
- Plain paragraphs only
- No markdown
- No bullet points
- No decorative characters

Original content:
{text}
""".strip()
        return system_prompt, user_prompt

    if mode == "title":
        user_prompt = f"""
Write a short title for this learning audio.

Requirements:
- Maximum 80 characters
- If the content is English, the title must be English
- If the content is Vietnamese, the title must be Vietnamese
- Mention the main topic clearly
- Natural, concise, and attractive
- No quotation marks
- No emoji
- No markdown

Content:
{text}
""".strip()
        return system_prompt, user_prompt

    if mode == "description":
        user_prompt = f"""
Viết một đoạn mô tả audio ngắn, rõ ràng và hấp dẫn để người dùng hiểu nội dung và muốn bấm nghe.

Mục tiêu:
- Nêu đúng chủ đề chính của audio
- Cho thấy lợi ích người nghe nhận được sau khi nghe
- Kích thích trí tò mò nhưng không phóng đại
- Viết tối đa 2 câu, khoảng 180 đến 220 ký tự
- Nếu nội dung là tiếng Anh thì mô tả phải là tiếng Anh
- Nếu nội dung là tiếng Việt thì mô tả phải là tiếng Việt

Quy tắc:
- Không dùng ngoặc kép
- Không emoji
- Không markdown
- Không dùng câu rập khuôn như: Trong audio này, Bài viết này nói về
- Không lan man, không viết quá chung chung
- Văn phong tự nhiên, phù hợp cho audio học tập

Nội dung:
{text}
""".strip()
        return system_prompt, user_prompt

    user_prompt = f"""
Hãy biên tập nội dung sau thành một bản script phù hợp cho giọng đọc AI.

Mục tiêu:
- Bắt buộc thêm một câu chào mừng ngắn ở đầu bài và câu tạm biệt ở cuối bài.
- Giữ gần như 100% ý chính của nội dung nguyên thủy.
- Làm mềm các câu văn thô cứng, chuyển cấu trúc câu phức tạp thành ngôn ngữ kể chuyện.
- Ngắt nhỏ các câu quá dài để giọng đọc AI có nhịp nghỉ tự nhiên.

Yêu cầu:
- Không markdown
- Không bullet
- Viết thành các đoạn văn liền mạch

Nội dung:
{text}
""".strip()
    return system_prompt, user_prompt


def _generate_with_ai(text: str, mode: str) -> str:
    groq_api_key = os.getenv("GROQ_API_KEY")
    openai_api_key = os.getenv("OPENAI_API_KEY")

    system_prompt, user_prompt = _build_prompts(text, mode)

    if groq_api_key:
        return _call_openai_compatible_api(
            api_key=groq_api_key,
            base_url="https://api.groq.com/openai/v1",
            model=os.getenv("GROQ_MODEL", "llama-3.1-8b-instant"),
            system_prompt=system_prompt,
            user_prompt=user_prompt,
        )

    if openai_api_key:
        return _call_openai_compatible_api(
            api_key=openai_api_key,
            base_url=os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1"),
            model=os.getenv("OPENAI_MODEL", "gpt-4.1-mini"),
            system_prompt=system_prompt,
            user_prompt=user_prompt,
        )

    raise RuntimeError("No AI provider configured.")


def process_text_by_mode(text: str, mode: str) -> str:
    text = _clean_text(text)
    if not text:
        return ""

    if mode == "original":
        return text

    try:
        return _generate_with_ai(text, mode)
    except Exception:
        if mode == "summary":
            return _fallback_summary(text)
        if mode == "dialogue":
            return _fallback_dialogue(text)
        if mode == "translate":
            return _fallback_translate(text)
        return text


def generate_ai_title(text: str) -> str:
    text = _clean_text(text)
    if not text:
        return ""

    short_text = text[:2500]

    try:
        result = _generate_with_ai(short_text, "title")
        result = _clean_text(result)
        result = result.strip('"').strip("'").strip()

        if len(result) > 80:
            result = result[:80].rsplit(" ", 1)[0].strip()

        return result or generate_short_title(text)
    except Exception:
        return generate_short_title(text)


def generate_ai_description(text: str) -> str:
    text = _clean_text(text)
    if not text:
        return ""

    short_text = text[:4000]

    try:
        result = _generate_with_ai(short_text, "description")
        result = _clean_text(result)
        result = result.strip('"').strip("'").strip()

        if len(result) > 220:
            result = result[:220].rsplit(" ", 1)[0].strip() + "..."

        return result or generate_short_description(text)
    except Exception:
        return generate_short_description(text)