from typing import Any

from django.db import DatabaseError
from django.db.models import Q, QuerySet

from apps.content.models import Post

def _normalize_text(value: str | None) -> str:
    return (value or "").strip()


def _build_search_query(keyword: str) -> Q:
    tokens = [
        token.strip()
        for token in keyword.replace(",", " ").split()
        if len(token.strip()) >= 2
    ][:8]

    query = Q(title__icontains=keyword) | Q(description__icontains=keyword)

    for token in tokens:
        query |= Q(title__icontains=token)
        query |= Q(description__icontains=token)
        query |= Q(summary_text__icontains=token)
        query |= Q(transcript_text__icontains=token)
        query |= Q(learning_field__icontains=token)

    return query


def search_published_posts(keyword: str, limit: int = 10) -> list[dict[str, Any]]:
    normalized_keyword = _normalize_text(keyword)
    safe_limit = max(1, min(limit, 20))

    if not normalized_keyword:
        return []

    try:
        queryset: QuerySet[Post] = (
            Post.objects.filter(
                status=Post.StatusChoices.PUBLISHED,
                visibility=Post.VisibilityChoices.PUBLIC,
            )
            .filter(_build_search_query(normalized_keyword))
            .select_related("user")
            .order_by("-published_at", "-created_at")[:safe_limit]
        )

        return [
            {
                "id": post.id,
                "title": _normalize_text(post.title),
                "description": _normalize_text(post.description),
                "slug": _normalize_text(post.slug),
                "author": {
                    "id": post.user_id,
                    "username": getattr(post.user, "username", ""),
                },
            }
            for post in queryset
        ]

    except DatabaseError as exc:
        raise RuntimeError("Cannot search published posts.") from exc