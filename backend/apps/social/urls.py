from django.urls import path
from . import views

urlpatterns = [
    # Like / Save
    path("posts/<str:post_id>/like/", views.toggle_like_post, name="toggle_like_post"),
    path("posts/<str:post_id>/save/", views.toggle_save_post, name="toggle_save_post"),

    # Comments
    path("posts/<str:post_id>/comments/", views.list_post_comments, name="list_post_comments"),
    path("posts/<str:post_id>/comments/create/", views.create_comment, name="create_comment"),
    path("comments/<str:comment_id>/reply/", views.reply_comment, name="reply_comment"),
    path("comments/<str:comment_id>/update/", views.update_comment, name="update_comment"),
    path("comments/<str:comment_id>/delete/", views.delete_comment, name="delete_comment"),

    # List likers of a post
    path("posts/<str:post_id>/likers/", views.list_post_likers, name="list_post_likers"),

    # Follow
    path("users/<str:target_user_id>/follow/", views.toggle_follow_user, name="toggle_follow_user"),

    # Notifications
    path("notifications/", views.list_notifications, name="list_notifications"),
    path("notifications/mark-all-read/", views.mark_all_notifications_as_read, name="mark_all_notifications_as_read"),
]