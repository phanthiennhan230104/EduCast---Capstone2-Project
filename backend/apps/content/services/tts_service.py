import asyncio
import edge_tts

VOICE_MAP = {
    # Legacy display names
    "Minh Tuấn": "vi-VN-NamMinhNeural",
    "Lan Anh": "vi-VN-HoaiMyNeural",
    "Hùng": "vi-VN-NamMinhNeural",
    "Thu Hà": "vi-VN-HoaiMyNeural",
    # Short IDs from frontend
    "vi-hoai-my": "vi-VN-HoaiMyNeural",
    "vi-nam-minh": "vi-VN-NamMinhNeural",
    "en-andrew": "en-US-AndrewNeural",
    "en-ava": "en-US-AvaNeural",
    # Full neural voice names (pass-through)
    "vi-VN-HoaiMyNeural": "vi-VN-HoaiMyNeural",
    "vi-VN-NamMinhNeural": "vi-VN-NamMinhNeural",
    "en-US-AndrewNeural": "en-US-AndrewNeural",
    "en-US-AvaNeural": "en-US-AvaNeural",
}

async def _generate(text: str, voice_name: str, output_path: str):
    voice = VOICE_MAP.get(voice_name, "vi-VN-NamMinhNeural")
    communicate = edge_tts.Communicate(text=text, voice=voice)
    await communicate.save(output_path)

def generate_audio_file(text: str, voice_name: str, output_path: str):
    text = (text or "").strip()
    if not text:
        raise ValueError("Text đầu vào rỗng.")

    try:
        asyncio.run(_generate(text, voice_name, output_path))
    except RuntimeError:
        loop = asyncio.new_event_loop()
        try:
            loop.run_until_complete(_generate(text, voice_name, output_path))
        finally:
            loop.close()