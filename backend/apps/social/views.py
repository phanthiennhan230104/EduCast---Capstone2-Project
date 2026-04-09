import json
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import get_object_or_404
from django.utils import timezone

from .models import PostLike, SavedPost, Comment, CommentLike, Follow, Notification, PostShare, PlaybackHistory
from apps.content.models import Post
from apps.users.models import User
from apps.users.authentication import CustomJWTAuthentication
from apps.social.models import PlaybackHistory
from django.db.models import F

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
        created_at=timezone.now(),
    )

# Helper để đếm like/comment/save/share cho post
def _post_counts(post_id):
    return {
        "like_count": PostLike.objects.filter(post_id=post_id).count(),
        "comment_count": Comment.objects.filter(post_id=post_id).count(),
        "save_count": SavedPost.objects.filter(post_id=post_id).count(),
        "share_count": PostShare.objects.filter(post_id=post_id).count(),
    }

# Chuyển comment thành dict, có thể include replies nếu cần.
def _comment_to_dict(comment, include_replies=False, liked_comment_ids=None):
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

    if include_replies:
        replies = Comment.objects.filter(
            parent_comment_id=comment.id
        ).select_related("user").order_by("-created_at")

        data["replies"] = [
            _comment_to_dict(
                reply,
                include_replies=True,
                liked_comment_ids=liked_comment_ids
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
    post = get_object_or_404(Post, id=post_id)

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
    post = get_object_or_404(Post, id=post_id)

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

    # luôn gom reply về comment cha gốc
    reply = Comment.objects.create(
        id=_generate_id("cmt"),
        post_id=target_comment.post_id,
        user=user,
        parent_comment=target_comment,
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
    # Kiểm tra post tồn tại
    post = get_object_or_404(Post, id=post_id)

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
    # Lấy user hiện tại từ request
    user = _get_current_user(request)
    if not user:
        return _json_error("Authentication required", 401)

    # Lấy danh sách user mà current user đang follow
    following_list = Follow.objects.filter(
        follower_id=user.id
    ).select_related('following').values(
        'id', 'following_id', 'following__username', 'following__display_name'
    )

    following = [
        {
            'id': f['following_id'],
            'username': f['following__username'],
            'display_name': f['following__display_name']
        }
        for f in following_list
    ]

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
    # Lấy body JSON từ request
    body = _parse_body(request)
    if body is None:
        return _json_error("Invalid JSON body", 400)

    # Lấy user hiện tại từ request hoặc body
    user = _get_current_user(request, body)
    if not user:
        return _json_error("Authentication required", 401)

    # Kiểm tra post tồn tại
    post = get_object_or_404(Post, id=post_id)

    # Lấy share_type từ body, mặc định là "copy_link" nếu không có
    share_type = (body.get("share_type") or "copy_link").strip()

    # Kiểm tra share_type hợp lệ
    allowed_share_types = {
        "copy_link",
        "facebook",
        "messenger",
        "zalo",
        "other",
    }
    # Nếu share_type không hợp lệ thì trả về lỗi
    if share_type not in allowed_share_types:
        return _json_error("Invalid share_type", 400)

    # Tạo record share mới
    share = PostShare.objects.create(
        id=_generate_id("shr"),
        post=post,
        user=user,
        share_type=share_type,
        created_at=timezone.now()
    )

    # Thông báo cho chủ post nếu người share không phải chủ post
    _create_notification(
        recipient_id=post.user_id,
        actor_user_id=user.id,
        notification_type="new_post",  
        title="Your post was shared",
        body=f"{getattr(user, 'username', user.id)} shared your post",
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
                "created_at": share.created_at.isoformat() if share.created_at else None,
            },
            **_post_counts(post.id)
        },
        status=201
    )


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


# List share post 
@require_http_methods(["GET"])
def list_post_sharers(request, post_id):
    # Kiểm tra post tồn tại
    post = get_object_or_404(Post, id=post_id)

    # Lấy tất cả share
    shares = PostShare.objects.filter(post_id=post.id).select_related("user").order_by("-created_at")

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
        old_progress = history.progress_seconds or 0

        history.progress_seconds = progress
        history.duration_seconds = duration
        history.last_played_at = timezone.now()
        history.completed_ratio = (progress / duration) if duration else 0
        history.is_completed = history.completed_ratio >= 0.9
        history.save()

        # chỉ tăng 1 lần khi lần đầu vượt mốc 10s
        if old_progress < 10 and progress >= 10:
            Post.objects.filter(id=post.id).update(
                listen_count=F("listen_count") + 1
            )
            post.refresh_from_db(fields=["listen_count"])
    else:
        # nếu record vừa tạo mà đã >=10s thì tăng luôn
        if progress >= 10:
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
        }
    )