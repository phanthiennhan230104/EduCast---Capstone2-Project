import os
from django.conf import settings
from django.core.files.storage import default_storage
from django.utils.crypto import get_random_string


def save_chat_attachment(file_obj):
    ext = os.path.splitext(file_obj.name)[-1]
    filename = f"{get_random_string(32)}{ext}"
    relative_path = f"chat/{filename}"

    full_path = os.path.join(settings.MEDIA_ROOT, relative_path)

    # tạo folder nếu chưa có
    os.makedirs(os.path.dirname(full_path), exist_ok=True)

    with open(full_path, "wb+") as destination:
        for chunk in file_obj.chunks():
            destination.write(chunk)

    return f"{settings.MEDIA_URL}{relative_path}"