import json
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import get_object_or_404
from django.utils import timezone
from requests import post
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from .models import HiddenPost, PostLike, SavedPost, Comment, CommentLike, Follow, Notification, PostShare, PlaybackHistory, PostNote, Collection, CollectionPost
from apps.content.models import Post
from apps.users.models import User
from apps.users.authentication import CustomJWTAuthentication
from apps.social.models import PlaybackHistory
from apps.chat.models import ChatRoom, Message
from apps.chat.serializers import MessageSerializer
from apps.chat.services import get_or_create_direct_room
from apps.chat.services import broadcast_room_snapshot
from django.db.models import F
from django.db.models import Count, Q

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
def _post_counts(post_id):
    return {
        "like_count": PostLike.objects.filter(post_id=post_id).count(),
        "comment_count": Comment.objects.filter(post_id=post_id).count(),
        "save_count": SavedPost.objects.filter(post_id=post_id).count(),
        "share_count": PostShare.objects.filter(
            post_id=post_id,
            share_type="personal"
        ).count(),
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

    if hasattr(comment.user, "username"):
        data["username"] = comment.user.username

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
    # Lấy body JSON từ request
    body = _parse_body(request)
    if body is None:
        body = {}
    
    # Lấy user hiện tại từ request hoặc body
    user = _get_current_user(request, body)
    if not user:
        return _json_error("Authentication required", 401)

    # Kiểm tra xem post_id có phải là composite share ID không (format: share_xxx_yyy)
    # Nếu post_id là composite share ID (format: share_xxx_yyy), extract post ID
    actual_post_id = post_id
    if post_id.startswith('share_'):
        parts = post_id.split('_')
        if len(parts) >= 3:
            actual_post_id = parts[-1]  # Lấy post ID từ composite ID
    
    # Kiểm tra post tồn tại
    post = get_object_or_404(Post, id=actual_post_id)

    # Kiểm tra xem user đã like post này chưa
    existing_like = PostLike.objects.filter(post_id=post.id, user_id=user.id).first()

    # Nếu đã like rồi thì unlike (xóa record), nếu chưa like thì tạo mới record like
    if existing_like:
        existing_like.delete()
        return _json_success(
            "Unliked post successfully",
            {
                "liked": False,
                **_post_counts(post.id)
            }
        )
    
    # Tạo record like mới
    PostLike.objects.create(
        id=_generate_id("like"),
        post=post,
        user=user,
        created_at=timezone.now()
    )

    # Thông báo cho chủ post nếu actor không phải chủ post
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
            **_post_counts(post.id)
        }
    )

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

        # Nếu post_id là composite share ID (format: share_xxx_yyy), extract post ID
        actual_post_id = post_id
        if post_id.startswith('share_'):
            parts = post_id.split('_')
            if len(parts) >= 3:
                actual_post_id = parts[-1]  # Lấy post ID từ composite ID
        
        # Kiểm tra post tồn tại
        post = get_object_or_404(Post, id=actual_post_id)

        # Lấy collection_id nếu có
        collection_id = body.get("collection_id")

        # Kiểm tra xem user đã save post này chưa
        existing_saved = SavedPost.objects.filter(post_id=post.id, user_id=user.id).first()

        # Nếu đã save rồi thì unsave (xóa record)
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
                    **_post_counts(post.id)
                }
            )

        # Tạo record saved mới (không save collection vào SavedPost)
        saved_post = SavedPost.objects.create(
            id=_generate_id("save"),
            post=post,
            user=user,
            created_at=timezone.now()
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
                **_post_counts(post.id)
            }
        )
    except Exception as e:
        import traceback
        print(f"❌ Error in toggle_save_post: {str(e)}")
        print(traceback.format_exc())

    # Cập nhật save_count trong database
    post.save_count = SavedPost.objects.filter(post_id=post.id).count()
    post.save(update_fields=['save_count'])

    return _json_success(
        "Saved post successfully",
        {
            "saved": True,
            "collection_id": collection_id,
            **_post_counts(post.id)
        }
    )


