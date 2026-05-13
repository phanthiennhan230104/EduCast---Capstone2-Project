import json
from django.http import JsonResponse, Http404
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import get_object_or_404
from django.utils import timezone
from requests import post
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from .models import HiddenPost, PostLike, SavedPost, Comment, CommentLike, Follow, Notification, PostShare, PlaybackHistory, PostNote, Collection, CollectionPost, Report
from apps.content.models import Post, PostTag
from apps.users.models import User
from apps.users.authentication import CustomJWTAuthentication
from apps.social.models import PlaybackHistory
from apps.chat.models import  Message
from apps.chat.serializers import MessageSerializer
from apps.chat.services import get_or_create_direct_room
from apps.chat.services import broadcast_room_snapshot
from django.db import connection
from django.db.models import F
from django.db.models import Count, Q

from apps.social.post_share_compat import (
    post_share_qs,
    post_shares_has_shared_from_share_id_column,
)


def _post_shares_has_shared_from_share_id_column():
    """Alias — giữ tên cũ cho share_post / INSERT fallback."""
    return post_shares_has_shared_from_share_id_column()

# Tạo response thành công thống nhất.
def _json_success(message, data=None, status=200):
    return JsonResponse({
        "success": True,
        "message": message,
        "data": data or {}
    }, status=status)

# Tạo response lỗi thống nhất.
def _json_error(message, status=400):
    return JsonResponse({
        "success": False,
        "message": message
    }, status=status)

#  Demo-friendly ID generator cho CHAR(26). 
def _generate_id(prefix="obj"):
    raw = f"{prefix}{timezone.now().strftime('%y%m%d%H%M%S%f')}"
    return raw[:26].ljust(26, "0")

# Đọc body JSON từ request.
def _parse_body(request):
    if not request.body:
        return {}
    try:
        return json.loads(request.body)
    except json.JSONDecodeError:
        return None

# Lấy user hiện tại từ request hoặc body. Ưu tiên authenticate bằng JWT, sau đó là user_id từ query params hoặc body.
def _get_current_user(request, body=None):
    if hasattr(request, "user") and request.user and request.user.is_authenticated:
        return request.user

    # Thử authenticate bằng JWT từ header Authorization
    try:
        auth_result = CustomJWTAuthentication().authenticate(request)
        if auth_result:
            user, _token = auth_result
            return user
    except Exception:
        pass

    user_id = request.GET.get("user_id")
    if not user_id and body:
        user_id = body.get("user_id")

    if not user_id:
        return None

    return User.objects.filter(id=user_id).first()

# Tạo notification nếu recipient_id khác actor_user_id và không null. 
def _create_notification(
    recipient_id,
    actor_user_id,
    notification_type,
    title,
    body=None,
    reference_type=None,
    reference_id=None,
):
    # Không gửi notification cho chính mình
    if not recipient_id or recipient_id == actor_user_id:
        return None

    return Notification.objects.create(
        id=_generate_id("noti"),
        user_id=recipient_id,
        actor_user_id=actor_user_id,
        type=notification_type,
        title=title,
        body=body,
        reference_type=reference_type,
        reference_id=reference_id,
        is_read=False,
    )

# Helper để đếm like/comment/save/share cho post
def _post_counts(post_id, share_id=None):
    if share_id:
        # For shared posts, return counts for this specific share
        try:
            save_count = SavedPost.objects.filter(share_id=share_id).count()
        except Exception:
            # DB schema may not have saved_posts.share_id; fall back to post-level count.
            save_count = SavedPost.objects.filter(post_id=post_id).count()

        try:
            like_count = PostLike.objects.filter(share_id=share_id).count()
        except Exception:
            like_count = PostLike.objects.filter(post_id=post_id).count()

        try:
            comment_count = Comment.objects.filter(share_id=share_id).count()
        except Exception:
            comment_count = Comment.objects.filter(post_id=post_id).count()

        # Share count cho "bài share": số lần bài share này được share lại (re-share).
        if post_shares_has_shared_from_share_id_column():
            try:
                share_count = PostShare.objects.filter(
                    shared_from_share_id=share_id,
                    share_type="personal",
                ).count()
            except Exception:
                share_count = 0
        else:
            share_count = 0

        return {
            "like_count": like_count,
            "comment_count": comment_count,
            "save_count": save_count,
            "share_count": share_count,
        }
    else:
        # For original posts, return counts excluding shares
        try:
            like_count = PostLike.objects.filter(post_id=post_id, share_id__isnull=True).count()
        except Exception:
            like_count = PostLike.objects.filter(post_id=post_id).count()

        try:
            comment_count = Comment.objects.filter(post_id=post_id, share_id__isnull=True).count()
        except Exception:
            comment_count = Comment.objects.filter(post_id=post_id).count()

        try:
            save_count = SavedPost.objects.filter(post_id=post_id, share_id__isnull=True).count()
        except Exception:
            # DB schema may not have saved_posts.share_id; count by post only.
            save_count = SavedPost.objects.filter(post_id=post_id).count()

        # Share count cho bài gốc: tính cả share đăng feed (personal) lẫn share qua tin nhắn (message);
        # chỉ tính share trực tiếp từ bài gốc, không tính re-share lồng từ share khác.
        if post_shares_has_shared_from_share_id_column():
            share_count = PostShare.objects.filter(
                post_id=post_id,
                share_type__in=["personal", "message"],
                shared_from_share_id__isnull=True,
            ).count()
        else:
            share_count = PostShare.objects.filter(
                post_id=post_id,
                share_type__in=["personal", "message"],
            ).count()

        return {
            "like_count": like_count,
            "comment_count": comment_count,
            "save_count": save_count,
            "share_count": share_count,
        }

# Chuyển comment thành dict, có thể include replies nếu cần.
def _comment_to_dict(comment, include_replies=False, liked_comment_ids=None, depth=0):
    liked_comment_ids = liked_comment_ids or set()
    like_count = CommentLike.objects.filter(comment_id=comment.id).count()

    data = {
        "id": comment.id,
        "post_id": comment.post_id,
        "user_id": comment.user_id,
        "parent_comment_id": comment.parent_comment_id,
        "content": comment.content,
        "status": comment.status,
        "like_count": like_count,
        "is_liked": comment.id in liked_comment_ids,
        "created_at": comment.created_at.isoformat() if comment.created_at else None,
        "updated_at": comment.updated_at.isoformat() if comment.updated_at else None,
    }

    profile = getattr(comment.user, "profile", None)

    if hasattr(comment.user, "username"):
        data["username"] = comment.user.username

    data["display_name"] = (
        profile.display_name
        if profile and profile.display_name
        else comment.user.username
    )

    data["avatar_url"] = (
        profile.avatar_url
        if profile and profile.avatar_url
        else None
    )

    if hasattr(comment, "reply_to_user_id"):
        data["reply_to_user_id"] = comment.reply_to_user_id

    if hasattr(comment, "reply_to_username"):
        data["reply_to_username"] = comment.reply_to_username

    if include_replies and depth < 3:
        replies = Comment.objects.filter(
            parent_comment_id=comment.id
        ).select_related("user").order_by("-created_at")

        data["replies"] = [
            _comment_to_dict(
                reply,
                include_replies=True,
                liked_comment_ids=liked_comment_ids,
                depth=depth + 1
            )
            for reply in replies
        ]

    return data

# Chuyển notification thành dict, có thể include actor_username nếu có.
def _notification_to_dict(notification):
    data = {
        "id": notification.id,
        "user_id": notification.user_id,
        "actor_user_id": notification.actor_user_id,
        "type": notification.type,
        "title": notification.title,
        "body": notification.body,
        "reference_type": notification.reference_type,
        "reference_id": notification.reference_id,
        "is_read": notification.is_read,
        "created_at": notification.created_at.isoformat() if notification.created_at else None,
    }

    # Nếu bảng users có username thì dùng được. Nếu không có thì giữ actor_user_id.
    if notification.actor_user and hasattr(notification.actor_user, "username"):
        data["actor_username"] = notification.actor_user.username

    return data

