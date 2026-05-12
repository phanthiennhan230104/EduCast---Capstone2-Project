"""
Tương thích DB: bảng post_shares có thể chưa có cột shared_from_share_id.
ORM mặc định SELECT mọi field trên model → MySQL 1054 nếu thiếu cột.
"""
from django.db import connection

from apps.social.models import PostShare

_COLUMN_EXISTS_CACHE = None


def post_shares_has_shared_from_share_id_column():
    global _COLUMN_EXISTS_CACHE
    if _COLUMN_EXISTS_CACHE is not None:
        return _COLUMN_EXISTS_CACHE
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "SHOW COLUMNS FROM post_shares LIKE %s",
                ["shared_from_share_id"],
            )
            _COLUMN_EXISTS_CACHE = cursor.fetchone() is not None
    except Exception:
        _COLUMN_EXISTS_CACHE = False
    return _COLUMN_EXISTS_CACHE


def post_share_qs():
    """
    Queryset đọc PostShare: không SELECT cột shared_from_share_id (an toàn khi DB chưa migration).
    Khi cột đã tồn tại, defer vẫn hợp lệ.
    """
    return PostShare.objects.defer("shared_from_share_id")
