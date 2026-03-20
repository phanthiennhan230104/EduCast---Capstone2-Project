import json
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import get_object_or_404
from django.utils import timezone

from .models import PostLike, SavedPost, Comment, Follow, Notification
from apps.content.models import Post
from apps.users.models import User

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

# Lấy user hiện tại từ body hoặc query param
def _get_current_user(request, body=None):
    if hasattr(request, "user") and request.user and request.user.is_authenticated:
        return request.user

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
        created_at=timezone.now(),
    )

# Helper để đếm like/comment/save cho post
def _post_counts(post_id):
    return {
        "like_count": PostLike.objects.filter(post_id=post_id).count(),
        "comment_count": Comment.objects.filter(post_id=post_id).count(),
        "save_count": SavedPost.objects.filter(post_id=post_id).count(),
    }

# Chuyển comment thành dict, có thể include replies nếu cần.
def _comment_to_dict(comment, include_replies=False):
    data = {
        "id": comment.id,
        "post_id": comment.post_id,
        "user_id": comment.user_id,
        "parent_comment_id": comment.parent_comment_id,
        "content": comment.content,
        "status": comment.status,
        "created_at": comment.created_at.isoformat() if comment.created_at else None,
        "updated_at": comment.updated_at.isoformat() if comment.updated_at else None,
    }

    # Nếu bảng users có username thì dùng được. Nếu không có thì giữ user_id.
    if hasattr(comment.user, "username"):
        data["username"] = comment.user.username

    # Nếu include_replies=True thì đệ quy lấy replies cho comment này.
    if include_replies:
        replies = Comment.objects.filter(
            parent_comment_id=comment.id,
        ).select_related("user").order_by("created_at")
        data["replies"] = [_comment_to_dict(reply, include_replies=False) for reply in replies]

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
    # Lấy user hiện tại từ request hoặc body
    user = _get_current_user(request)
    if not user:
        return _json_error("Authentication required", 401)

    # Kiểm tra post tồn tại
    post = get_object_or_404(Post, id=post_id)

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
    # Lấy user hiện tại từ request hoặc body
    user = _get_current_user(request)
    if not user:
        return _json_error("Authentication required", 401)

    # Kiểm tra post tồn tại
    post = get_object_or_404(Post, id=post_id)

    # Không cho save post của mình
    if post.user_id == user.id:
        return _json_error("You cannot save your own post", 403)

    # Kiểm tra xem user đã save post này chưa
    existing_saved = SavedPost.objects.filter(post_id=post.id, user_id=user.id).first()

    # Nếu đã save rồi thì unsave (xóa record), nếu chưa save thì tạo mới record saved
    if existing_saved:
        existing_saved.delete()
        return _json_success(
            "Unsaved post successfully",
            {
                "saved": False,
                **_post_counts(post.id)
            }
        )

    # Tạo record saved mới
    SavedPost.objects.create(
        id=_generate_id("save"),
        post=post,
        user=user,
        created_at=timezone.now()
    )

    return _json_success(
        "Saved post successfully",
        {
            "saved": True,
            **_post_counts(post.id)
        }
    )


# Comment: list
@require_http_methods(["GET"])
def list_post_comments(request, post_id):
    # Kiểm tra post tồn tại
    post = get_object_or_404(Post, id=post_id)
 
    # Lấy tất cả comment cha kèm user info, sắp xếp mới nhất trước
    top_level_comments = Comment.objects.filter(
        post_id=post.id,
        parent_comment_id__isnull=True,
    ).select_related("user").order_by("-created_at")

    # Chuyển từng comment thành dict
    comments_data = [_comment_to_dict(comment, include_replies=True) for comment in top_level_comments]

    return _json_success(
        "Comments fetched successfully",
        {
            "post_id": post.id,
            "comments": comments_data,
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

    # Kiểm tra post tồn tại
    post = get_object_or_404(Post, id=post_id)

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

    return _json_success(
        "Comment created successfully",
        {
            "comment": _comment_to_dict(comment),
            **_post_counts(post.id)
        },
        status=201
    )

# Tạo reply cho comment
@csrf_exempt
@require_http_methods(["POST"])
def reply_comment(request, comment_id):
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

    # Kiểm tra comment cha tồn tại và đang active
    parent_comment = get_object_or_404(Comment, id=comment_id)

    # Tạo comment mới với parent_comment_id = comment_id
    reply = Comment.objects.create(
        id=_generate_id("cmt"),
        post_id=parent_comment.post_id,
        user=user,
        parent_comment=parent_comment,
        content=content,
        created_at=timezone.now(),
        updated_at=timezone.now()
    )

    # 1) Notify người có comment cha nếu không phải chính mình
    _create_notification(
        recipient_id=parent_comment.user_id,
        actor_user_id=user.id,
        notification_type="comment",
        title="New reply",
        body=f"{getattr(user, 'username', user.id)} replied to your comment",
        reference_type="comment",
        reference_id=reply.id
    )

    # 2) Notify chủ post nếu khác actor và khác owner comment cha
    post = parent_comment.post
    if post.user_id not in [user.id, parent_comment.user_id]:
        _create_notification(
            recipient_id=post.user_id,
            actor_user_id=user.id,
            notification_type="comment",
            title="New reply on your post",
            body=f"{getattr(user, 'username', user.id)} replied in your post",
            reference_type="comment",
            reference_id=reply.id
        )

    return _json_success(
        "Reply created successfully",
        {
            "comment": _comment_to_dict(reply),
            **_post_counts(parent_comment.post_id)
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
    post = get_object_or_404(Post, id=post_id)

    likes = PostLike.objects.filter(post_id=post.id).select_related("user").order_by("-created_at")

    data = []
    for like in likes:
        item = {
            "user_id": like.user_id,
        }
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