# Toggle like/unlike post
@csrf_exempt
@require_http_methods(["POST"])
def toggle_like_post(request, post_id):
    try:
        # Lấy body JSON từ request
        body = _parse_body(request)
        if body is None:
            body = {}
        
        # Lấy user hiện tại từ request hoặc body
        user = _get_current_user(request, body)
        if not user:
            return _json_error("Authentication required", 401)

        # Composite share id (share_<shareId>_<postId>) — DB không có UNIQUE theo share_id,
        # nên like luôn ở cấp bài gốc (share_id NULL), thống nhất với cách Feed/CommentModal
        # đang tính is_liked.
        actual_post_id = post_id
        if post_id.startswith('share_'):
            parts = post_id.split('_')
            if len(parts) >= 3:
                actual_post_id = parts[-1]

        post = get_object_or_404(Post, id=actual_post_id)

        existing_like = PostLike.objects.filter(
            post_id=post.id,
            user_id=user.id,
            share_id__isnull=True,
        ).first()

        if existing_like:
            existing_like.delete()
            like_count = PostLike.objects.filter(
                post_id=post.id, share_id__isnull=True
            ).count()
            return _json_success(
                "Unliked post successfully",
                {
                    "liked": False,
                    "like_count": like_count,
                }
            )

        PostLike.objects.create(
            id=_generate_id("like"),
            post=post,
            user=user,
            share=None,
            created_at=timezone.now(),
        )

        like_count = PostLike.objects.filter(
            post_id=post.id, share_id__isnull=True
        ).count()

        _create_notification(
            recipient_id=post.user_id,
            actor_user_id=user.id,
            notification_type="like",
            title="New like",
            body=f"{getattr(user, 'username', user.id)} liked your post",
            reference_type="post",
            reference_id=post.id
        )

        return _json_success(
            "Liked post successfully",
            {
                "liked": True,
                "like_count": like_count,
            }
        )
    except Exception as e:
        import traceback
        print(f"❌ Error in toggle_like_post: {str(e)}")
        print(traceback.format_exc())
        return _json_error(f"Internal server error: {str(e)}", 500)


# Post Save / Unsave (toggle)
@csrf_exempt
@require_http_methods(["POST"])
def toggle_save_post(request, post_id):
    try:
        # Lấy body JSON từ request
        body = _parse_body(request)
        if body is None:
            body = {}

        # Lấy user hiện tại từ request hoặc body
        user = _get_current_user(request, body)
        if not user:
            return _json_error("Authentication required", 401)

        # Composite share id — DB không có UNIQUE theo share_id, save luôn cấp bài gốc (share_id NULL).
        actual_post_id = post_id
        if post_id.startswith('share_'):
            parts = post_id.split('_')
            if len(parts) >= 3:
                actual_post_id = parts[-1]

        post = get_object_or_404(Post, id=actual_post_id)

        collection_id = body.get("collection_id")

        existing_saved = SavedPost.objects.filter(
            post_id=post.id,
            user_id=user.id,
            share_id__isnull=True,
        ).first()

        if existing_saved:
            CollectionPost.objects.filter(
                post_id=post.id,
                collection__user_id=user.id
            ).delete()

            existing_saved.delete()

            return _json_success(
                "Unsaved post successfully",
                {
                    "saved": False,
                    **_post_counts(post.id, None)
                }
            )

        save_id = _generate_id("save")
        SavedPost.objects.create(
            id=save_id,
            post=post,
            user=user,
            share=None,
            created_at=timezone.now(),
        )

        # Nếu có collection_id, thêm post vào collection_items
        if collection_id:
            collection = Collection.objects.filter(id=collection_id, user_id=user.id).first()
            if not collection:
                return _json_error("Collection not found or you don't have access", 404)

            # Mỗi post chỉ nằm trong 1 bộ sưu tập của user
            CollectionPost.objects.filter(
                post_id=post.id,
                collection__user_id=user.id
            ).delete()

            CollectionPost.objects.create(
                id=_generate_id("colp"),
                collection=collection,
                post=post,
                added_at=timezone.now()
            )

        return _json_success(
            "Saved post successfully",
            {
                "saved": True,
                "collection_id": collection_id,
                **_post_counts(post.id, None)
            }
        )
    except Exception as e:
        import traceback
        print(f"❌ Error in toggle_save_post: {str(e)}")
        print(traceback.format_exc())
        return _json_error(f"Internal server error: {str(e)}", 500)


# Comment: list
@require_http_methods(["GET"])
def list_post_comments(request, post_id):
    # Nếu post_id là composite share ID (format: share_xxx_yyy), extract post ID và share ID
    actual_post_id = post_id
    share_id = None
    if post_id.startswith('share_'):
        parts = post_id.split('_')
        if len(parts) >= 3:
            share_id = parts[1]  # Lấy share ID từ composite ID
            actual_post_id = parts[-1]  # Lấy post ID từ composite ID
    
    post = get_object_or_404(Post, id=actual_post_id)

    user = _get_current_user(request)

    liked_comment_ids = set()
    if user:
        liked_comment_ids = set(
            CommentLike.objects.filter(user_id=user.id).values_list("comment_id", flat=True)
        )

    # Filter comments by share_id if it's a shared post
    comment_query = {'post_id': post.id, 'parent_comment_id__isnull': True}
    if share_id:
        comment_query['share_id'] = share_id
    else:
        comment_query['share_id__isnull'] = True
    
    top_level_comments = Comment.objects.filter(
        **comment_query
    ).select_related("user").order_by("-created_at")

    comments_data = [
        _comment_to_dict(
            comment,
            include_replies=True,
            liked_comment_ids=liked_comment_ids
        )
        for comment in top_level_comments
    ]

    counts = _post_counts(post.id, share_id)
    canonical_counts = _post_counts(post.id, None)
    if share_id:
        counts = {
            **counts,
            "like_count": canonical_counts["like_count"],
            "save_count": canonical_counts["save_count"],
            "share_count": canonical_counts.get(
                "share_count", counts.get("share_count", 0)
            ),
        }

    viewer_is_liked = False
    viewer_is_saved = False
    if user:
        viewer_is_liked = PostLike.objects.filter(
            user_id=user.id, post_id=post.id, share_id__isnull=True
        ).exists()
        viewer_is_saved = SavedPost.objects.filter(
            user_id=user.id, post_id=post.id, share_id__isnull=True
        ).exists()

    return _json_success(
        "Comments fetched successfully",
        {
            "post_id": post.id,
            "comments": comments_data,
            **counts,
            "is_liked": viewer_is_liked,
            "is_saved": viewer_is_saved,
        }
    )

# List commmentors
@require_http_methods(["GET"])
def list_post_commenters(request, post_id):
    actual_post_id = post_id
    share_id = None
    if post_id.startswith('share_'):
        parts = post_id.split('_')
        if len(parts) >= 3:
            share_id = parts[1]
            actual_post_id = parts[-1]

    post = get_object_or_404(Post, id=actual_post_id)

    comment_qs = Comment.objects.filter(post_id=post.id)
    if share_id:
        comment_qs = comment_qs.filter(share_id=share_id)
    else:
        comment_qs = comment_qs.filter(share_id__isnull=True)
    comments = comment_qs.select_related("user", "user__profile").order_by("-created_at")

    seen_user_ids = set()
    data = []

    for comment in comments:
        if comment.user_id in seen_user_ids:
            continue

        seen_user_ids.add(comment.user_id)

        item = {
            "user_id": comment.user_id,
            "comment_id": comment.id,
            "content": comment.content,
            "created_at": comment.created_at.isoformat() if comment.created_at else None,
        }

        if hasattr(comment.user, "username"):
            item["username"] = comment.user.username
        profile = getattr(comment.user, "profile", None)
        if profile is not None:
            dn = getattr(profile, "display_name", None) or ""
            if dn:
                item["display_name"] = dn

        data.append(item)

    return _json_success(
        "Post commenters fetched successfully",
        {
            "post_id": post.id,
            "commenters": data,
            **_post_counts(post.id, share_id),
        }
    )

# Tạo comment mới cho post 
@csrf_exempt
@require_http_methods(["POST"])
def create_comment(request, post_id):
    # Lấy body JSON từ request
    body = _parse_body(request)
    if body is None:
        return _json_error("Invalid JSON body", 400)

    # Lấy user hiện tại từ request hoặc body
    user = _get_current_user(request, body)
    if not user:
        return _json_error("Authentication required", 401)

    # Lấy content từ body
    content = (body.get("content") or "").strip()
    if not content:
        return _json_error("content is required", 400)

    # Nếu post_id là composite share ID (format: share_xxx_yyy), extract post ID và share ID
    actual_post_id = post_id
    share_id = None
    if post_id.startswith('share_'):
        parts = post_id.split('_')
        if len(parts) >= 3:
            share_id = parts[1]  # Lấy share ID từ composite ID
            actual_post_id = parts[-1]  # Lấy post ID từ composite ID

    # Kiểm tra post tồn tại
    post = get_object_or_404(Post, id=actual_post_id)
    
    # Kiểm tra share tồn tại nếu là shared post
    share = None
    if share_id:
        from apps.social.models import PostShare
        share = get_object_or_404(PostShare, id=share_id)

    # Tạo comment mới với parent_comment_id = null
    comment_data = {
        'id': _generate_id("cmt"),
        'post': post,
        'user': user,
        'parent_comment': None,
        'content': content,
        'created_at': timezone.now(),
        'updated_at': timezone.now()
    }
    if share:
        comment_data['share'] = share
    
    comment = Comment.objects.create(**comment_data)

    # Notify chủ post/share nếu người comment không phải chủ post/share
    notification_recipient = share.user_id if share else post.user_id
    _create_notification(
        recipient_id=notification_recipient,
        actor_user_id=user.id,
        notification_type="comment",
        title="New comment",
        body=f"{getattr(user, 'username', user.id)} commented on your post",
        reference_type="comment",
        reference_id=comment.id
    )

    comment = Comment.objects.filter(id=comment.id).select_related("user").first()

    return _json_success(
        "Comment created successfully",
        {
            "comment": _comment_to_dict(comment),
            **_post_counts(post.id, share.id if share else None)
        },
        status=201
    )

