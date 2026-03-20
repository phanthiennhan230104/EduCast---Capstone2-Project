from pathlib import Path
from uuid import uuid4

from django.conf import settings
from django.core.files.storage import default_storage


def save_chat_attachment(file_obj, folder: str = "chat"):
    ext = Path(file_obj.name).suffix
    filename = f"{folder}/{uuid4().hex}{ext}"
    saved_path = default_storage.save(filename, file_obj)
    url = default_storage.url(saved_path)

    if url.startswith("http://") or url.startswith("https://"):
        return url

    media_url = getattr(settings, "MEDIA_URL", "/media/")
    if not media_url.endswith("/"):
        media_url += "/"
    return f"{media_url}{saved_path}"