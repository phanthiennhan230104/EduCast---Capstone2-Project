from django.db.models import Count

from apps.content.models import Post, PostTag
from apps.social.models import HiddenPost, PostLike, SavedPost, Follow, PlaybackHistory, PostShare


class FeedService:
    @staticmethod
    def get_feed(user, limit=20, feed_type="for_you", tag_ids=None):
        try:
            followed_author_ids = list(
                Follow.objects.filter(follower_id=user.id)
                .values_list("following_id", flat=True)
            )

            posts_qs = (
                Post.objects
                .select_related("user", "user__profile")
                .annotate(
                    likes_count=Count("likes", distinct=True),
                    comments_count=Count("comments", distinct=True),
                    saves_count=Count("saved_by_users", distinct=True),
                )
            )

            posts_qs = posts_qs.filter(
                status="published",
                visibility="public"
            )

            # Get hidden posts, but handle if table doesn't exist
            try:
                hidden_post_ids = HiddenPost.objects.filter(
                    user_id=user.id
                ).values_list("post_id", flat=True)
                posts_qs = posts_qs.exclude(id__in=hidden_post_ids)
            except Exception as e:
                print(f"⚠️ Hidden posts table issue: {str(e)}")
                # Continue without filtering if table doesn't exist

            hidden_post_ids = HiddenPost.objects.filter(
                user_id=user.id
            ).values_list("post_id", flat=True)

            posts_qs = posts_qs.exclude(id__in=hidden_post_ids)

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
            
            shared_posts = list(shared_posts_qs[:fetch_limit])
            
            post_ids = [post.id for post in posts]
            shared_post_ids = [share.post_id for share in shared_posts]
            all_post_ids = post_ids + shared_post_ids
            
            # Get author IDs from regular posts
            author_ids = [post.user_id for post in posts]
            # For shared posts, get the original post author IDs (not the sharer)
            for share in shared_posts:
                if share.post.user_id not in author_ids:
                    author_ids.append(share.post.user_id)

            liked_post_ids = set(
                PostLike.objects.filter(user_id=user.id, post_id__in=all_post_ids)
                .values_list("post_id", flat=True)
            )

            saved_post_ids = set(
                SavedPost.objects.filter(user_id=user.id, post_id__in=all_post_ids)
                .values_list("post_id", flat=True)
            )

            following_author_ids = set(
                Follow.objects.filter(follower_id=user.id, following_id__in=author_ids)
                .values_list("following_id", flat=True)
            )

            playback_map = {
                row.post_id: row
                for row in PlaybackHistory.objects.filter(user_id=user.id, post_id__in=all_post_ids)
            }

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
                            "likes": getattr(post, "likes_count", 0) or getattr(post, "like_count", 0) or 0,
                            "comments": getattr(post, "comments_count", 0) or getattr(post, "comment_count", 0) or 0,
                            # This service doesn't annotate shares_count; fall back to model field share_count.
                            "shares": getattr(post, "shares_count", 0) or getattr(post, "share_count", 0) or 0,
                            "saves": getattr(post, "saves_count", 0) or getattr(post, "save_count", 0) or 0,
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
                        "id": post.user.id,
                        "username": post.user.username,
                        "name": orig_author_name,
                        "avatar_url": getattr(post.user.profile, "avatar_url", None) if hasattr(post.user, "profile") and post.user.profile else None,
                    },
                    "shared_by": {
                        "id": share.user.id,
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
                        # Shared posts queryset doesn't annotate counts like posts_qs does,
                        # so always read via getattr with safe fallbacks.
                        "likes": getattr(post, "likes_count", 0) or getattr(post, "like_count", 0) or 0,
                        "comments": getattr(post, "comments_count", 0) or getattr(post, "comment_count", 0) or 0,
                        "shares": getattr(post, "shares_count", 0) or getattr(post, "share_count", 0) or 0,
                        "saves": getattr(post, "saves_count", 0) or getattr(post, "save_count", 0) or 0,
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

            # Sort combined items by created_at in descending order
            items.sort(key=lambda x: x["created_at"], reverse=True)
            
            # Apply limit to combined items
            items = items[:limit]

            return items
        except Exception as e:
            print(f"❌ DEBUG FeedService Error in get_feed: {str(e)}")
            import traceback
            traceback.print_exc()
            raise