# Toggle like/unlike comment
@csrf_exempt
@require_http_methods(["POST"])
def toggle_comment_like(request, comment_id):
    body = _parse_body(request)
    if body is None:
        body = {}

    user = _get_current_user(request, body)
    if not user:
        return _json_error("Authentication required", 401)

    comment = get_object_or_404(Comment, id=comment_id)

    existing_like = CommentLike.objects.filter(
        comment_id=comment.id,
        user_id=user.id
    ).first()

    if existing_like:
        existing_like.delete()

        like_count = CommentLike.objects.filter(comment_id=comment.id).count()

        Comment.objects.filter(id=comment.id).update(like_count=like_count)

        return _json_success(
            "Unliked comment successfully",
            {
                "comment_id": comment.id,
                "liked": False,
                "like_count": like_count
            }
        )

    CommentLike.objects.create(
        id=_generate_id("clk"),
        comment_id=comment.id,
        user_id=user.id,
        created_at=timezone.now()
    )

    like_count = CommentLike.objects.filter(comment_id=comment.id).count()

    Comment.objects.filter(id=comment.id).update(like_count=like_count)

    _create_notification(
        recipient_id=comment.user_id,
        actor_user_id=user.id,
        notification_type="like",
        title="New comment like",
        body=f"{getattr(user, 'username', user.id)} liked your comment",
        reference_type="comment",
        reference_id=comment.id
    )

    return _json_success(
        "Liked comment successfully",
        {
            "comment_id": comment.id,
            "liked": True,
            "like_count": like_count
        }
    )

# Tạo reply cho comment
@csrf_exempt
@require_http_methods(["POST"])
def reply_comment(request, comment_id):
    body = _parse_body(request)
    if body is None:
        return _json_error("Invalid JSON body", 400)

    user = _get_current_user(request, body)
    if not user:
        return _json_error("Authentication required", 401)

    content = (body.get("content") or "").strip()
    if not content:
        return _json_error("content is required", 400)

    target_comment = get_object_or_404(Comment, id=comment_id)

    if target_comment.parent_comment and target_comment.parent_comment.parent_comment:
        reply_parent = target_comment.parent_comment
    else:
        reply_parent = target_comment

    reply = Comment.objects.create(
        id=_generate_id("cmt"),
        post_id=target_comment.post_id,
        user=user,
        parent_comment=reply_parent,
        content=content,
        created_at=timezone.now(),
        updated_at=timezone.now()
    )

    _create_notification(
        recipient_id=target_comment.user_id,
        actor_user_id=user.id,
        notification_type="comment",
        title="New reply",
        body=f"{getattr(user, 'username', user.id)} replied to your comment",
        reference_type="comment",
        reference_id=reply.id
    )

    post = reply.post
    if post.user_id not in [user.id, target_comment.user_id]:
        _create_notification(
            recipient_id=post.user_id,
            actor_user_id=user.id,
            notification_type="comment",
            title="New reply on your post",
            body=f"{getattr(user, 'username', user.id)} replied in your post",
            reference_type="comment",
            reference_id=reply.id
        )

    reply = Comment.objects.filter(id=reply.id).select_related("user").first()
    
    data = _comment_to_dict(reply, include_replies=True)
    data["reply_to_user_id"] = target_comment.user_id
    data["reply_to_username"] = getattr(target_comment.user, "username", target_comment.user_id)

    return _json_success(
        "Reply created successfully",
        {
            "comment": data,
            **_post_counts(target_comment.post_id)
        },
        status=201
    )

# Cập nhật comment (only ownwer)
@csrf_exempt
@require_http_methods(["PATCH"])
def update_comment(request, comment_id):
    # Lấy body JSON từ request
    body = _parse_body(request)
    if body is None:
        return _json_error("Invalid JSON body", 400)

    # Lấy user hiện tại từ request hoặc body
    user = _get_current_user(request, body)
    if not user:
        return _json_error("Authentication required", 401)

    # Kiểm tra comment tồn tại
    comment = get_object_or_404(Comment, id=comment_id)

    # Chỉ owner comment được sửa
    if comment.user_id != user.id:
        return _json_error("You can only edit your own comment", 403)

    # Lấy content mới từ body
    content = (body.get("content") or "").strip()
    if not content:
        return _json_error("content is required", 400)

    # Cập nhật content và updated_at
    comment.content = content
    comment.updated_at = timezone.now()
    comment.save()

    return _json_success(
        "Comment updated successfully",
        {
            "comment": _comment_to_dict(comment)
        }
    )

# Xóa comment (chỉ owner comment hoặc owner post mới được xóa)
@csrf_exempt
@require_http_methods(["DELETE"])
def delete_comment(request, comment_id):
    # Lấy body JSON từ request 
    body = _parse_body(request)
    if body is None:
        body = {}

    # Lấy user hiện tại từ request hoặc body
    user = _get_current_user(request, body)
    if not user:
        return _json_error("Authentication required", 401)

    # Kiểm tra comment tồn tại
    comment = get_object_or_404(Comment, id=comment_id)

    # Kiểm tra quyền xóa
    is_comment_owner = (comment.user_id == user.id)
    is_post_owner = (comment.post.user_id == user.id)

    # Chỉ owner comment hoặc owner post mới được xóa comment
    if not (is_comment_owner or is_post_owner):
        return _json_error("You do not have permission to delete this comment", 403)

    # Lưu lại post_id trước khi xóa để trả về counts sau khi xóa
    comment_id_value = comment.id
    post_id_value = comment.post_id
    
    # Xóa comment
    comment.delete()

    return _json_success(
        "Comment deleted successfully",
        {
            "comment_id": comment_id_value,
            "post_id": post_id_value,
            **_post_counts(post_id_value)
        }
    )


# Lấy danh sách user đã like post
@require_http_methods(["GET"])
def list_post_likers(request, post_id):
    # Composite share_xxx_yyy → like trên đúng instance chia sẻ; ngược lại chỉ like bài gốc (share_id NULL).
    actual_post_id = post_id
    share_id = None
    if post_id.startswith('share_'):
        parts = post_id.split('_')
        if len(parts) >= 3:
            share_id = parts[1]
            actual_post_id = parts[-1]

    post = get_object_or_404(Post, id=actual_post_id)

    like_qs = PostLike.objects.filter(post_id=post.id)
    if share_id:
        like_qs = like_qs.filter(share_id=share_id)
    else:
        like_qs = like_qs.filter(share_id__isnull=True)
    likes = like_qs.select_related("user", "user__profile").order_by("-created_at")

    data = []
    for like in likes:
        item = {
            "user_id": like.user_id,
        }
        if hasattr(like.user, "username"):
            item["username"] = like.user.username
        profile = getattr(like.user, "profile", None)
        if profile is not None:
            dn = getattr(profile, "display_name", None) or ""
            if dn:
                item["display_name"] = dn
        data.append(item)

    return _json_success(
        "Post likers fetched successfully",
        {
            "post_id": post.id,
            "likers": data,
            **_post_counts(post.id, share_id),
        }
    )


@csrf_exempt
@require_http_methods(["GET"])
def get_following_list(request):
    current_user = _get_current_user(request)
    if not current_user:
        return _json_error("Authentication required", 401)

    target_user_id = request.GET.get("user_id") or current_user.id

    follows = Follow.objects.filter(
        follower_id=target_user_id
    ).select_related("following", "following__profile")

    following = []
    for f in follows:
        following_user = f.following
        profile = getattr(following_user, "profile", None)

        following.append({
            "id": f.following_id,
            "username": getattr(following_user, "username", ""),
            "display_name": profile.display_name if profile else getattr(following_user, "username", ""),
            "avatar_url": profile.avatar_url if profile else None,
        })

    return _json_success(
        "Following list retrieved successfully",
        {"following": following}
    )

