from django.urls import path
from .views import FeedAPIView, TestCloudinaryUploadView, SearchAPIView, UserPostsAPIView, PostDetailView, ThumbnailUploadView, TrendingTagsView, TagDetailView
from .views import (
    DraftCreateView,
    AudioPreviewView,
    DraftSaveWithAudioView,
    MyDraftListView,
    DraftDetailView,
    DraftUpdateView,
    DraftDeleteView,
    UploadDocumentView,
    PublishPostView,
    TopicListView,
    TagListView,
    PostRequestRepublishView,
    ArchivedPostsAPIView,
)
from .admin_views import (
    AdminPostsListView,
    AdminPostDetailView,
    AdminPostHideView,
    AdminPostRestoreView,
    AdminPostPublishView,
    AdminPostRejectView,
    AdminUpdateReportStatusView,
    AdminLockPostWithReportView,
    AdminRejectReportView,
    AdminNotificationsListView,
    AdminNotificationDetailView,
    AdminDeleteNotificationView,
    AdminMarkNotificationAsReadView,
    AdminMarkAllNotificationsAsReadView,
    AdminGetUnreadNotificationCountView,
    AdminDebugNotificationsView,
    AdminPostRequestRepublishView,
)


urlpatterns = [
    path("upload-test/", TestCloudinaryUploadView.as_view(), name="upload-test"),
    path("upload-audio/", TestCloudinaryUploadView.as_view(), name="upload-audio"),
    path("upload-thumbnail/", ThumbnailUploadView.as_view(), name="upload-thumbnail"),
    path("feed/", FeedAPIView.as_view(), name="feed"),
    path("search/", SearchAPIView.as_view(), name="search"),
    path("posts/publish/", PublishPostView.as_view(), name="publish-post"),
    path("posts/<str:post_id>/", PostDetailView.as_view(), name="post-detail"),
    path("posts/<str:post_id>/request-republish/", PostRequestRepublishView.as_view(), name="request-republish"),
    path("users/<str:user_id>/posts/", UserPostsAPIView.as_view(), name="user-posts"),
    path("posts/my/archived/", ArchivedPostsAPIView.as_view(), name="archived-posts"),

    path("drafts/", DraftCreateView.as_view(), name="draft-create"),
    path("drafts/preview-audio/", AudioPreviewView.as_view(), name="draft-preview-audio"),
    path("drafts/save-with-audio/", DraftSaveWithAudioView.as_view(), name="draft-save-with-audio"),
    path("drafts/upload-document/", UploadDocumentView.as_view(), name="draft-upload-document"),

    path("drafts/my/", MyDraftListView.as_view(), name="my-drafts"),
    path("drafts/<str:post_id>/", DraftDetailView.as_view(), name="draft-detail"),
    path("drafts/<str:post_id>/update/", DraftUpdateView.as_view(), name="draft-update"),
    path("drafts/<str:post_id>/delete/", DraftDeleteView.as_view(), name="draft-delete"),

    # Admin endpoints
    path("admin/posts/", AdminPostsListView.as_view(), name="admin-posts-list"),
    path("admin/posts/<str:post_id>/", AdminPostDetailView.as_view(), name="admin-post-detail"),
    path("admin/posts/<str:post_id>/hide/", AdminPostHideView.as_view(), name="admin-post-hide"),
    path("admin/posts/<str:post_id>/restore/", AdminPostRestoreView.as_view(), name="admin-post-restore"),
    path("admin/posts/<str:post_id>/publish/", AdminPostPublishView.as_view(), name="admin-post-publish"),
    path("admin/posts/<str:post_id>/reject/", AdminPostRejectView.as_view(), name="admin-post-reject"),
    path("admin/posts/<str:post_id>/request-republish/", AdminPostRequestRepublishView.as_view(), name="admin-post-request-republish"),
    path("admin/posts/<str:post_id>/lock-with-report/", AdminLockPostWithReportView.as_view(), name="admin-post-lock"),
    path("admin/posts/<str:post_id>/reject-report/", AdminRejectReportView.as_view(), name="admin-post-reject-report"),
    path("admin/reports/<str:report_id>/status/", AdminUpdateReportStatusView.as_view(), name="admin-report-status"),
    
    # Admin Notifications endpoints
    path("admin/notifications/", AdminNotificationsListView.as_view(), name="admin-notifications-list"),
    path("admin/notifications/unread-count/", AdminGetUnreadNotificationCountView.as_view(), name="admin-unread-count"),
    path("admin/notifications/mark-all-as-read/", AdminMarkAllNotificationsAsReadView.as_view(), name="admin-mark-all-notifications-read"),
    path("admin/notifications/debug/", AdminDebugNotificationsView.as_view(), name="admin-notifications-debug"),
    path("admin/notifications/<str:notification_id>/read/", AdminMarkNotificationAsReadView.as_view(), name="admin-notification-read"),
    path("admin/notifications/<str:notification_id>/delete/", AdminDeleteNotificationView.as_view(), name="admin-notification-delete"),
    path("admin/notifications/<str:notification_id>/", AdminNotificationDetailView.as_view(), name="admin-notification-detail"),
    
    path("topics/", TopicListView.as_view(), name="topic-list"),
    path("tags/", TagListView.as_view(), name="tag-list"),
    path("trending-tags/", TrendingTagsView.as_view(), name="trending-tags"),
    path("tags/<str:slug>/detail/", TagDetailView.as_view(), name="tag-detail"),

]