# Comment: list
@require_http_methods(["GET"])
def list_post_comments(request, post_id):
    # Nếu post_id là composite share ID (format: share_xxx_yyy), extract post ID
    actual_post_id = post_id
    if post_id.startswith('share_'):
        parts = post_id.split('_')
        if len(parts) >= 3:
            actual_post_id = parts[-1]  # Lấy post ID từ composite ID
    
    post = get_object_or_404(Post, id=actual_post_id)

    user = _get_current_user(request)

    liked_comment_ids = set()
    if user:
        liked_comment_ids = set(
            CommentLike.objects.filter(user_id=user.id).values_list("comment_id", flat=True)
        )

    top_level_comments = Comment.objects.filter(
        post_id=post.id,
        parent_comment_id__isnull=True,
    ).select_related("user").order_by("-created_at")

    comments_data = [
        _comment_to_dict(
            comment,
            include_replies=True,
            liked_comment_ids=liked_comment_ids
        )
        for comment in top_level_comments
    ]

    return _json_success(
        "Comments fetched successfully",
        {
            "post_id": post.id,
            "comments": comments_data,
            **_post_counts(post.id)
        }
    )

# List commmentors
@require_http_methods(["GET"])
def list_post_commenters(request, post_id):
    # Nếu post_id là composite share ID (format: share_xxx_yyy), extract post ID
    actual_post_id = post_id
    if post_id.startswith('share_'):
        parts = post_id.split('_')
        if len(parts) >= 3:
            actual_post_id = parts[-1]  # Lấy post ID từ composite ID
    
    post = get_object_or_404(Post, id=actual_post_id)

    comments = (
        Comment.objects.filter(post_id=post.id)
        .select_related("user")
        .order_by("-created_at")
    )

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

        data.append(item)

    return _json_success(
        "Post commenters fetched successfully",
        {
            "post_id": post.id,
            "commenters": data,
            **_post_counts(post.id)
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

    # Nếu post_id là composite share ID (format: share_xxx_yyy), extract post ID
    actual_post_id = post_id
    if post_id.startswith('share_'):
        parts = post_id.split('_')
        if len(parts) >= 3:
            actual_post_id = parts[-1]  # Lấy post ID từ composite ID

    # Kiểm tra post tồn tại
    post = get_object_or_404(Post, id=actual_post_id)

    # Tạo comment mới với parent_comment_id = null
    comment = Comment.objects.create(
        id=_generate_id("cmt"),
        post=post,
        user=user,
        parent_comment=None,
        content=content,
        created_at=timezone.now(),
        updated_at=timezone.now()
    )

    # Notify chủ post nếu người comment không phải chủ post
    _create_notification(
        recipient_id=post.user_id,
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
            **_post_counts(post.id)
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
    # Nếu post_id là composite share ID (format: share_xxx_yyy), extract post ID
    actual_post_id = post_id
    if post_id.startswith('share_'):
        parts = post_id.split('_')
        if len(parts) >= 3:
            actual_post_id = parts[-1]  # Lấy post ID từ composite ID
    
    # Kiểm tra post tồn tại
    post = get_object_or_404(Post, id=actual_post_id)

    # Lấy tất cả like
    likes = PostLike.objects.filter(post_id=post.id).select_related("user").order_by("-created_at")

    # Chuyển từng like thành dict
    data = []
    for like in likes:
        item = {
            "user_id": like.user_id,
        }
        # Nếu bảng users có username thì dùng được. Nếu không có thì giữ user_id.
        if hasattr(like.user, "username"):
            item["username"] = like.user.username
        data.append(item)

    return _json_success(
        "Post likers fetched successfully",
        {
            "post_id": post.id,
            "likers": data,
            **_post_counts(post.id)
        }
    )


# Get following list of current user
@csrf_exempt
@require_http_methods(["GET"])
def get_following_list(request):
    user = _get_current_user(request)
    if not user:
        return _json_error("Authentication required", 401)

    follows = Follow.objects.filter(
        follower_id=user.id
    ).select_related("following")

    following = []
    for f in follows:
        following.append({
            "id": f.following_id,
            "username": getattr(f.following, "username", ""),
            "display_name": getattr(f.following, "display_name", getattr(f.following, "username", "")),
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

        # Nếu post_id là composite share ID (format: share_xxx_yyy), extract post ID
        actual_post_id = post_id
        if post_id.startswith('share_'):
            parts = post_id.split('_')
            if len(parts) >= 3:
                actual_post_id = parts[-1]  # Lấy post ID từ composite ID

        # Kiểm tra post tồn tại
        post = get_object_or_404(Post, id=actual_post_id)

        # Kiểm tra xem user đã share bài viết này chưa
        existing_share = PostShare.objects.filter(
            post_id=post.id,
            user_id=user.id,
            share_type="personal"
        ).first()

        if existing_share:
            return _json_error("Bạn đã chia sẻ bài viết này rồi", 400)

        share_type = (body.get("share_type") or "personal").strip()

        if share_type != "personal":
            return _json_error("Only 'personal' share type is supported", 400)

        caption = body.get("caption")
        if caption:
            caption = caption.strip()

        # Tạo record share mới (chỉ cho personal shares)
        share = PostShare.objects.create(
            id=_generate_id("shr"),
            post=post,
            user=user,
            share_type="personal",
            caption=caption,
            created_at=timezone.now()
        )

        # Thông báo cho chủ post
        notification_title = "Your post was shared"
        notification_body = f"{getattr(user, 'username', user.id)} shared your post to their profile"

        _create_notification(
            recipient_id=post.user_id,
            actor_user_id=user.id,
            notification_type="new_post",  
            title=notification_title,
            body=notification_body,
            reference_type="post",
            reference_id=post.id
        )

        return _json_success(
            "Post shared successfully",
            {
                "share": {
                    "id": share.id,
                    "post_id": share.post_id,
                    "user_id": share.user_id,
                    "share_type": share.share_type,
                    "caption": share.caption,
                    "created_at": share.created_at.isoformat() if share.created_at else None,
                },
                **_post_counts(post.id)
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
    existing_share = PostShare.objects.filter(
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
    # Nếu post_id là composite share ID (format: share_xxx_yyy), extract post ID
    actual_post_id = post_id
    if post_id.startswith('share_'):
        parts = post_id.split('_')
        if len(parts) >= 3:
            actual_post_id = parts[-1]  # Lấy post ID từ composite ID
    
    # Kiểm tra post tồn tại
    post = get_object_or_404(Post, id=actual_post_id)

    # Lấy tất cả share
    shares = PostShare.objects.filter(
        post_id=post.id,
        share_type="personal"
    ).select_related("user").order_by("-created_at")
    
    # Chuyển từng share thành dict
    data = []
    for share in shares:
        item = {
            "share_id": share.id,
            "user_id": share.user_id,
            "share_type": share.share_type,
            "created_at": share.created_at.isoformat() if share.created_at else None,
        }
        # Nếu bảng users có username thì dùng được. Nếu không có thì giữ user_id.
        if hasattr(share.user, "username"):
            item["username"] = share.user.username
        data.append(item)

    return _json_success(
        "Post sharers fetched successfully",
        {
            "post_id": post.id,
            "sharers": data,
            **_post_counts(post.id)
        }
    )

# Lấy danh sách bài viết đã lưu của user hiện tại
@require_http_methods(["GET"])
def get_saved_posts(request):
    # Lấy user hiện tại từ request
    user = _get_current_user(request)
    if not user:
        return _json_error("Authentication required", 401)

    # Lấy tất cả saved posts của user, kèm post info, sắp xếp mới nhất trước
    saved_posts = SavedPost.objects.filter(
        user_id=user.id
    ).exclude(
        post__status='archived'
    ).select_related("post").order_by("-created_at")

     # Lấy danh sách post đã bị ẩn
    hidden_post_ids = HiddenPost.objects.filter(
        user_id=user.id
    ).values_list("post_id", flat=True)

    # Loại bỏ các post đã ẩn
    saved_posts = saved_posts.exclude(
        post_id__in=hidden_post_ids
    )

    # Chuyển đổi thành dict với thông tin post
    posts_data = []
    for saved_post in saved_posts:
        post = saved_post.post
        
        # Lấy playback history của user cho post này
        playback_history = PlaybackHistory.objects.filter(
            user_id=user.id,
            post_id=post.id
        ).first()
        
        # Check if user has a note for this post
        has_note = PostNote.objects.filter(
            user_id=user.id,
            post_id=post.id
        ).exists()

        # Check if user has liked this post
        is_liked = PostLike.objects.filter(
            user_id=user.id,
            post_id=post.id
        ).exists()
        
        # Get tags for this post
        from apps.content.models import PostTag
        post_tags = PostTag.objects.filter(post_id=post.id).select_related('tag').values_list('tag__name', flat=True)
        tags = list(post_tags) if post_tags else []
        
        item = {
            "id": post.id,
            "title": post.title,
            "description": post.description,
            "audio_url": post.audio_url,
            "thumbnail_url": post.thumbnail_url,
            "duration_seconds": post.duration_seconds,
            "listen_count": post.listen_count,
            "like_count": PostLike.objects.filter(post_id=post.id).count(),
            "comment_count": Comment.objects.filter(post_id=post.id).count(),
            "save_count": SavedPost.objects.filter(post_id=post.id).count(),
            "share_count": PostShare.objects.filter(post_id=post.id, share_type="personal").count(),
            "user_id": post.user_id,
            "category_id": post.category_id,
            "tags": tags,
            "created_at": post.created_at.isoformat() if post.created_at else None,
            "saved_at": saved_post.created_at.isoformat() if saved_post.created_at else None,
            "has_note": has_note,
            "is_liked": is_liked,
            "playback_history": {
                "completed_ratio": playback_history.completed_ratio if playback_history else 0,
            } if playback_history else None,
        }
        
        # Lấy thông tin author
        if post.user:
            item["author"] = getattr(post.user, 'username', post.user.id)
        
        posts_data.append(item)

    return _json_success(
        "Saved posts fetched successfully",
        {
            "saved_posts": posts_data,
            "total_count": len(posts_data)
        }
    )


@csrf_exempt
@require_http_methods(["POST"])
def track_listen(request, post_id):
    body = _parse_body(request) or {}
    user = _get_current_user(request, body)

    if not user:
        return _json_error("Authentication required", 401)

    post = get_object_or_404(Post, id=post_id)

    progress = int(body.get("progress_seconds", 0))
    duration = int(body.get("duration_seconds", 0))

    history, created = PlaybackHistory.objects.get_or_create(
        user_id=user.id,
        post_id=post.id,
        defaults={
            "id": _generate_id("ph"),
            "progress_seconds": progress,
            "duration_seconds": duration,
            "completed_ratio": (progress / duration) if duration else 0,
            "is_completed": (progress / duration) >= 0.9 if duration else False,
            "last_played_at": timezone.now(),
        }
    )

    if not created:
        old_completed_ratio = history.completed_ratio or 0

        history.progress_seconds = progress
        history.duration_seconds = duration
        history.last_played_at = timezone.now()
        history.completed_ratio = (progress / duration) if duration else 0
        history.is_completed = history.completed_ratio >= 0.9
        history.save()

        # Tăng listen_count chỉ khi vừa vượt quá mốc 50% lần đầu tiên
        new_completed_ratio = history.completed_ratio or 0
        if old_completed_ratio < 0.5 and new_completed_ratio >= 0.5:
            Post.objects.filter(id=post.id).update(
                listen_count=F("listen_count") + 1
            )
            post.refresh_from_db(fields=["listen_count"])
    else:
        # Nếu record vừa tạo mà đã >=50% thì tăng luôn
        if progress >= (duration * 0.5) if duration else 0:
            Post.objects.filter(id=post.id).update(
                listen_count=F("listen_count") + 1
            )
        post.refresh_from_db(fields=["listen_count"])

    return _json_success(
        "Tracked listen",
        {
            "post_id": post.id,
            "listen_count": post.listen_count,
            "progress_seconds": progress,
            "duration_seconds": duration,
            "completed_ratio": history.completed_ratio,
        }
    )

@require_http_methods(["GET"])
def get_friends_list(request):
    user = _get_current_user(request)
    if not user:
        return _json_error("Authentication required", 401)

    # người mình follow
    following_ids = Follow.objects.filter(
        follower_id=user.id
    ).values_list("following_id", flat=True)

    # người follow lại mình
    follower_ids = Follow.objects.filter(
        following_id=user.id
    ).values_list("follower_id", flat=True)

    # mutual = giao nhau
    friend_ids = set(following_ids).intersection(set(follower_ids))

    friends = (
        User.objects
        .filter(id__in=friend_ids)
        .exclude(id=user.id)
        .select_related("profile")
    )

    data = [
        {
            "id": u.id,
            "username": getattr(u, "username", ""),
            "display_name": (
                getattr(getattr(u, "profile", None), "display_name", None)
                or getattr(u, "username", "")
            )
        }
        for u in friends
    ]

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

        collection = get_object_or_404(Collection, id=collection_id)
        
        if collection.user_id != user.id:
            return _json_error("You don't have access to this collection", 403)

        collection_posts = CollectionPost.objects.filter(
            collection_id=collection.id
        ).exclude(
            post__status='archived'   
        ).select_related('post').order_by('-added_at')
        
        # Lấy danh sách post đã bị ẩn
        hidden_post_ids = HiddenPost.objects.filter(user_id=user.id).values_list("post_id", flat=True)
        
        data = []
        for cp in collection_posts:
            post = cp.post
            
            if post.id in hidden_post_ids:
                continue
            
            playback_history = PlaybackHistory.objects.filter(
                user_id=user.id,
                post_id=post.id
            ).first()
            
            has_note = PostNote.objects.filter(
                user_id=user.id,
                post_id=post.id
            ).exists()

            is_liked = PostLike.objects.filter(
                user_id=user.id,
                post_id=post.id
            ).exists()
            
            from apps.content.models import PostTag
            post_tags = PostTag.objects.filter(post_id=post.id).select_related('tag').values_list('tag__name', flat=True)
            tags = list(post_tags) if post_tags else []
            
            item = {
                "id": post.id,
                "title": post.title,
                "description": post.description,
                "audio_url": post.audio_url,
                "thumbnail_url": post.thumbnail_url,
                "duration_seconds": post.duration_seconds,
                "listen_count": post.listen_count,
                "like_count": PostLike.objects.filter(post_id=post.id).count(),
                "comment_count": Comment.objects.filter(post_id=post.id).count(),
                "save_count": SavedPost.objects.filter(post_id=post.id).count(),
                "share_count": PostShare.objects.filter(post_id=post.id, share_type="personal").count(),
                "user_id": post.user_id,
                "category_id": post.category_id,
                "tags": tags,
                "created_at": post.created_at.isoformat() if post.created_at else None,
                "has_note": has_note,
                "is_liked": is_liked,
                "playback_history": {
                    "completed_ratio": playback_history.completed_ratio if playback_history else 0,
                } if playback_history else None,
            }
            
            # Lấy thông tin author
            if post.user:
                item["author"] = getattr(post.user, 'username', post.user.id)
                item["author_username"] = getattr(post.user, 'username', post.user.id)
            else:
                item["author"] = "Unknown"
                item["author_username"] = "Unknown"
            
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
        return _json_error(f"Error fetching collection posts: {str(e)}", 500)


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

        post = get_object_or_404(Post, id=post_id)

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

                message_content = json.dumps({
                    "type": "podcast",
                    "post_id": post.id,
                    "title": post.title,
                    "description": post.description or "",
                    "audio_url": post.audio_url,
                    "thumbnail_url": post.thumbnail_url,
                    "duration_seconds": post.duration_seconds,
                    "user_id": post.user_id,
                    "author": getattr(post.user, 'username', 'Unknown') if post.user else 'Unknown',
                    "author_username": getattr(post.user, 'username', '') if post.user else '',
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

        return _json_success(
            response_message,
            {
                "results": results,
                "post_id": post.id,
                "shared_with": success_count,
                "total": len(target_user_ids),
                **_post_counts(post.id)
            },
            status=201
        )

    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Share post to user error: {str(e)}")
        return _json_error(f"Server error: {str(e)}", 500)
