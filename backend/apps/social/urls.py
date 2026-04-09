from django.urls import path
from . import views

urlpatterns = [
    # Like / Save
    path("posts/<str:post_id>/like/", views.toggle_like_post, name="toggle_like_post"),
    path("posts/<str:post_id>/save/", views.toggle_save_post, name="toggle_save_post"),

    # Comments
    path("posts/<str:post_id>/comments/", views.list_post_comments, name="list_post_comments"),
    path("posts/<str:post_id>/comments/create/", views.create_comment, name="create_comment"),
    path("posts/<str:post_id>/commenters/", views.list_post_commenters, name="list_post_commenters"),
    path("comments/<str:comment_id>/toggle-like/", views.toggle_comment_like, name="toggle_comment_like"),
    path("comments/<str:comment_id>/reply/", views.reply_comment, name="reply_comment"),
    path("comments/<str:comment_id>/update/", views.update_comment, name="update_comment"),
    path("comments/<str:comment_id>/delete/", views.delete_comment, name="delete_comment"),

    # List likers of a post
    path("posts/<str:post_id>/likers/", views.list_post_likers, name="list_post_likers"),

    # Follow
    path("follow-list/", views.get_following_list, name="get_following_list"),
    path("users/<str:target_user_id>/follow/", views.toggle_follow_user, name="toggle_follow_user"),

    # Notifications
    path("notifications/", views.list_notifications, name="list_notifications"),
    path("notifications/mark-all-read/", views.mark_all_notifications_as_read, name="mark_all_notifications_as_read"),

    #Share
    path("posts/<str:post_id>/share/", views.share_post, name="share_post"),
    path("posts/<str:post_id>/sharers/", views.list_post_sharers, name="list_post_sharers"),
    path("posts/<str:post_id>/unshare/", views.delete_shared_post, name="delete_shared_post"),

    # Track listen
    path("posts/<str:post_id>/listen/", views.track_listen, name="track_listen"),
]
