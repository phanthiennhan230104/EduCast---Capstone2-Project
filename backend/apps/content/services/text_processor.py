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
    if len(sentences) > 1:
        first += " " + sentences[1]

    first = re.sub(r"\s+", " ", first).strip()
    first = re.sub(
        r"^(Trong audio này|Trong bài này|Bài viết này|Nội dung này)\s*[:,.-]?\s*",
        "",
        first,
        flags=re.IGNORECASE,
    )

    if len(first) > 500:
        first = first[:500].rsplit(" ", 1)[0].strip() + "..."

    return first


def generate_short_title(text: str) -> str:
    text = _clean_text(text)
    if not text:
        return "Bài audio"

    sentences = _split_sentences(text)
    title = sentences[0] if sentences else text
    title = re.sub(r"^(Hello there!|Chào bạn,?)\s*", "", title, flags=re.IGNORECASE)
    title = title.strip('"').strip("'").strip()

    if len(title) > 150:
        title = title[:150].rsplit(" ", 1)[0].strip()

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
        "Bạn là một biên tập viên và Host podcast giáo dục xuất sắc. "
        "Nhiệm vụ của bạn là biến văn bản khô khan thành kịch bản audio mượt mà, hấp dẫn và có hồn. "
        "Nguyên tắc cốt lõi: Bạn ĐƯỢC PHÉP sáng tạo cách dẫn dắt, thêm thắt từ ngữ nối để bài diễn thuyết sinh động hơn, "
        "nhưng TUYỆT ĐỐI KHÔNG ĐƯỢC thay đổi, làm sai lệch hay bỏ sót các ĐIỂM CHÍNH, SỐ LIỆU và THÔNG ĐIỆP CỐT LÕI của nội dung gốc. "
        "Chỉ viết văn bản sạch (không markdown, không bullet, không ký tự trang trí) để phù hợp cho hệ thống TTS."
    )

    if mode == "summary":
        user_prompt = f"""
Hãy chuyển nội dung dưới đây thành kịch bản audio độc thoại bằng tiếng Việt.

Mục tiêu cốt lõi:
- THÊM THẮT ĐỂ HẤP DẪN NHƯNG GIỮ NGUYÊN Ý CHÍNH: Bạn có toàn quyền sáng tạo cách diễn đạt, thêm các câu cảm thán, từ nối tự nhiên (như: "Bạn biết không", "Thử tưởng tượng xem", "Thực tế là") để bài nghe thật mượt mà và cuốn hút. 
- CHUẨN XÁC NỘI DUNG: Dù diễn đạt hay đến đâu, các luận điểm chính, thông tin nền tảng và số liệu của bản gốc PHẢI được giữ nguyên. Không được tự ý đổi trắng thay đen hay làm sai lệch ý tác giả.
- Bắt buộc có: Một lời chào mở đầu thật thu hút (kèm giới thiệu chủ đề) và một câu kết luận/chào tạm biệt ấn tượng ở cuối.

Chiến lược xử lý theo độ dài:
{summary_guidance}

Yêu cầu định dạng:
- Không markdown, không bullet. Viết thành các đoạn văn ngắn liền mạch.

Nội dung:
{text}
""".strip()
        return system_prompt, user_prompt

    if mode == "dialogue":
        user_prompt = f"""
Hãy chuyển nội dung dưới đây thành kịch bản talkshow podcast giữa MC và Khách mời.

Mục tiêu cốt lõi:
- TUNG HỨNG TỰ NHIÊN NHƯNG ĐÚNG KIẾN THỨC: MC và Khách mời có thể thoải mái thêm thắt các câu đùa nhẹ nhàng, biểu cảm ngạc nhiên ("Ồ", "Thật vậy sao?"), hoặc cách ví von để cuộc trò chuyện có hồn và đặc sắc. 
- Tuy nhiên, khi giải thích, Khách mời BẮT BUỘC phải truyền tải đầy đủ và chính xác các ĐIỂM CHÍNH từ nội dung gốc. Không được chế tác sai lệch kiến thức.
- Bắt buộc có: Lời chào mở đầu từ MC. MC liên tục đặt câu hỏi gợi mở. Cuối chương trình MC chốt lại bài học và chào tạm biệt.

Chiến lược xử lý theo độ dài:
{dialogue_guidance}

Yêu cầu định dạng:
- Format bắt buộc: MC: [nội dung] hoặc Khách mời: [nội dung]
- Không markdown, không bullet. Các lượt thoại tung hứng linh hoạt, không để ai nói một mạch quá dài.

Nội dung:
{text}
""".strip()
        return system_prompt, user_prompt

    if mode == "translate":
        user_prompt = f"""
Translate and adapt the following content into a fluent, buttery-smooth English solo podcast script.

Core Objectives:
- CREATIVE YET ACCURATE: Feel free to use engaging English idioms, natural conversational transitions (e.g., "Think about it," "Here's the kicker"), and expressive storytelling techniques to make the audio flow beautifully. 
- However, you MUST strictly preserve all main points, core facts, and the original message. Do not alter the fundamental truth or leave out key arguments from the original text.
- MUST include: A warm, hook-driven welcoming intro and a friendly sign-off at the end.

Formatting Requirements:
- OUTPUT STRICTLY IN ENGLISH ONLY.
- Plain paragraphs only. NO markdown, NO bullet points.

Original content:
{text}
""".strip()
        return system_prompt, user_prompt

    if mode == "title":
        user_prompt = f"""
Viết một tiêu đề (title) chi tiết và bao quát nhất cho bài audio học tập này.

RÀNG BUỘC NGÔN NGỮ (LANGUAGE LOCK):
- Nhận diện ngôn ngữ của phần "Nội dung" bên dưới.
- Nếu nội dung bằng TIẾNG ANH, bạn BẮT BUỘC phải viết tiêu đề bằng TIẾNG ANH 100%.
- Nếu nội dung bằng TIẾNG VIỆT, bạn viết tiêu đề bằng TIẾNG VIỆT.

Mục tiêu:
- Phản ánh chính xác và đầy đủ nội dung cốt lõi của toàn bộ bài.
- Sử dụng cấu trúc (Tiêu đề chính - Tiêu đề phụ) để làm rõ ý.
- Độ dài khoảng 15 đến 25 từ (tối đa 150 ký tự).

Yêu cầu định dạng:
- Không dùng ngoặc kép. Không emoji, không markdown.

Nội dung:
{text}
""".strip()
        return system_prompt, user_prompt

    if mode == "description":
        user_prompt = f"""
Viết một đoạn mô tả (show notes/description) chi tiết để giới thiệu trọn vẹn nội dung bài audio này.

RÀNG BUỘC NGÔN NGỮ (LANGUAGE LOCK):
- Nhận diện ngôn ngữ của phần "Nội dung" bên dưới. 
- Nếu nội dung bằng TIẾNG ANH, đoạn mô tả BẮT BUỘC phải được viết bằng TIẾNG ANH 100%.
- Nếu nội dung bằng TIẾNG VIỆT, viết bằng TIẾNG VIỆT.

Mục tiêu:
- Tóm tắt bối cảnh, liệt kê các ý chính và giá trị thực tế người nghe nhận được. Có thể viết hấp dẫn, bay bổng để thu hút người nghe.
- Đủ dài để bao quát toàn bộ nội dung (viết khoảng 3 đến 5 câu, tối đa 500 ký tự).
- KHÔNG được bịa thông tin không có trong bài.

Yêu cầu định dạng:
- Không dùng ngoặc kép, không emoji, không markdown.
- Không dùng các câu rập khuôn như: "Trong audio này", "Bài viết này nói về".
- Trình bày thành một đoạn văn duy nhất.

Nội dung:
{text}
""".strip()
        return system_prompt, user_prompt

    # Chế độ Default (Giữ nguyên văn - Biên tập lại giọng đọc)
    user_prompt = f"""
Hãy biên tập nội dung sau thành một bản script phù hợp cho giọng đọc AI (độc thoại).

Mục tiêu cốt lõi:
- DIỄN ĐẠT CÓ HỒN NHƯNG BÁM SÁT TRỌNG TÂM: Được phép làm lại câu chữ cho mượt mà, thêm thắt lời dẫn để bài đọc không bị khô khan. 
- Dù vậy, nội dung cốt lõi, các ý chính và thông tin quan trọng PHẢI được giữ nguyên vẹn và chính xác so với bản gốc. KHÔNG cắt xén làm hụt ý.
- Bắt buộc thêm một câu chào mừng gợi mở ở đầu bài và câu chốt vấn đề/tạm biệt ở cuối bài.

Yêu cầu định dạng:
- Không markdown, không bullet, không ký tự đặc biệt.
- Viết thành các đoạn văn liền mạch, dễ đọc thành tiếng.

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

        if len(result) > 150:
            result = result[:150].rsplit(" ", 1)[0].strip()

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

        if len(result) > 500:
            result = result[:500].rsplit(" ", 1)[0].strip() + "..."

        return result or generate_short_description(text)
    except Exception:
        return generate_short_description(text)