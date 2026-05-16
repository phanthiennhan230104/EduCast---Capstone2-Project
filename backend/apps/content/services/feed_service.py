from django.db.models import Count, Q

from apps.content.models import Post, PostTag
from apps.social.models import HiddenPost, PostLike, SavedPost, Follow, PlaybackHistory, Comment
from apps.social.post_share_compat import post_share_qs, post_shares_has_shared_from_share_id_column


def _feed_posts_plain_qs(user_id, published_visible, tag_ids, topic_ids, feed_type, followed_author_ids, tag_slugs=None):
    """Queryset bài gốc (chưa annotate) — dùng chung cho fetch và fallback khi annotate lỗi SQL."""
    qs = Post.objects.select_related("user", "user__profile").filter(published_visible)
    try:
        if user_id:
            hidden_post_ids = HiddenPost.objects.filter(user_id=user_id).values_list(
                "post_id", flat=True
            )
            qs = qs.exclude(id__in=hidden_post_ids)
    except Exception as e:
        print(f"⚠️ Hidden posts table issue: {str(e)}")
    
    if tag_ids:
        post_ids_with_tags = PostTag.objects.filter(tag_id__in=tag_ids).values_list("post_id", flat=True)
        qs = qs.filter(id__in=post_ids_with_tags)
    
    if tag_slugs:
        # Filter by tag slugs - more robust for frontend links
        post_ids_with_slugs = PostTag.objects.filter(tag__slug__in=tag_slugs).values_list("post_id", flat=True)
        qs = qs.filter(id__in=post_ids_with_slugs)

    if topic_ids:
        qs = qs.filter(post_topics__topic_id__in=topic_ids).distinct()
    if feed_type == "following":
        if not followed_author_ids:
            qs = qs.none()
        else:
            qs = qs.filter(user_id__in=followed_author_ids)
    return qs


def _sort_feed_newest_first(items, limit):
    """
    Timeline mới → cũ theo `created_at` (bài gốc = lúc đăng, share = lúc share).

    Nhiều share rất mới dễ chiếm trọn `limit` dòng đầu khiến không còn dòng ``type: original``.
    Nếu pool vẫn có bài gốc mà cắt đúng `limit` theo thời gian không có bài gốc nào:
    lấy tối đa vài bài gốc đứng đầu trong timeline đã sort (mới nhất trong các bài gốc có trong pool),
    phần còn lại vẫn lần lượt theo thứ tự thời gian, không trùng id dòng.
    """
    if not limit:
        return []
    ordered = sorted(items, key=lambda x: x["created_at"], reverse=True)
    if len(ordered) <= limit:
        return _ensure_original_for_shared_rows(ordered, ordered, limit)

    head = ordered[:limit]
    originals_in_pool = [x for x in ordered if x.get("type") == "original"]
    if not originals_in_pool or any(x.get("type") == "original" for x in head):
        return _ensure_original_for_shared_rows(head, ordered, limit)

    k = min(6, limit, len(originals_in_pool))
    boosted = originals_in_pool[:k]
    seen_ids = {x["id"] for x in boosted}
    tail = []
    for x in ordered:
        if x["id"] in seen_ids:
            continue
        tail.append(x)
        if len(tail) >= limit - k:
            break
    return _ensure_original_for_shared_rows(boosted + tail, ordered, limit)


def _ensure_original_for_shared_rows(head, ordered, limit):
    """
    Nếu trong top feed có dòng ``type: shared`` (post_id = P) mà không có card ``type: original`` id = P,
    timeline chỉ thấy bài bọc share — user không thấy bài gốc trên feed.
    Gộp bài gốc P từ pool (nếu có) vào kết quả; nếu vượt limit thì loại dòng không bắt buộc (ưu tiên cũ nhất).
    """
    if not head or not ordered or not limit:
        return head
    orig_by_post_id = {
        str(x["id"]): x for x in ordered if x.get("type") == "original"
    }
    orig_ids_in_head = {str(h["id"]) for h in head if h.get("type") == "original"}
    forced = []
    seen_pid = set()
    for h in head:
        if h.get("type") != "shared":
            continue
        pid = h.get("post_id")
        if pid is None:
            continue
        pid = str(pid)
        if pid in seen_pid:
            continue
        seen_pid.add(pid)
        if pid in orig_ids_in_head:
            continue
        orig = orig_by_post_id.get(pid)
        if orig and str(orig["id"]) not in {str(o["id"]) for o in forced}:
            forced.append(orig)
            orig_ids_in_head.add(pid)
    if not forced:
        return head
    merged = {str(x["id"]): x for x in head}
    for o in forced:
        merged[str(o["id"])] = o
    out = sorted(merged.values(), key=lambda x: x["created_at"], reverse=True)
    forced_ids = {str(o["id"]) for o in forced}
    while len(out) > limit:
        removed = False
        for i in range(len(out) - 1, -1, -1):
            if str(out[i]["id"]) not in forced_ids:
                del out[i]
                removed = True
                break
        if not removed:
            break
    return sorted(out, key=lambda x: x["created_at"], reverse=True)