# Follow / Unfollow user (toggle)
@csrf_exempt
@require_http_methods(["POST"])
def toggle_follow_user(request, target_user_id):
    # Lấy body JSON từ request
    body = _parse_body(request)
    if body is None:
        body = {}

    # Lấy user hiện tại từ request hoặc body
    user = _get_current_user(request, body)
    if not user:
        return _json_error("Authentication required", 401)

    # Không cho follow chính mình
    if user.id == target_user_id:
        return _json_error("You cannot follow yourself", 400)

    # Kiểm tra target user tồn tại
    target_user = get_object_or_404(User, id=target_user_id)

    # Kiểm tra đã follow chưa
    existing_follow = Follow.objects.filter(
        follower_id=user.id,
        following_id=target_user.id
    ).first()

    # Nếu đã follow thì unfollow
    if existing_follow:
        existing_follow.delete()
        return _json_success(
            "Unfollowed user successfully",
            {
                "followed": False,
                "follower_id": user.id,
                "following_id": target_user.id,
            }
        )

    # Nếu chưa follow thì tạo mới
    Follow.objects.create(
        id=_generate_id("fol"),
        follower_id=user.id,
        following_id=target_user.id,
        created_at=timezone.now()
    )

    # Tạo notification cho người được follow
    _create_notification(
        recipient_id=target_user.id,
        actor_user_id=user.id,
        notification_type="follow",
        title="New follower",
        body=f"{getattr(user, 'username', user.id)} started following you",
        reference_type="user",
        reference_id=user.id
    )

    return _json_success(
        "Followed user successfully",
        {
            "followed": True,
            "follower_id": user.id,
            "following_id": target_user.id,
        }
    )

# Notifications
@require_http_methods(["GET"])
def list_notifications(request):
    # Lấy user hiện tại từ request hoặc body
    user = _get_current_user(request)
    if not user:
        return _json_error("Authentication required", 401)

    # Lấy tất cả notification của user, kèm actor_user info, sắp xếp mới nhất trước
    notifications = Notification.objects.filter(user_id=user.id).select_related("actor_user").order_by("-created_at")

    return _json_success(
        "Notifications fetched successfully",
        {
            "notifications": [_notification_to_dict(notification) for notification in notifications],
            "unread_count": notifications.filter(is_read=False).count()
        }
    )

# Đánh dấu tất cả notification của user là đã đọc
@csrf_exempt
@require_http_methods(["PATCH"])
def mark_all_notifications_as_read(request):
    # Lấy user hiện tại từ request hoặc body
    user = _get_current_user(request, _parse_body(request) or {})
    if not user:
        return _json_error("Authentication required", 401)

    # Đánh dấu tất cả notification của user là đã đọc
    Notification.objects.filter(user_id=user.id, is_read=False).update(is_read=True)

    return _json_success("All notifications marked as read")

