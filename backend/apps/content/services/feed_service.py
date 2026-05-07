from django.db.models import Count

from apps.content.models import Post, PostTag
from apps.social.models import HiddenPost, PostLike, SavedPost, Follow, PlaybackHistory


class FeedService:
    @staticmethod
    def get_feed(user, limit=20, feed_type="for_you", tag_ids=None):
        try:
            # allow anonymous user (e.g. public feed) — protect against None
            user_id = user.id if user else None

            followed_author_ids = list(
                Follow.objects.filter(follower_id=user_id).values_list("following_id", flat=True)
            ) if user_id else []

            posts_qs = (
                Post.objects
                .select_related("user", "user__profile")
                .annotate(
                    likes_count=Count("likes", distinct=True),
                    comments_count=Count("comments", distinct=True),
                    saves_count=Count("saved_by_users", distinct=True),
                )
            )

            # Filter for published and public posts, OR posts by the current user
            from django.db.models import Q
            
            # Exclude archived posts first
            posts_qs = posts_qs.exclude(status="archived")
            
            # Then filter: (published AND public) OR (belongs to current user AND not hidden)
            posts_qs = posts_qs.filter(
                Q(status="published", visibility="public") | 
                Q(user_id=user.id, status__in=["published", "draft"])
            )

            # Get hidden posts (skip if no user or table problem)
            try:
                if user_id:
                    hidden_post_ids = HiddenPost.objects.filter(
                        user_id=user_id
                    ).values_list("post_id", flat=True)
                    posts_qs = posts_qs.exclude(id__in=hidden_post_ids)
            except Exception as e:
                print(f"⚠️ Hidden posts table issue: {str(e)}")
                # Continue without filtering if table doesn't exist or query fails

            # Filter by tags if provided
            if tag_ids:
                posts_qs = posts_qs.filter(post_tags__tag_id__in=tag_ids).distinct()

            if feed_type == "following":
                if not followed_author_ids:
                    return []  
                posts_qs = posts_qs.filter(user_id__in=followed_author_ids)

            # Apply ordering based on feed type
            if feed_type == "trending":
                posts_qs = posts_qs.order_by(
                    "-likes_count",
                    "-comments_count",
                    "-created_at",
                )
            else:  # for_you, following, latest, and default
                posts_qs = posts_qs.order_by("-created_at")

            # Get more posts initially to account for shared posts that will be merged
            fetch_limit = limit * 2
            posts = list(posts_qs[:fetch_limit])
            
            # Get shared posts (bài viết được chia sẻ)
            shared_posts_qs = (
                PostShare.objects
                .filter(share_type="personal")
                .select_related("post", "post__user", "post__user__profile", "user", "user__profile")
                .order_by("-created_at")
            )
            
            # Filter shared posts by tags (filter by original post's tags)
            if tag_ids:
                shared_posts_qs = shared_posts_qs.filter(post__post_tags__tag_id__in=tag_ids).distinct()
            
            # Filter shared posts by feed type
            if feed_type == "following":
                shared_posts_qs = shared_posts_qs.filter(user_id__in=followed_author_ids)
            
            try:
                shared_posts = list(shared_posts_qs[:fetch_limit])
            except Exception as e:
                print(f"⚠️ Shared posts query issue: {str(e)}")
                shared_posts = []
            
            post_ids = [post.id for post in posts]
            author_ids = [post.user_id for post in posts]

            # Only query user-scoped tables if we have an authenticated user
            if user_id:
                liked_post_ids = set(
                    PostLike.objects.filter(user_id=user_id, post_id__in=all_post_ids)
                    .values_list("post_id", flat=True)
                )

                saved_post_ids = set(
                    SavedPost.objects.filter(user_id=user_id, post_id__in=all_post_ids)
                    .values_list("post_id", flat=True)
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
                liked_post_ids = set()
                saved_post_ids = set()
                following_author_ids = set()
                playback_map = {}

            tag_rows = (
                PostTag.objects
                .filter(post_id__in=post_ids)
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

            for post in posts:
                playback = playback_map.get(post.id)
                tags = tag_map.get(post.id, [])

                item = {
                    "id": post.id,
                    "title": post.title,
                    "description": post.description,
                    "created_at": post.created_at,
                    "thumbnail_url": getattr(post, "thumbnail_url", None),
                    "listen_count": getattr(post, "listen_count", 0) or 0,
                    "author": {
                        "id": post.user.id,
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
                        "likes": post.likes_count,
                        "comments": post.comments_count,
                        "shares": post.share_count,
                        "saves": post.saves_count,
                    },
                    "viewer_state": {
                        "is_liked": post.id in liked_post_ids,
                        "is_saved": post.id in saved_post_ids,
                        "is_following_author": post.user_id in following_author_ids,
                        "progress_seconds": getattr(playback, "progress_seconds", 0) or 0,
                        "duration_seconds": getattr(playback, "duration_seconds", 0) or 0,
                        "completed_ratio": float(getattr(playback, "completed_ratio", 0) or 0),
                        "is_completed": bool(getattr(playback, "is_completed", 0) or 0),
                    },
                }
                items.append(item)

            return items
        except Exception as e:
            print(f"❌ DEBUG FeedService Error in get_feed: {str(e)}")
            import traceback
            traceback.print_exc()
            raise