class FeedService:
    @staticmethod
    def get_feed(user, limit=20, feed_type="for_you", tag_ids=None, topic_ids=None, tag_slugs=None):
        try:
            # allow anonymous user (e.g. public feed) — protect against None
            user_id = user.id if user else None

            followed_author_ids = list(
                Follow.objects.filter(follower_id=user_id).values_list("following_id", flat=True)
            ) if user_id else []

            # Chỉ bài đã xuất bản. Công khai: mọi người (và user ẩn danh) đều thấy.
            # Riêng tư / không liệt kê: chỉ chủ bài (đã đăng nhập) thấy trên feed — không lộ bài người khác.
            # Bản nháp (draft) và các status khác không lên feed.
            public_visibility = (
                Q(visibility="public") |
                Q(visibility__isnull=True) |
                Q(visibility="")
            )
            published_visible = Q(status="published") & public_visibility
            if user_id:
                published_visible |= Q(
                    status="published",
                    user_id=user_id,
                    visibility__in=["private", "unlisted"],
                )

            posts_plain = _feed_posts_plain_qs(
                user_id, published_visible, tag_ids, topic_ids, feed_type, followed_author_ids, tag_slugs=tag_slugs
            )

            posts_qs = posts_plain.annotate(
                likes_count=Count(
                    "likes",
                    filter=Q(likes__share_id__isnull=True),
                    distinct=True,
                ),
                comments_count=Count(
                    "comments",
                    filter=Q(comments__share_id__isnull=True),
                    distinct=True,
                ),
                saves_count=Count(
                    "saved_by_users",
                    filter=Q(saved_by_users__share_id__isnull=True),
                    distinct=True,
                ),
            )

            # Apply ordering based on feed type
            if feed_type == "trending":
                posts_qs = posts_qs.order_by(
                    "-likes_count",
                    "-comments_count",
                    "-created_at",
                )
            elif feed_type == "tag_trending":
                # Sort by view_count/listen_count for hashtag pages
                posts_qs = posts_qs.order_by("-listen_count", "-created_at")
            else:  # for_you, following, latest, and default
                posts_qs = posts_qs.order_by("-created_at")

            # Pool lớn hơn một chút để bài gốc (theo post.created_at) vẫn lọt khi có nhiều share mới.
            fetch_limit = max(limit * 8, 80)
            try:
                posts = list(posts_qs[:fetch_limit])
            except Exception as e:
                print(f"⚠️ Feed posts query failed (annotate?), fallback without counts: {e}")
                posts = list(posts_plain.order_by("-created_at")[:fetch_limit])
            
            # Shared items in feed:
            # - Chỉ "personal" reshare (đăng bài chia sẻ) mới xuất hiện trên feed.
            # - "message" share (gửi qua tin nhắn) chỉ tăng share_count, KHÔNG tạo dòng feed.
            shared_posts_qs = post_share_qs().select_related(
                "post", "post__user", "post__user__profile", "user", "user__profile"
            )
            if feed_type == "tag_trending":
                shared_posts_qs = shared_posts_qs.none()
            else:
                shared_posts_qs = shared_posts_qs.filter(share_type="personal")
            # Dòng share trên timeline chung: chỉ bài gốc public (tránh lộ bài private qua re-share).
            shared_posts_qs = shared_posts_qs.filter(
                post__status="published",
            ).filter(
                Q(post__visibility="public") |
                Q(post__visibility__isnull=True) |
                Q(post__visibility="")
            ).order_by("-created_at")
            
            # Filter shared posts by tags (filter by original post's tags)
            if tag_ids:
                post_ids_with_tags = PostTag.objects.filter(tag_id__in=tag_ids).values_list("post_id", flat=True)
                shared_posts_qs = shared_posts_qs.filter(post_id__in=post_ids_with_tags)
            
            if tag_slugs:
                post_ids_with_slugs = PostTag.objects.filter(tag__slug__in=tag_slugs).values_list("post_id", flat=True)
                shared_posts_qs = shared_posts_qs.filter(post_id__in=post_ids_with_slugs)

            if topic_ids:
                shared_posts_qs = shared_posts_qs.filter(post__post_topics__topic_id__in=topic_ids).distinct()
            
            # Filter shared posts by feed type
            if feed_type == "following" and followed_author_ids:
                shared_posts_qs = shared_posts_qs.filter(user_id__in=followed_author_ids)
            elif feed_type == "following":
                shared_posts_qs = shared_posts_qs.none()
            
            try:
                shared_posts = list(shared_posts_qs[:fetch_limit])
            except Exception as e:
                print(f"⚠️ Shared posts query issue: {str(e)}")
                shared_posts = []
            
            post_ids = [post.id for post in posts]
            shared_post_ids = [share.post_id for share in shared_posts]
            all_post_ids = post_ids + shared_post_ids
            
            # Get author IDs from regular posts
            author_ids = [post.user_id for post in posts]
            # For shared posts, get the original post author IDs (not the sharer)
            for share in shared_posts:
                if share.post.user_id not in author_ids:
                    author_ids.append(share.post.user_id)

            # Like/lưu: chỉ bản ghi bài gốc (post_id, share_id=NULL); viewer_state / stats likes trên card share cũng theo bài gốc.
            if user_id:
                like_pairs = set(
                    PostLike.objects.filter(user_id=user_id, post_id__in=all_post_ids).values_list(
                        "post_id", "share_id"
                    )
                )
                liked_post_ids = {p[0] for p in like_pairs}
                save_pairs = set(
                    SavedPost.objects.filter(user_id=user_id, post_id__in=all_post_ids).values_list(
                        "post_id", "share_id"
                    )
                )

                following_author_ids = set(
                    Follow.objects.filter(follower_id=user_id, following_id__in=author_ids)
                    .values_list("following_id", flat=True)
                )

                playback_map = {
                    row.post_id: row
                    for row in PlaybackHistory.objects.filter(user_id=user_id, post_id__in=all_post_ids)
                }
            else:
                like_pairs = set()
                liked_post_ids = set()
                save_pairs = set()
                following_author_ids = set()
                playback_map = {}

            tag_rows = (
                PostTag.objects
                .filter(post_id__in=all_post_ids)
                .select_related("tag")
                .values("post_id", "tag__id", "tag__name", "tag__slug")
            )

            tag_map = {}
            for row in tag_rows:
                tag_map.setdefault(row["post_id"], []).append({
                    "id": row["tag__id"],
                    "name": row["tag__name"],
                    "slug": row["tag__slug"],
                })

            items = []

            # Lượt chia sẻ trên card bài gốc: gộp cả "personal" (đăng bài share) và "message" (gửi DM).
            # Chỉ tính share trực tiếp từ bài gốc, không tính re-share lồng nhau.
            direct_share_counts = {}
            if post_ids:
                try:
                    if post_shares_has_shared_from_share_id_column():
                        rows = (
                            post_share_qs()
                            .filter(
                                post_id__in=post_ids,
                                share_type__in=["personal", "message"],
                                shared_from_share_id__isnull=True,
                            )
                            .values("post_id")
                            .annotate(c=Count("id"))
                        )
                    else:
                        rows = (
                            post_share_qs()
                            .filter(
                                post_id__in=post_ids,
                                share_type__in=["personal", "message"],
                            )
                            .values("post_id")
                            .annotate(c=Count("id"))
                        )
                    for row in rows:
                        direct_share_counts[row["post_id"]] = row["c"]
                except Exception as e:
                    print(f"⚠️ Feed direct share counts query failed: {e}")
                    direct_share_counts = {}

            # Add regular posts
            for post in posts:
                playback = playback_map.get(post.id)
                tags = tag_map.get(post.id, [])

                item = {
                    "id": post.id,
                    "type": "original",
                    "post_id": post.id,
                    "share_id": None,
                    "title": post.title,
                    "description": post.description,
                    "created_at": post.created_at,
                    "shared_at": None,
                    "share_caption": None,
                    "thumbnail_url": getattr(post, "thumbnail_url", None),
                    "listen_count": getattr(post, "listen_count", 0) or 0,
                    "author": {
                        "id": str(post.user.id),
                        "username": post.user.username,
                        "name": getattr(post.user.profile, "display_name", None) if hasattr(post.user, "profile") and post.user.profile else post.user.username,
                        "avatar_url": getattr(post.user.profile, "avatar_url", None) if hasattr(post.user, "profile") and post.user.profile else None,
                    },
                    "tags": tags,
                    "audio": {
                        "id": f"post-{post.id}",
                        "voice_name": None,
                        "audio_url": post.audio_url,
                        "duration_seconds": post.duration_seconds,
                    } if post.audio_url else None,
                        "stats": {
                            "likes": getattr(post, "likes_count", getattr(post, "like_count", 0)),
                            "comments": getattr(post, "comments_count", getattr(post, "comment_count", 0)),
                            "shares": int(direct_share_counts.get(post.id, 0) or 0),
                            "saves": getattr(post, "saves_count", getattr(post, "save_count", 0)),
                        },
                    "viewer_state": {
                        "is_liked": post.id in liked_post_ids,
                        "is_saved": (post.id, None) in save_pairs,
                        "is_following_author": post.user_id in following_author_ids,
                        "progress_seconds": getattr(playback, "progress_seconds", 0) or 0,
                        "duration_seconds": getattr(playback, "duration_seconds", 0) or 0,
                        "completed_ratio": float(getattr(playback, "completed_ratio", 0) or 0),
                        "is_completed": bool(getattr(playback, "is_completed", 0) or 0),
                    },
                }
                items.append(item)

            # Add shared posts
            for share in shared_posts:
                post = share.post
                playback = playback_map.get(post.id)
                tags = tag_map.get(post.id, [])
                
                # Get original post author info
                orig_author_name = post.user.username
                if hasattr(post.user, "profile") and post.user.profile:
                    orig_author_name = post.user.profile.display_name or post.user.username

                shared_by_name = share.user.username
                shared_by_avatar = None
                if hasattr(share.user, "profile") and share.user.profile:
                    shared_by_name = share.user.profile.display_name or share.user.username
                    shared_by_avatar = share.user.profile.avatar_url

                # Share count cho "dòng share": re-share (cần cột shared_from_share_id trong DB).
                if post_shares_has_shared_from_share_id_column():
                    try:
                        reshare_count = post_share_qs().filter(
                            shared_from_share_id=share.id,
                            share_type="personal",
                        ).count()
                    except Exception:
                        reshare_count = 0
                else:
                    reshare_count = 0

                try:
                    share_comments = Comment.objects.filter(share_id=share.id).count()
                except Exception:
                    share_comments = 0
                try:
                    share_likes = PostLike.objects.filter(
                        post_id=post.id, share_id=share.id
                    ).count()
                    canonical_likes = PostLike.objects.filter(
                        post_id=post.id
                    ).count()
                    canonical_saves = SavedPost.objects.filter(
                        post_id=post.id
                    ).count()
                except Exception:
                    share_likes = canonical_likes = canonical_saves = 0

                if post.id in liked_post_ids and user:
                    viewer_like_on_share = PostLike.objects.filter(
                        user_id=user.id, post_id=post.id, share_id=share.id
                    ).exists()
                    if not viewer_like_on_share:
                        share_likes += 1

                item = {
                    "id": f"share_{share.id}_{post.id}",
                    "type": "shared",
                    "post_id": post.id,
                    "share_id": share.id,
                    "title": post.title,
                    "description": post.description or (share.caption if share.caption else ""),
                    "created_at": share.created_at,  # Thời gian chia sẻ (dùng để sắp xếp feed)
                    "shared_at": share.created_at,   # Thời gian chia sẻ
                    "post_created_at": post.created_at,  # Thời gian đăng bài gốc
                    "share_caption": share.caption,
                    "thumbnail_url": getattr(post, "thumbnail_url", None),
                    "listen_count": getattr(post, "listen_count", 0) or 0,
                    "author": {
                        "id": str(post.user.id),
                        "username": post.user.username,
                        "name": orig_author_name,
                        "avatar_url": getattr(post.user.profile, "avatar_url", None) if hasattr(post.user, "profile") and post.user.profile else None,
                    },
                    "shared_by": {
                        "id": str(share.user.id),
                        "username": share.user.username,
                        "name": shared_by_name,
                        "avatar_url": shared_by_avatar,
                    },
                    "tags": tags,
                    "audio": {
                        "id": f"post-{post.id}",
                        "voice_name": None,
                        "audio_url": post.audio_url,
                        "duration_seconds": post.duration_seconds,
                    } if post.audio_url else None,
                    "stats": {
                        "likes": share_likes,
                        "comments": share_comments,
                        "shares": reshare_count,
                        "saves": canonical_saves,
                    },
                    "viewer_state": {
                        "is_liked": post.id in liked_post_ids,
                        "is_saved": (post.id, None) in save_pairs,
                        "is_following_author": post.user_id in following_author_ids,
                        "progress_seconds": getattr(playback, "progress_seconds", 0) or 0,
                        "duration_seconds": getattr(playback, "duration_seconds", 0) or 0,
                        "completed_ratio": float(getattr(playback, "completed_ratio", 0) or 0),
                        "is_completed": bool(getattr(playback, "is_completed", 0) or 0),
                    },
                }
                items.append(item)

            if feed_type == "tag_trending":
                # For hashtag trending, sort by listen_count
                items = sorted(items, key=lambda x: x.get("listen_count", 0), reverse=True)
                return items[:limit]

            items = _sort_feed_newest_first(items, limit)

            return items
        except Exception as e:
            print(f"❌ DEBUG FeedService Error in get_feed: {str(e)}")
            import traceback
            traceback.print_exc()
            raise
