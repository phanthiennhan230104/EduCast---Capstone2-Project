from typing import Any

from django.db import DatabaseError
from django.db.models import Q, QuerySet, Case, When, Value, IntegerField

from apps.content.models import Post


def _normalize_text(value: str | None) -> str:
    return (value or "").strip()


def _extract_search_keyword(text: str) -> str:
    text = _normalize_text(text).lower()

    stop_phrases = [
        "tôi muốn học",
        "mình muốn học",
        "cho tôi học",
        "tôi muốn",
        "mình muốn",
        "học về",
        "podcast về",
        "bài học về",
        "tìm podcast về",
        "tìm bài về",
        "tìm bài viết về",
    ]

    for phrase in stop_phrases:
        text = text.replace(phrase, "")

    return text.strip()


def _build_tokens(keyword: str) -> list[str]:
    return [
        token.strip()
        for token in keyword.replace(",", " ").split()
        if len(token.strip()) >= 2
    ][:8]


def _build_search_query(keyword: str) -> Q:
    tokens = _build_tokens(keyword)

    query = (
        Q(post_topics__topic__name__icontains=keyword)
        | Q(post_topics__topic__slug__icontains=keyword)
        | Q(post_tags__tag__name__icontains=keyword)
        | Q(post_tags__tag__slug__icontains=keyword)
        | Q(title__icontains=keyword)
        | Q(description__icontains=keyword)
    )

    for token in tokens:
        query |= Q(post_topics__topic__name__icontains=token)
        query |= Q(post_topics__topic__slug__icontains=token)
        query |= Q(post_tags__tag__name__icontains=token)
        query |= Q(post_tags__tag__slug__icontains=token)
        query |= Q(title__icontains=token)
        query |= Q(description__icontains=token)
        query |= Q(summary_text__icontains=token)
        query |= Q(dialogue_script__icontains=token)
        query |= Q(transcript_text__icontains=token)
        query |= Q(learning_field__icontains=token)

    return query


def search_published_posts(keyword: str, limit: int = 10) -> list[dict[str, Any]]:
    normalized_keyword = _extract_search_keyword(keyword)
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
            .annotate(
                relevance=Case(
                    When(post_topics__topic__name__icontains=normalized_keyword, then=Value(100)),
                    When(post_topics__topic__slug__icontains=normalized_keyword, then=Value(95)),
                    When(post_tags__tag__name__icontains=normalized_keyword, then=Value(90)),
                    When(post_tags__tag__slug__icontains=normalized_keyword, then=Value(85)),
                    When(title__icontains=normalized_keyword, then=Value(70)),
                    When(description__icontains=normalized_keyword, then=Value(50)),
                    When(summary_text__icontains=normalized_keyword, then=Value(30)),
                    When(dialogue_script__icontains=normalized_keyword, then=Value(20)),
                    When(transcript_text__icontains=normalized_keyword, then=Value(10)),
                    default=Value(0),
                    output_field=IntegerField(),
                )
            )
            .filter(relevance__gte=50)
            .select_related("user", "user__profile")
            .prefetch_related("post_topics__topic", "post_tags__tag")
            .order_by("-relevance", "-published_at", "-created_at")
        )

        results = []
        seen_ids = set()
        seen_content = set()
        
        # Manually deduplicate while maintaining order and respecting limit
        for post in queryset:
            if post.id in seen_ids:
                continue
            
            # Additional deduplication for same content (title + author)
            # This handles cases where a post might have multiple records due to shares/imports
            content_key = (post.title.strip().lower(), post.user_id)
            if content_key in seen_content:
                continue
            
            seen_ids.add(post.id)
            seen_content.add(content_key)
            results.append({
                "type": "original",
                "id": post.id,
                "post_id": post.id,
                "share_id": None,
                "title": _normalize_text(post.title),
                "description": _normalize_text(post.description),
                "slug": _normalize_text(post.slug),
                "thumbnail_url": post.thumbnail_url if hasattr(post, "thumbnail_url") else None,
                "created_at": post.created_at,
                "author": {
                    "id": post.user_id,
                    "username": getattr(post.user, "username", ""),
                    "name": getattr(post.user.profile, "display_name", "") if hasattr(post.user, "profile") and post.user.profile else getattr(post.user, "username", ""),
                    "avatar_url": getattr(post.user.profile, "avatar_url", None) if hasattr(post.user, "profile") and post.user.profile else None,
                },
                "topics": [
                    {
                        "id": post_topic.topic.id,
                        "name": _normalize_text(post_topic.topic.name),
                        "slug": _normalize_text(post_topic.topic.slug),
                    }
                    for post_topic in post.post_topics.all()
                    if post_topic.topic
                ],
                "tags": [
                    {
                        "id": post_tag.tag.id,
                        "name": _normalize_text(post_tag.tag.name),
                        "slug": _normalize_text(post_tag.tag.slug),
                    }
                    for post_tag in post.post_tags.all()
                    if post_tag.tag
                ],
                "audio": {
                    "id": f"post-{post.id}",
                    "audio_url": post.audio_url,
                    "duration_seconds": post.duration_seconds,
                } if post.audio_url else None,
                "stats": {
                    "likes": getattr(post, "like_count", 0) or 0,
                    "comments": getattr(post, "comment_count", 0) or 0,
                    "shares": getattr(post, "share_count", 0) or 0,
                    "saves": getattr(post, "save_count", 0) or 0,
                },
                "viewer_state": {
                    "is_liked": False,
                    "is_saved": False,
                    "is_following_author": False,
                    "progress_seconds": 0,
                    "duration_seconds": 0,
                    "completed_ratio": 0,
                    "is_completed": False,
                },
            })
            
            if len(results) >= safe_limit:
                break

        return results

    except DatabaseError as exc:
        raise RuntimeError("Cannot search published posts.") from exc