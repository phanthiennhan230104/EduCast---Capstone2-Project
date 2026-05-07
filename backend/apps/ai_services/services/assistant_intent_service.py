def detect_assistant_intent(message: str) -> str:
    text = (message or "").strip().lower()

    if not text:
        return "draft"

    if any(keyword in text for keyword in [
        "tìm bài", "search post", "tìm post", "bài viết có sẵn",
        "trong feed", "nội dung đã đăng", "bài nào về"
    ]):
        return "search"

    if any(keyword in text for keyword in [
        "podcast", "audio podcast", "script podcast", "kịch bản podcast",
        "nội dung để đọc audio", "đọc audio", "voice over", "tts"
    ]):
        return "podcast_script"

    if any(keyword in text for keyword in ["gợi ý", "idea", "chủ đề", "topic"]):
        return "idea"

    if any(keyword in text for keyword in ["dàn ý", "outline", "ý chính"]):
        return "outline"

    if any(keyword in text for keyword in ["viết lại", "rewrite", "rút gọn", "dễ hiểu hơn"]):
        return "rewrite"

    if any(keyword in text for keyword in ["title", "tiêu đề", "description", "mô tả", "hashtag", "tag"]):
        return "title_description_tags"

    return "draft"