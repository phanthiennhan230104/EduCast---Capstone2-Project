from django.urls import path
from .views import FeedAPIView, TestCloudinaryUploadView, SearchAPIView, UserPostsAPIView, UserSharedPostsAPIView
from .views import (
    DraftCreateView,
    AudioPreviewView,
    DraftSaveWithAudioView,
    MyDraftListView,
    DraftDetailView,
    DraftUpdateView,
    DraftDeleteView,
    PublishPostView,
    UploadDocumentView,
    PublishPostView,
    CategoryListView,
    TopicListView,
)
from .admin_views import (
    AdminPostsListView,
    AdminPostDetailView,
    AdminPostHideView,
    AdminPostRestoreView,
    AdminUpdateReportStatusView,
    AdminLockPostWithReportView,
    AdminRejectReportView,
)


urlpatterns = [
    path("upload-test/", TestCloudinaryUploadView.as_view(), name="upload-test"),
    path("upload-audio/", TestCloudinaryUploadView.as_view(), name="upload-audio"),
    path("feed/", FeedAPIView.as_view(), name="feed"),
    path("search/", SearchAPIView.as_view(), name="search"),
    path("users/<str:user_id>/posts/", UserPostsAPIView.as_view(), name="user-posts"),
    path("users/<str:user_id>/shared-posts/", UserSharedPostsAPIView.as_view(), name="user-shared-posts"),

    path("drafts/", DraftCreateView.as_view(), name="draft-create"),
    path("drafts/preview-audio/", AudioPreviewView.as_view(), name="draft-preview-audio"),
    path("drafts/save-with-audio/", DraftSaveWithAudioView.as_view(), name="draft-save-with-audio"),
    path("drafts/upload-document/", UploadDocumentView.as_view(), name="draft-upload-document"),

    path("drafts/my/", MyDraftListView.as_view(), name="my-drafts"),
    path("drafts/<str:post_id>/", DraftDetailView.as_view(), name="draft-detail"),
    path("drafts/<str:post_id>/update/", DraftUpdateView.as_view(), name="draft-update"),
    path("drafts/<str:post_id>/publish/", PublishPostView.as_view(), name="draft-publish"),
    path("drafts/<str:post_id>/delete/", DraftDeleteView.as_view(), name="draft-delete"),

    # Admin endpoints
    path("admin/posts/", AdminPostsListView.as_view(), name="admin-posts-list"),
    path("admin/posts/<str:post_id>/", AdminPostDetailView.as_view(), name="admin-post-detail"),
    path("admin/posts/<str:post_id>/hide/", AdminPostHideView.as_view(), name="admin-post-hide"),
    path("admin/posts/<str:post_id>/restore/", AdminPostRestoreView.as_view(), name="admin-post-restore"),
    path("admin/posts/<str:post_id>/lock-with-report/", AdminLockPostWithReportView.as_view(), name="admin-post-lock"),
    path("admin/posts/<str:post_id>/reject-report/", AdminRejectReportView.as_view(), name="admin-post-reject-report"),
    path("admin/reports/<str:report_id>/status/", AdminUpdateReportStatusView.as_view(), name="admin-report-status"),
    path("posts/publish/", PublishPostView.as_view(), name="publish-post"),
    path("categories/", CategoryListView.as_view(), name="category-list"),
    path("topics/", TopicListView.as_view(), name="topic-list"),

]