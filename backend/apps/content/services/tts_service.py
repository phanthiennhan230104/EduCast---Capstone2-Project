import asyncio
import edge_tts


VOICE_MAP = {
    "Minh Tuấn": "vi-VN-NamMinhNeural",
    "Lan Anh": "vi-VN-HoaiMyNeural",
    "Hùng": "vi-VN-NamMinhNeural",
    "Thu Hà": "vi-VN-HoaiMyNeural",
}


async def _generate(text: str, voice_name: str, output_path: str):
    voice = VOICE_MAP.get(voice_name, "vi-VN-NamMinhNeural")
    communicate = edge_tts.Communicate(text=text, voice=voice)
    await communicate.save(output_path)


def generate_audio_file(text: str, voice_name: str, output_path: str):
    asyncio.run(_generate(text, voice_name, output_path))