# Share post
@csrf_exempt
@require_http_methods(["POST"])
def share_post(request, post_id):
    try:
        # Lấy body JSON từ request
        body = _parse_body(request)
        if body is None:
            return _json_error("Invalid JSON body", 400)

        # Lấy user hiện tại từ request hoặc body
        user = _get_current_user(request, body)
        if not user:
            return _json_error("Authentication required", 401)

        # Nếu post_id là composite share ID (format: share_<shareId>_<postId>),
        # extract cả post_id (bài gốc) và share_id (bài share đang được share lại).
        actual_post_id = post_id
        shared_from_share_id = None
        if post_id.startswith('share_'):
            parts = post_id.split('_')
            if len(parts) >= 3:
                actual_post_id = parts[-1]  # Lấy post ID từ composite ID
                shared_from_share_id = parts[1]

        # Kiểm tra post tồn tại
        post = get_object_or_404(Post, id=actual_post_id)

        # User can share a post multiple times, so we don't check for existing shares.

        share_type = (body.get("share_type") or "personal").strip()

        if share_type != "personal":
            return _json_error("Only 'personal' share type is supported", 400)

        caption = body.get("caption")
        if caption:
            caption = caption.strip()

        # Tạo record share mới (chỉ cho personal shares).
        # Nếu DB chưa có cột `shared_from_share_id`, dùng INSERT thủ công để tránh 500.
        share_id = _generate_id("shr")
        share_created_at = timezone.now()
        share_type = "personal"
        can_store_origin = bool(shared_from_share_id) and _post_shares_has_shared_from_share_id_column()

        if can_store_origin:
            share = PostShare.objects.create(
                id=share_id,
                post=post,
                user=user,
                share_type=share_type,
                caption=caption,
                created_at=share_created_at,
                shared_from_share_id=shared_from_share_id,
            )
        else:
            # Fallback insert: chỉ dùng các cột chắc chắn tồn tại.
            # (id, post_id, user_id, share_type, caption, created_at)
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO post_shares (id, post_id, user_id, share_type, caption, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    [
                        share_id,
                        post.id,
                        user.id,
                        share_type,
                        caption,
                        share_created_at,
                    ],
                )
            share = None

        # Thông báo: share bài gốc -> notify chủ post; re-share bài share -> notify người đã share trước đó (nếu tìm thấy).
        notification_title = "Your post was shared"
        notification_body = f"{getattr(user, 'username', user.id)} shared your post to their profile"
        notification_recipient_id = post.user_id
        notification_reference_type = "post"
        notification_reference_id = post.id

        if shared_from_share_id:
            try:
                prev_share = post_share_qs().filter(id=shared_from_share_id).first()
            except Exception:
                prev_share = None
            if prev_share is not None and getattr(prev_share, "user_id", None):
                notification_title = "Your shared post was re-shared"
                notification_body = f"{getattr(user, 'username', user.id)} re-shared your shared post"
                notification_recipient_id = prev_share.user_id
                notification_reference_type = "share"
                notification_reference_id = prev_share.id

        _create_notification(
            recipient_id=notification_recipient_id,
            actor_user_id=user.id,
            notification_type="new_post",  
            title=notification_title,
            body=notification_body,
            reference_type=notification_reference_type,
            reference_id=notification_reference_id
        )

        return _json_success(
            "Post shared successfully",
            {
                "share": {
                    "id": share_id,
                    "post_id": post.id,
                    "user_id": user.id,
                    "share_type": share_type,
                    "caption": caption,
                    "created_at": share_created_at.isoformat() if share_created_at else None,
                },
                # Trả counts theo đúng đối tượng user vừa share (bài gốc hoặc bài share được share lại)
                **(_post_counts(post.id, shared_from_share_id) if shared_from_share_id else _post_counts(post.id))
            },
            status=201
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Share post error: {str(e)}")
        return _json_error(f"Server error: {str(e)}", 500)

# Xóa share post
@csrf_exempt
@require_http_methods(["DELETE"])
def delete_shared_post(request, post_id):
    # Lấy body JSON từ request
    body = _parse_body(request)
    if body is None:
        body = {}

    # Lấy user hiện tại từ request hoặc body
    user = _get_current_user(request, body)
    if not user:
        return _json_error("Authentication required", 401)

    # Kiểm tra post tồn tại
    post = get_object_or_404(Post, id=post_id)

    # Kiểm tra xem user đã share post này chưa
    existing_share = post_share_qs().filter(
        post_id=post.id,
        user_id=user.id
    ).first()

    # Nếu chưa share thì trả về lỗi
    if not existing_share:
        return _json_error("Shared post not found", 404)

    # Xóa record share
    existing_share.delete()

    return _json_success(
        "Unshared post successfully",
        {
            "shared": False,
            "post_id": post.id,
            "user_id": user.id,
            **_post_counts(post.id)
        }
    )


@csrf_exempt
@require_http_methods(["PATCH"])
def update_share_caption(request, post_id):
    """
    Cập nhật mô tả (caption) của lần chia sẻ cá nhân — không sửa bài gốc.
    `post_id` là id dòng composite: share_<shareId>_<origPostId>.
    """
    body = _parse_body(request)
    if body is None:
        body = {}

    user = _get_current_user(request, body)
    if not user:
        return _json_error("Authentication required", 401)

    share_id = None
    if isinstance(post_id, str) and post_id.startswith("share_"):
        # Định dạng: share_<shareId>_<origPostId> — shareId/postId có thể chứa "_"
        rest = post_id[len("share_") :]
        last_us = rest.rfind("_")
        if last_us > 0:
            share_id = rest[:last_us]

    if not share_id:
        return _json_error("Chỉ áp dụng cho bài chia sẻ (id dạng share_...)", 400)

    share = post_share_qs().filter(id=share_id, user_id=user.id).first()
    if not share:
        return _json_error("Không tìm thấy bài chia sẻ", 404)

    raw_cap = body.get("caption")
    if raw_cap is None:
        caption = ""
    else:
        caption = str(raw_cap).strip()

    if len(caption) > 500:
        return _json_error("Mô tả tối đa 500 ký tự", 400)

    try:
        post_share_qs().filter(id=share_id, user_id=user.id).update(
            caption=caption or None
        )
    except Exception as e:
        return _json_error(f"Không cập nhật được: {str(e)}", 500)

    return _json_success(
        "Đã cập nhật mô tả chia sẻ",
        {"share_id": share_id, "caption": caption},
    )


# Hide post from profile (không ảnh hưởng đến Feed)
@csrf_exempt
@require_http_methods(["POST"])
def hide_post_from_profile(request, post_id):
    """Hide a post from user's profile view (doesn't affect Feed)"""
    body = _parse_body(request)
    if body is None:
        body = {}

    user = _get_current_user(request, body)
    if not user:
        return _json_error("Authentication required", 401)

    # Nếu post_id là composite share ID (format: share_xxx_yyy), extract post ID
    actual_post_id = post_id
    if post_id.startswith('share_'):
        parts = post_id.split('_')
        if len(parts) >= 3:
            actual_post_id = parts[-1]

    post = get_object_or_404(Post, id=actual_post_id)

    # Tạo hoặc lấy HiddenPost record
    hidden_post, created = HiddenPost.objects.get_or_create(
        post_id=post.id,
        user_id=user.id,
        defaults={
            'id': _generate_id("hide"),
            'created_at': timezone.now()
        }
    )

    return _json_success(
        "Post hidden from profile successfully",
        {
            "post_id": post.id,
            "hidden": True
        }
    )

# List share post 
@require_http_methods(["GET"])
def list_post_sharers(request, post_id):
    post_id_str = str(post_id or "").strip()
    actual_post_id = post_id_str
    parent_share_id = None
    if post_id_str.startswith("share_"):
        parts = post_id_str.split("_")
        if len(parts) >= 3:
            parent_share_id = parts[1]
            actual_post_id = parts[-1]

    try:
        post = get_object_or_404(Post, id=actual_post_id)

        if parent_share_id:
            shares = (
                post_share_qs()
                .filter(
                    shared_from_share_id=parent_share_id,
                    share_type="personal",
                )
                .select_related("user", "user__profile")
                .order_by("-created_at")
            )
        else:
            qs = post_share_qs().filter(post_id=post.id, share_type="personal")
            if post_shares_has_shared_from_share_id_column():
                qs = qs.filter(shared_from_share_id__isnull=True)
            shares = qs.select_related("user", "user__profile").order_by("-created_at")

        data = []
        for share in shares:
            user = getattr(share, "user", None)
            if user is None:
                continue
            item = {
                "share_id": share.id,
                "user_id": share.user_id,
                "share_type": share.share_type,
                "created_at": share.created_at.isoformat() if share.created_at else None,
            }
            if hasattr(user, "username"):
                item["username"] = user.username
            profile = getattr(user, "profile", None)
            if profile is not None:
                dn = getattr(profile, "display_name", None) or ""
                if dn:
                    item["display_name"] = dn
            data.append(item)

        extra_counts = {}
        try:
            extra_counts = (
                _post_counts(post.id, parent_share_id)
                if parent_share_id
                else _post_counts(post.id)
            )
        except Exception as exc:
            import logging
            logging.getLogger(__name__).warning(
                "list_post_sharers: _post_counts failed for post_id=%s: %s",
                post.id,
                exc,
            )
            extra_counts = {
                "like_count": 0,
                "comment_count": 0,
                "save_count": 0,
                "share_count": 0,
            }

        return _json_success(
            "Post sharers fetched successfully",
            {
                "post_id": post.id,
                "sharers": data,
                **extra_counts,
            },
        )
    except Http404:
        raise
    except Exception as exc:
        import logging
        logging.getLogger(__name__).exception("list_post_sharers failed: post_id=%s", post_id)
        return _json_error(f"Failed to load sharers: {exc}", 500)

# Lấy danh sách bài viết đã lưu của user hiện tại
@require_http_methods(["GET"])
def get_saved_posts(request):
    try:
        user = _get_current_user(request)

        if not user:
            return _json_error("Authentication required", 401)

        saved_posts = (
            SavedPost.objects
            .filter(user_id=user.id)
            .exclude(post__status="archived")
            .select_related(
                "post",
                "post__user",
                "post__user__profile",
            )
            .order_by("-created_at")
        )

        try:
            hidden_post_ids = set(
                HiddenPost.objects.filter(
                    user_id=user.id
                ).values_list("post_id", flat=True)
            )
        except Exception as e:
            print(f"⚠️ Hidden posts query issue in saved posts: {str(e)}")
            hidden_post_ids = set()

        saved_posts = [
            sp for sp in saved_posts
            if sp.post_id not in hidden_post_ids
        ]

        post_ids = [sp.post_id for sp in saved_posts]

        playback_map = {
            item.post_id: item
            for item in PlaybackHistory.objects.filter(
                user_id=user.id,
                post_id__in=post_ids
            )
        }

        note_post_ids = set(
            PostNote.objects.filter(
                user_id=user.id,
                post_id__in=post_ids
            ).values_list("post_id", flat=True)
        )

        liked_post_ids = set(
            PostLike.objects.filter(
                user_id=user.id,
                post_id__in=post_ids,
                share_id__isnull=True,
            ).values_list("post_id", flat=True)
        )

        tags_map = {}

        for post_id, tag_name in (
            PostTag.objects
            .filter(post_id__in=post_ids)
            .select_related("tag")
            .values_list("post_id", "tag__name")
        ):
            tags_map.setdefault(post_id, []).append(tag_name)

        posts_data = []

        for saved_post in saved_posts:
            post = saved_post.post

            playback_history = playback_map.get(post.id)

            try:
                counts = _post_counts(post.id)
            except Exception as e:
                print(f"⚠️ Count issue in saved posts: {str(e)}")

                counts = {
                    "like_count": 0,
                    "comment_count": 0,
                    "save_count": 0,
                    "share_count": 0,
                }

            item = {
                "id": post.id,
                "title": post.title,
                "description": post.description,
                "audio_url": post.audio_url,
                "thumbnail_url": post.thumbnail_url,
                "duration_seconds": post.duration_seconds,
                "listen_count": post.listen_count,
                "like_count": counts["like_count"],
                "comment_count": counts["comment_count"],
                "save_count": counts["save_count"],
                "share_count": counts["share_count"],
                "user_id": post.user_id,
                "tags": tags_map.get(post.id, []),
                "created_at": (
                    post.created_at.isoformat()
                    if post.created_at else None
                ),
                "saved_at": (
                    saved_post.created_at.isoformat()
                    if saved_post.created_at else None
                ),
                "has_note": post.id in note_post_ids,
                "is_liked": post.id in liked_post_ids,
                "playback_history": {
                    "completed_ratio": playback_history.completed_ratio,
                } if playback_history else None,
            }

            if post.user:
                profile = getattr(post.user, "profile", None)

                item["author"] = {
                    "id": str(post.user.id),
                    "username": getattr(post.user, "username", ""),
                    "name": (
                        profile.display_name
                        if profile and profile.display_name
                        else getattr(post.user, "username", "")
                    ),
                    "avatar_url": (
                        profile.avatar_url
                        if profile and profile.avatar_url
                        else None
                    ),
                }

                item["author_username"] = getattr(
                    post.user,
                    "username",
                    ""
                )

            posts_data.append(item)

        return _json_success(
            "Saved posts fetched successfully",
            {
                "saved_posts": posts_data,
                "total_count": len(posts_data),
            }
        )

    except Exception as e:
        import traceback

        print(f"❌ get_saved_posts error: {str(e)}")
        print(traceback.format_exc())

        return _json_error(
            f"Error fetching saved posts: {str(e)}",
            500
        )

@csrf_exempt
@require_http_methods(["POST"])
def track_listen(request, post_id):
    body = _parse_body(request) or {}
    user = _get_current_user(request, body)

    if not user:
        return _json_error("Authentication required", 401)

    post = get_object_or_404(Post, id=post_id)

    progress = int(body.get("progress_seconds", 0) or 0)
    duration = int(body.get("duration_seconds", 0) or 0)

    if duration <= 0:
        return _json_error("Invalid duration", 400)

    progress = max(0, min(progress, duration))
    completed_ratio = progress / duration

    history, created = PlaybackHistory.objects.get_or_create(
        user_id=user.id,
        post_id=post.id,
        defaults={
            "id": _generate_id("ph"),
            "progress_seconds": progress,
            "duration_seconds": duration,
            "completed_ratio": completed_ratio,
            "is_completed": completed_ratio >= 0.9,
            "last_played_at": timezone.now(),
        }
    )

    should_increase_listen = False

    if created:
        should_increase_listen = completed_ratio >= 0.5
    else:
        old_completed_ratio = float(history.completed_ratio or 0)

        current_progress = progress
        new_completed_ratio = current_progress / duration

        history.progress_seconds = current_progress
        history.duration_seconds = duration
        history.completed_ratio = new_completed_ratio
        history.is_completed = new_completed_ratio >= 0.9
        history.last_played_at = timezone.now()
        history.save()

        should_increase_listen = (
            old_completed_ratio < 0.5 and new_completed_ratio >= 0.5
        )

    if should_increase_listen:
        Post.objects.filter(id=post.id).update(
            listen_count=F("listen_count") + 1
        )

    post.refresh_from_db(fields=["listen_count"])

    return _json_success(
        "Tracked listen",
        {
            "post_id": post.id,
            "listen_count": post.listen_count,
            "progress_seconds": history.progress_seconds,
            "duration_seconds": history.duration_seconds,
            "completed_ratio": float(history.completed_ratio),
            "is_completed": history.is_completed,
        }
    )

@require_http_methods(["GET"])
def get_friends_list(request):
    current_user = _get_current_user(request)
    if not current_user:
        return _json_error("Authentication required", 401)

    target_user_id = request.GET.get("user_id") or current_user.id

    following_ids = Follow.objects.filter(
        follower_id=target_user_id
    ).values_list("following_id", flat=True)

    follower_ids = Follow.objects.filter(
        following_id=target_user_id
    ).values_list("follower_id", flat=True)

    # mutual = giao nhau
    friend_ids = set(following_ids).intersection(set(follower_ids))

    friends = (
        User.objects
        .filter(id__in=friend_ids)
        .exclude(id=target_user_id)
        .select_related("profile")
    )

    data = []
    for u in friends:
        profile = getattr(u, "profile", None)

        data.append({
            "id": u.id,
            "username": getattr(u, "username", ""),
            "display_name": (
                profile.display_name
                if profile and profile.display_name
                else getattr(u, "username", "")
            ),
            "avatar_url": (
                profile.avatar_url
                if profile and profile.avatar_url
                else None
            ),
        })

    return _json_success("Friends list", {"friends": data})


@csrf_exempt
def handle_note(request, post_id):
    """Handle GET and POST requests for notes"""
    if request.method == "GET":
        return get_note(request, post_id)
    elif request.method == "POST":
        return save_note(request, post_id)
    else:
        return _json_error("Method not allowed", 405)


@require_http_methods(["POST"])
@csrf_exempt
def save_note(request, post_id):
    """Save or update a note for a post by the current user"""
    body = _parse_body(request) or {}
    user = _get_current_user(request, body)

    if not user:
        return _json_error("Authentication required", 401)

    post = get_object_or_404(Post, id=post_id)
    content = body.get("content", "").strip()

    # Get or create note
    note, created = PostNote.objects.get_or_create(
        post_id=post.id,
        user_id=user.id,
        defaults={
            "id": _generate_id("note"),
            "content": content,
            "created_at": timezone.now(),
            "updated_at": timezone.now(),
        }
    )

    if not created:
        # Update existing note
        note.content = content
        note.updated_at = timezone.now()
        note.save()

    return _json_success(
        "Note saved successfully",
        {
            "post_id": post.id,
            "note_content": note.content,
            "created_at": note.created_at,
            "updated_at": note.updated_at,
        }
    )


@require_http_methods(["GET"])
@csrf_exempt
def get_note(request, post_id):
    """Get the note for a post by the current user"""
    user = _get_current_user(request)

    if not user:
        return _json_error("Authentication required", 401)

    post = get_object_or_404(Post, id=post_id)

    note = PostNote.objects.filter(
        post_id=post.id,
        user_id=user.id
    ).first()

    if not note:
        return _json_success(
            "No note found for this post",
            {
                "post_id": post.id,
                "has_note": False,
                "note_content": None,
            }
        )

    return _json_success(
        "Note retrieved successfully",
        {
            "post_id": post.id,
            "has_note": True,
            "note_content": note.content,
            "created_at": note.created_at,
            "updated_at": note.updated_at,
        }
    )

@csrf_exempt
@require_http_methods(["POST"])
def hide_post(request, post_id):
    body = _parse_body(request) or {}
    user = _get_current_user(request, body)

    if not user:
        return _json_error("Authentication required", 401)

    post = get_object_or_404(Post, id=post_id)

    hidden, created = HiddenPost.objects.get_or_create(
        user=user,
        post=post,
        defaults={
            "id": _generate_id("hid"),
            "created_at": timezone.now(),
        }
    )

    return _json_success("Post hidden successfully", {
        "post_id": post.id,
        "user_id": user.id,
        "hidden": True,
    })


@csrf_exempt
@require_http_methods(["GET"])
def list_collections(request):
    user = _get_current_user(request)
    if not user:
        return _json_error("Authentication required", 401)

    try:
        hidden_post_ids = HiddenPost.objects.filter(
            user_id=user.id
        ).values_list("post_id", flat=True)

        collections = Collection.objects.filter(
            user_id=user.id
        ).order_by("-created_at")

        data = []

        for collection in collections:
            post_count = CollectionPost.objects.filter(
                collection_id=collection.id
            ).exclude(
                post__status="archived"
            ).exclude(
                post_id__in=hidden_post_ids
            ).count()

            data.append({
                "id": collection.id,
                "name": collection.name,
                "description": collection.description or "",
                "is_default": collection.is_default,
                "post_count": post_count,
                "created_at": collection.created_at.isoformat() if collection.created_at else None,
            })

        return _json_success(
            "Collections fetched successfully",
            {"collections": data}
        )

    except Exception as e:
        import traceback
        print(f"❌ Error in list_collections: {str(e)}")
        print(traceback.format_exc())
        return _json_error(f"Error fetching collections: {str(e)}", 500)


@csrf_exempt
@require_http_methods(["POST"])
def create_collection(request):
    body = _parse_body(request)
    if body is None:
        return _json_error("Invalid JSON body", 400)

    user = _get_current_user(request, body)
    if not user:
        return _json_error("Authentication required", 401)

    name = (body.get("name") or "").strip()
    if not name:
        return _json_error("Collection name is required", 400)

    description = body.get("description", "").strip()

    existing = Collection.objects.filter(user_id=user.id, name=name).first()
    if existing:
        return _json_error("Collection with this name already exists", 400)

    collection = Collection.objects.create(
        id=_generate_id("col"),
        user=user,
        name=name,
        description=description,
        is_default=False,
        created_at=timezone.now()
    )

    return _json_success(
        "Collection created successfully",
        {
            "collection": {
                "id": collection.id,
                "name": collection.name,
                "description": collection.description,
                "is_default": collection.is_default,
                "post_count": 0,
                "created_at": collection.created_at.isoformat(),
            }
        },
        status=201
    )


@csrf_exempt
@require_http_methods(["PATCH"])
def update_collection(request, collection_id):
    body = _parse_body(request)
    if body is None:
        return _json_error("Invalid JSON body", 400)

    user = _get_current_user(request, body)
    if not user:
        return _json_error("Authentication required", 401)

    collection = get_object_or_404(Collection, id=collection_id)

    if collection.user_id != user.id:
        return _json_error("You can only edit your own collections", 403)

    name = body.get("name", "").strip()
    if name:
        existing = Collection.objects.filter(user_id=user.id, name=name).exclude(id=collection.id).first()
        if existing:
            return _json_error("Collection with this name already exists", 400)
        collection.name = name

    description = body.get("description")
    if description is not None:
        collection.description = description.strip()

    collection.save()

    return _json_success(
        "Collection updated successfully",
        {
            "collection": {
                "id": collection.id,
                "name": collection.name,
                "description": collection.description,
                "is_default": collection.is_default,
                "post_count": collection.posts.count(),
                "created_at": collection.created_at.isoformat() if collection.created_at else None,
            }
        }
    )


@csrf_exempt
@require_http_methods(["GET"])
def get_collection_posts(request, collection_id):
    try:
        user = _get_current_user(request)

        if not user:
            return _json_error("Authentication required", 401)

        collection = get_object_or_404(
            Collection,
            id=collection_id
        )

        if collection.user_id != user.id:
            return _json_error(
                "You don't have access to this collection",
                403
            )

        collection_posts = (
            CollectionPost.objects
            .filter(collection_id=collection.id)
            .exclude(post__status="archived")
            .select_related(
                "post",
                "post__user",
                "post__user__profile",
            )
            .order_by("-added_at")
        )

        hidden_post_ids = set(
            HiddenPost.objects.filter(
                user_id=user.id
            ).values_list("post_id", flat=True)
        )

        collection_posts = [
            cp for cp in collection_posts
            if cp.post_id not in hidden_post_ids
        ]

        post_ids = [cp.post_id for cp in collection_posts]

        playback_map = {
            item.post_id: item
            for item in PlaybackHistory.objects.filter(
                user_id=user.id,
                post_id__in=post_ids
            )
        }

        note_post_ids = set(
            PostNote.objects.filter(
                user_id=user.id,
                post_id__in=post_ids
            ).values_list("post_id", flat=True)
        )

        liked_post_ids = set(
            PostLike.objects.filter(
                user_id=user.id,
                post_id__in=post_ids,
                share_id__isnull=True,
            ).values_list("post_id", flat=True)
        )

        tags_map = {}

        for post_id, tag_name in (
            PostTag.objects
            .filter(post_id__in=post_ids)
            .select_related("tag")
            .values_list("post_id", "tag__name")
        ):
            tags_map.setdefault(post_id, []).append(tag_name)

        data = []

        for cp in collection_posts:
            post = cp.post

            playback_history = playback_map.get(post.id)

            try:
                counts = _post_counts(post.id)
            except Exception:
                counts = {
                    "like_count": 0,
                    "comment_count": 0,
                    "save_count": 0,
                    "share_count": 0,
                }

            item = {
                "id": post.id,
                "title": post.title,
                "description": post.description,
                "audio_url": post.audio_url,
                "thumbnail_url": post.thumbnail_url,
                "duration_seconds": post.duration_seconds,
                "listen_count": post.listen_count,
                "like_count": counts["like_count"],
                "comment_count": counts["comment_count"],
                "save_count": counts["save_count"],
                "share_count": counts["share_count"],
                "user_id": post.user_id,
                "tags": tags_map.get(post.id, []),
                "created_at": (
                    post.created_at.isoformat()
                    if post.created_at else None
                ),
                "has_note": post.id in note_post_ids,
                "is_liked": post.id in liked_post_ids,
                "playback_history": {
                    "completed_ratio": playback_history.completed_ratio,
                } if playback_history else None,
            }

            if post.user:
                profile = getattr(post.user, "profile", None)

                item["author"] = {
                    "id": str(post.user.id),
                    "username": getattr(post.user, "username", ""),
                    "name": (
                        profile.display_name
                        if profile and profile.display_name
                        else getattr(post.user, "username", "")
                    ),
                    "avatar_url": (
                        profile.avatar_url
                        if profile and profile.avatar_url
                        else None
                    ),
                }

                item["author_username"] = getattr(
                    post.user,
                    "username",
                    ""
                )

            else:
                item["author"] = None
                item["author_username"] = ""

            item["is_owner"] = post.user_id == user.id

            data.append(item)

        return _json_success(
            "Collection posts fetched successfully",
            {"posts": data}
        )

    except Exception as e:
        import traceback

        print(f"❌ Error in get_collection_posts: {str(e)}")
        print(traceback.format_exc())

        return _json_error(
            f"Error fetching collection posts: {str(e)}",
            500
        )


@csrf_exempt
@require_http_methods(["DELETE"])
def delete_collection(request, collection_id):
    body = _parse_body(request)
    if body is None:
        body = {}

    user = _get_current_user(request, body)
    if not user:
        return _json_error("Authentication required", 401)

    collection = get_object_or_404(Collection, id=collection_id)

    if collection.user_id != user.id:
        return _json_error("You can only delete your own collections", 403)

    collection_id_value = collection.id
    collection.delete()

    return _json_success(
        "Collection deleted successfully",
        {"collection_id": collection_id_value}
    )


@csrf_exempt
@require_http_methods(["POST"])
def add_post_to_collection(request, post_id, collection_id):
    body = _parse_body(request)
    if body is None:
        body = {}

    user = _get_current_user(request, body)
    if not user:
        return _json_error("Authentication required", 401)

    post = get_object_or_404(Post, id=post_id)
    collection = get_object_or_404(Collection, id=collection_id)

    if collection.user_id != user.id:
        return _json_error("You can only add posts to your own collections", 403)

    existing = CollectionPost.objects.filter(collection_id=collection.id, post_id=post.id).first()
    if existing:
        return _json_success("Post already in collection", {"collection_post_id": existing.id})

    collection_post = CollectionPost.objects.create(
        id=_generate_id("colp"),
        collection=collection,
        post=post,
        added_at=timezone.now()
    )

    return _json_success(
        "Post added to collection successfully",
        {
            "collection_post_id": collection_post.id,
            "collection_id": collection.id,
            "post_id": post.id,
        },
        status=201
    )


@csrf_exempt
@require_http_methods(["DELETE"])
def remove_post_from_collection(request, post_id, collection_id):
    body = _parse_body(request)
    if body is None:
        body = {}

    user = _get_current_user(request, body)
    if not user:
        return _json_error("Authentication required", 401)

    collection = get_object_or_404(Collection, id=collection_id)

    if collection.user_id != user.id:
        return _json_error("You can only remove posts from your own collections", 403)

    collection_post = CollectionPost.objects.filter(
        collection_id=collection.id,
        post_id=post_id
    ).first()

    if not collection_post:
        return _json_error("Post not found in collection", 404)

    collection_post.delete()

    return _json_success(
        "Post removed from collection successfully",
        {"collection_id": collection.id, "post_id": post_id}
    )


@csrf_exempt
@require_http_methods(["POST"])
def share_post_to_user(request, post_id):
    """
    Share a post with one or more users via direct message
    POST /api/social/posts/{post_id}/share-to-user/
    
    Body:
    {
        "target_user_id": "user_id",  # Single user ID
        "caption": "Optional message"  # Optional caption/message
    }
    
    Or for multiple users:
    {
        "target_user_ids": ["user_id1", "user_id2"],
        "caption": "Optional message"
    }
    """
    try:
        body = _parse_body(request)
        if body is None:
            return _json_error("Invalid JSON body", 400)

        user = _get_current_user(request, body)
        if not user:
            return _json_error("Authentication required", 401)

        post_id_str = str(post_id or "").strip()
        resolved_post_id = post_id_str
        if post_id_str.startswith("share_"):
            parts = post_id_str.split("_")
            if len(parts) >= 3:
                resolved_post_id = parts[-1]

        post = get_object_or_404(Post, id=resolved_post_id)

        target_user_id = body.get("target_user_id")
        target_user_ids = body.get("target_user_ids") or []

        if target_user_id is not None and target_user_id != "":
            target_user_ids = [target_user_id]

        if isinstance(target_user_ids, (str, int)):
            target_user_ids = [target_user_ids]

        target_user_ids = [str(target_id).strip() for target_id in target_user_ids if str(target_id).strip()]

        if not target_user_ids:
            return _json_error("target_user_id or target_user_ids is required", 400)

        caption = body.get("caption", "").strip() or None

        results = []
        channel_layer = get_channel_layer()
        candidate_users = User.objects.filter(
            Q(id__in=target_user_ids) | Q(username__in=target_user_ids)
        )

        target_users = {}
        for target in candidate_users:
            target_users[str(target.id)] = target
            target_users[str(getattr(target, "username", ""))] = target
        
        for target_id in target_user_ids:
            try:
                target_user = target_users.get(str(target_id))

                if not target_user:
                    results.append({
                        "target_user_id": target_id,
                        "success": False,
                        "error": "Target user not found"
                    })
                    continue
                
                if str(target_user.id) == str(user.id):
                    results.append({
                        "target_user_id": target_id,
                        "success": False,
                        "error": "Cannot share with yourself"
                    })
                    continue

                room = get_or_create_direct_room(user, target_user)

                profile = getattr(post.user, "profile", None)

                message_content = json.dumps({
                    "type": "podcast",
                    "post_id": post.id,
                    "title": post.title,
                    "description": post.description or "",
                    "audio_url": post.audio_url,
                    "thumbnail_url": post.thumbnail_url,
                    "duration_seconds": post.duration_seconds,
                    "user_id": post.user_id,

                    "author": {
                        "id": str(post.user.id),
                        "username": getattr(post.user, "username", ""),
                        "name": (
                            profile.display_name
                            if profile and profile.display_name
                            else getattr(post.user, "username", "")
                        ),
                        "avatar_url": (
                            profile.avatar_url
                            if profile and profile.avatar_url
                            else None
                        ),
                    },

                    "author_username": getattr(post.user, "username", ""),
                    "author_avatar": (
                        profile.avatar_url
                        if profile and profile.avatar_url
                        else None
                    ),

                    "like_count": PostLike.objects.filter(post_id=post.id).count(),
                    "comment_count": Comment.objects.filter(post_id=post.id).count(),
                    "share_count": PostShare.objects.filter(post_id=post.id).count(),
                    "save_count": SavedPost.objects.filter(post_id=post.id).count(),
                    "created_at": post.created_at.isoformat() if post.created_at else None,
                    "caption": caption,
                })
                
                message = Message.objects.create(
                    id=_generate_id("msg"),
                    room=room,
                    sender=user,
                    content=message_content,
                    message_type="text",
                )

                serialized_message = MessageSerializer(
                    message,
                    context={"request": None, "user": user}
                ).data

                if channel_layer:
                    async_to_sync(channel_layer.group_send)(
                        f"chat_{room.id}",
                        {
                            "type": "message_event",
                            "message": serialized_message,
                        },
                    )

                broadcast_room_snapshot(room=room, event_type="conversation_updated")

                warnings = []

                try:
                    PostShare.objects.create(
                        id=_generate_id("shr"),
                        post=post,
                        user=user,
                        share_type="message",
                        caption=caption,
                    )
                except Exception as share_error:
                    warnings.append(f"PostShare skipped: {share_error}")

                try:
                    _create_notification(
                        recipient_id=target_user.id,
                        actor_user_id=user.id,
                        notification_type="message",
                        title="New message",
                        body=f"{getattr(user, 'username', user.id)} shared a podcast with you",
                        reference_type="post",
                        reference_id=post.id
                    )
                except Exception as notify_error:
                    warnings.append(f"Notification skipped: {notify_error}")

                results.append({
                    "target_user_id": target_id,
                    "success": True,
                    "message_id": message.id,
                    "room_id": room.id,
                    **({"warnings": warnings} if warnings else {})
                })

            except Exception as e:
                results.append({
                    "target_user_id": target_id,
                    "success": False,
                    "error": str(e)
                })

        success_count = len([r for r in results if r.get("success")])

        if success_count == 0:
            first_error = next((r.get("error") for r in results if r.get("error")), None)
            return JsonResponse(
                {
                    "success": False,
                    "message": first_error or "Khong gui duoc cho nguoi nhan nao",
                    "data": {
                        "results": results,
                        "post_id": post.id,
                        "shared_with": 0,
                        "total": len(target_user_ids),
                    },
                },
                status=400,
            )

        response_message = (
            "Post shared successfully"
            if success_count == len(target_user_ids)
            else "Post shared partially"
        )

        try:
            counts = _post_counts(post.id)
        except Exception as count_error:
            print("Post count error:", count_error)
            counts = {
                "like_count": 0,
                "comment_count": 0,
                "save_count": 0,
                "share_count": 0,
            }

        return _json_success(
            response_message,
            {
                "results": results,
                "post_id": post.id,
                "shared_with": success_count,
                "total": len(target_user_ids),
                **counts,
            },
            status=201
        )

    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Share post to user error: {str(e)}")
        return _json_error(f"Server error: {str(e)}", 500)

@csrf_exempt
@require_http_methods(["POST"])
def share_profile_to_user(request, profile_user_id):
    body = _parse_body(request)
    if body is None:
        return _json_error("Invalid JSON body", 400)

    user = _get_current_user(request, body)
    if not user:
        return _json_error("Authentication required", 401)

    profile_user = get_object_or_404(
        User.objects.select_related("profile"),
        Q(id=profile_user_id) | Q(username=profile_user_id),
    )

    target_user_ids = body.get("target_user_ids") or []
    if isinstance(target_user_ids, (str, int)):
        target_user_ids = [target_user_ids]

    target_user_ids = [str(x).strip() for x in target_user_ids if str(x).strip()]
    if not target_user_ids:
        return _json_error("target_user_ids is required", 400)

    caption = (body.get("caption") or "").strip() or None
    results = []
    channel_layer = get_channel_layer()

    targets = User.objects.filter(Q(id__in=target_user_ids) | Q(username__in=target_user_ids))
    target_map = {str(t.id): t for t in targets}
    target_map.update({str(t.username): t for t in targets})

    profile = getattr(profile_user, "profile", None)

    payload = {
        "type": "profile",
        "profile_user_id": str(profile_user.id),
        "username": profile_user.username,
        "display_name": profile.display_name if profile and profile.display_name else profile_user.username,
        "avatar_url": profile.avatar_url if profile else None,
        "bio": profile.bio if profile else "",
        "caption": caption,
    }

    for target_id in target_user_ids:
        target_user = target_map.get(str(target_id))
        if not target_user:
            results.append({"target_user_id": target_id, "success": False, "error": "Target user not found"})
            continue

        if str(target_user.id) == str(user.id):
            results.append({"target_user_id": target_id, "success": False, "error": "Cannot share with yourself"})
            continue

        room = get_or_create_direct_room(user, target_user)

        message = Message.objects.create(
            id=_generate_id("msg"),
            room=room,
            sender=user,
            content=json.dumps(payload),
            message_type="text",
        )

        serialized = MessageSerializer(message, context={"request": None, "user": user}).data

        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                f"chat_{room.id}",
                {"type": "message_event", "message": serialized},
            )

        broadcast_room_snapshot(room=room, event_type="conversation_updated")

        results.append({
            "target_user_id": target_id,
            "success": True,
            "message_id": message.id,
            "room_id": room.id,
        })

    success_count = len([r for r in results if r.get("success")])
    if success_count == 0:
        return _json_error("Không gửi được cho người nhận nào", 400)

    return _json_success("Profile shared successfully", {
        "results": results,
        "shared_with": success_count,
        "total": len(target_user_ids),
    }, status=201)

