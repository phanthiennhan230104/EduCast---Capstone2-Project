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
            "Nội dung gốc khá ngắn, chỉ cần rút gọn nhẹ và giữ gần như đầy đủ ý chính. "
            "Không được làm nội dung trở nên quá cụt."
        )
    if words < 300:
        return (
            "Rút gọn ở mức vừa phải, giữ phần lớn ý chính và chỉ lược bỏ phần lặp, ví dụ phụ hoặc diễn giải dài."
        )
    if words < 700:
        return (
            "Tóm gọn rõ ràng, giữ đầy đủ các ý cốt lõi, có thể lược bớt ví dụ dài, chi tiết phụ và phần giải thích lặp."
        )
    return (
        "Nội dung gốc khá dài, cần gom nhóm ý, giữ đầy đủ các luận điểm chính, "
        "loại bỏ phần lặp và chi tiết thứ yếu nhưng không được làm mất mạch logic."
    )


def _target_dialogue_guidance(text: str) -> str:
    words = _word_count(text)

    if words < 120:
        return "Tạo hội thoại ngắn gọn, khoảng 6 đến 8 lượt nói, nhưng vẫn phải đủ mở đầu, giải thích và kết lại."
    if words < 300:
        return "Tạo hội thoại vừa phải, khoảng 8 đến 12 lượt nói, giữ đủ các ý chính."
    if words < 700:
        return "Tạo hội thoại có chiều sâu, khoảng 10 đến 16 lượt nói, triển khai lần lượt các ý quan trọng."
    return (
        "Nội dung gốc dài, cho phép hội thoại dài hơn, khoảng 14 đến 22 lượt nói, "
        "nhưng vẫn phải giữ nhịp tự nhiên và không lặp ý."
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

    intro = "Trong nội dung này, chúng ta sẽ cùng điểm qua những ý quan trọng nhất."
    body = sentences[:keep_count]
    outro = "Tóm lại, đây là những điểm cốt lõi bạn cần ghi nhớ."

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
        "MC: Hôm nay chúng ta sẽ cùng tìm hiểu nội dung chính của chủ đề này.",
        "Khách mời: Mình sẽ tóm lược lại theo cách ngắn gọn và dễ hiểu nhất.",
    ]

    for idx, sentence in enumerate(chunks, start=1):
        if idx == 1:
            lines.append("MC: Trước tiên, ý quan trọng nhất ở đây là gì?")
            lines.append("Khách mời: " + sentence)
        else:
            lines.append(f"MC: Vậy còn ý số {idx} thì sao?")
            lines.append("Khách mời: " + sentence)

    lines.append("MC: Nếu phải chốt lại ngắn gọn thì sao?")
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

    intro = "In this audio, we will quickly go through the most important ideas."
    body = " ".join(sentences[:keep_count])
    outro = "In short, these are the main points you should remember."

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

    first = re.sub(r"^(Trong audio này|Trong bài này|Bài viết này|Nội dung này)\s*[:,.-]?\s*", "", first, flags=re.IGNORECASE)

    if len(first) > 110:
        first = first[:110].rsplit(" ", 1)[0].strip() + "..."

    return first


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
        "Bạn là biên tập viên nội dung cho podcast giáo dục. "
        "Hãy viết lại nội dung sao cho khi chuyển thành giọng đọc AI, người nghe cảm thấy tự nhiên, rõ ràng và dễ tiếp thu. "
        "Ưu tiên cấu trúc logic, câu văn ngắn vừa phải, chuyển ý mượt, giữ đúng các ý quan trọng. "
        "Không cắt cụt ý. Không viết quá chung chung. Không nhồi nhét quá nhiều thông tin trong một câu. "
        "Đầu ra phải nghe giống script audio đã được biên tập, không giống văn bản thô."
    )

    if mode == "summary":
        user_prompt = f"""
Hãy biên tập nội dung sau thành một bản tóm tắt dạng script podcast bằng tiếng Việt.

Mục tiêu:
- Rút gọn nội dung nhưng vẫn giữ đầy đủ các ý quan trọng
- Không phải tóm tắt cực ngắn kiểu chỉ còn vài câu
- Phải đủ thông tin để người nghe hiểu được vấn đề cốt lõi mà không cần đọc bản gốc

Yêu cầu:
- Viết thành các đoạn văn tự nhiên, không bullet, không markdown
- Có mở đầu ngắn để giới thiệu chủ đề
- Trình bày lần lượt các ý chính theo logic dễ nghe
- Có câu kết ngắn gọn để chốt lại nội dung
- Văn phong giống người giải thích dễ hiểu trong podcast giáo dục
- Loại bỏ chi tiết thừa, lặp ý, ví dụ quá dài hoặc phần diễn giải vòng vo
- Giữ lại thuật ngữ quan trọng nếu cần, nhưng diễn đạt dễ hiểu
- Không được cắt cụt nội dung
- Không được sao chép nguyên văn quá nhiều từ đầu vào
- Hướng dẫn theo độ dài nội dung: {summary_guidance}

Đầu ra mong muốn:
- Nghe như một đoạn trình bày ngắn gọn nhưng đầy đủ
- Không khô cứng
- Không quá ít ý

Nội dung:
{text}
""".strip()
        return system_prompt, user_prompt

    if mode == "dialogue":
        user_prompt = f"""
Hãy chuyển nội dung sau thành hội thoại podcast giữa MC và Khách mời bằng tiếng Việt.

Mục tiêu:
- Giúp người nghe tiếp cận nội dung theo cách tự nhiên, sinh động, dễ hiểu
- Vẫn giữ được chiều sâu thông tin, không biến thành đoạn hỏi đáp hời hợt

Yêu cầu:
- Dùng đúng tiền tố "MC:" và "Khách mời:"
- Có mở đầu để giới thiệu chủ đề
- Phần thân triển khai lần lượt các ý chính
- Có đoạn kết để tổng kết lại
- Mỗi lượt nói nên ngắn gọn, tự nhiên, dễ nghe
- Không để một nhân vật nói quá dài liên tục
- Không lặp ý giữa các lượt thoại
- Không sao chép nguyên văn quá nhiều từ đầu vào
- Tổng thể phải nghe giống một cuộc trao đổi giải thích kiến thức, không phải đọc lại văn bản
- Hướng dẫn theo độ dài nội dung: {dialogue_guidance}

Đầu ra mong muốn:
- Hội thoại mượt, có nhịp điệu
- Có cảm giác như podcast giáo dục thật
- Vừa dễ nghe vừa đủ thông tin

Nội dung:
{text}
""".strip()
        return system_prompt, user_prompt

    if mode == "translate":
        user_prompt = f"""
Rewrite the following content into a natural English podcast script.

Goals:
- Keep the important ideas
- Make it sound natural when read aloud
- Do not make it too short unless the source is already short
- Keep enough substance so listeners can understand the topic without reading the original text

Requirements:
- Write in clear spoken English
- Include a brief opening
- Present the key ideas in a logical order
- End with a short conclusion
- Remove repetition and overly academic phrasing
- Keep important terms when necessary
- The output should feel like an educational audio script, not a raw translation
- The output should be condensed, but not overly compressed

Content:
{text}
""".strip()
        return system_prompt, user_prompt

    if mode == "description":
        user_prompt = f"""
Viết mô tả thật ngắn để giới thiệu một audio học tập cho người dùng.

Mục tiêu:
- Làm người đọc muốn bấm nghe audio
- Chỉ nêu ý chính hấp dẫn nhất của nội dung
- Không biến thành đoạn tóm tắt dài

Yêu cầu:
- Chỉ 1 câu, tối đa 120 ký tự
- Ngắn, gọn, tự nhiên, cuốn hút
- Nêu đúng chủ đề chính hoặc lợi ích người nghe nhận được
- Không markdown, không bullet, không emoji
- Không mở đầu bằng các cụm như: "Trong audio này", "Bài viết này", "Nội dung này"
- Không viết lan man
- Không dùng dấu ngoặc kép
- Ưu tiên văn phong kiểu teaser ngắn cho feed/audio card

Ví dụ phong cách mong muốn:
- Hiểu backpropagation theo cách ngắn gọn, dễ nhớ và dễ áp dụng.
- Tóm nhanh tư duy cốt lõi giúp bạn nắm vấn đề mà không cần đọc cả tài liệu.
- Nghe 1 lần để nắm ý chính về chủ đề này một cách rõ ràng hơn.

Nội dung:
{text}
""".strip()
        return system_prompt, user_prompt

    user_prompt = f"""
Hãy viết lại nội dung sau thành phiên bản phù hợp để đọc audio bằng tiếng Việt.

Yêu cầu:
- Giữ nguyên ý chính của nội dung
- Chỉnh câu văn cho mượt và tự nhiên hơn khi đọc thành tiếng
- Loại bỏ ký tự thừa, chỗ lặp, và những đoạn quá rối
- Có thể tách lại câu để người nghe dễ theo dõi hơn
- Không dùng bullet, không markdown
- Không rút gọn quá mức
- Kết quả phải nghe như một đoạn thuyết minh rõ ràng, mạch lạc

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


def generate_ai_description(text: str) -> str:
    text = _clean_text(text)
    if not text:
        return ""

    short_text = text[:4000]

    try:
        result = _generate_with_ai(short_text, "description")
        result = _clean_text(result)

        if len(result) > 120:
            result = result[:120].rsplit(" ", 1)[0].strip() + "..."

        return result
    except Exception:
        return generate_short_description(text)