# Create Report
@csrf_exempt
@require_http_methods(["POST"])
def create_report(request):
    """
    Tạo một báo cáo cho bài viết, bình luận, hoặc người dùng.
    Người dùng không thể báo cáo chính bài viết/bình luận của mình.
    
    Request body:
    {
        "user_id": "user_id_của_người_báo_cáo",
        "target_type": "post|comment|user|message",
        "target_id": "id_của_bài_viết/bình_luận/người_dùng",
        "reason": "spam|inappropriate_content|harassment|misinformation|copyright|other",
        "description": "Mô tả chi tiết về báo cáo (tùy chọn)"
    }
    """
    body = _parse_body(request)
    
    if not body:
        return _json_error("Invalid request body", 400)
    
    reporter = _get_current_user(request, body)
    
    if not reporter:
        return _json_error("Authentication required", 401)
    
    target_type = body.get("target_type", "").lower()
    target_id = body.get("target_id", "").strip()
    reason = body.get("reason", "").lower()
    description = body.get("description", "").strip()
    
    # Validate inputs
    valid_target_types = ["post", "comment", "user", "message"]
    valid_reasons = ["spam", "inappropriate_content", "harassment", "misinformation", "copyright", "other"]
    
    if not target_type or target_type not in valid_target_types:
        return _json_error(f"Invalid target_type. Must be one of: {', '.join(valid_target_types)}", 400)
    
    if not target_id:
        return _json_error("target_id is required", 400)
    
    if not reason or reason not in valid_reasons:
        return _json_error(f"Invalid reason. Must be one of: {', '.join(valid_reasons)}", 400)
    
    # Prevent users from reporting their own content
    if target_type == "post":
        post = get_object_or_404(Post, id=target_id)
        if post.user_id == reporter.id:
            return _json_error("Bạn không thể báo cáo bài viết của chính mình", 400)
        # Ensure the post exists and is accessible
    elif target_type == "comment":
        comment = get_object_or_404(Comment, id=target_id)
        if comment.user_id == reporter.id:
            return _json_error("Bạn không thể báo cáo bình luận của chính mình", 400)
    elif target_type == "user":
        target_user = get_object_or_404(User, id=target_id)
        if target_user.id == reporter.id:
            return _json_error("Bạn không thể báo cáo chính mình", 400)
    
    # Check if user already reported this content (prevent duplicate reports)
    existing_report = Report.objects.filter(
        user_id=reporter.id,
        target_type=target_type,
        target_id=target_id,
        status="pending"
    ).first()
    
    if existing_report:
        return _json_error("Bạn đã báo cáo nội dung này rồi", 400)
    
    # Create the report
    try:
        report = Report.objects.create(
            id=_generate_id("rep"),
            user_id=reporter.id,
            target_type=target_type,
            target_id=target_id,
            reason=reason,
            description=description,
            status="pending",
            created_at=timezone.now(),
            updated_at=timezone.now(),
        )
        
        return _json_success(
            "Báo cáo đã được gửi thành công",
            {
                "report_id": report.id,
                "status": report.status,
                "created_at": report.created_at.isoformat() if report.created_at else None,
            },
            201
        )
    except Exception as e:
        return _json_error(f"Lỗi khi tạo báo cáo: {str(e)}", 500)
