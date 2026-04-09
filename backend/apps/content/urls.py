from django.urls import path
from .views import FeedAPIView, TestCloudinaryUploadView, SearchAPIView
from .views import (
    DraftCreateView,
    AudioPreviewView,
    DraftSaveWithAudioView,
    MyDraftListView,
    DraftDetailView,
    DraftUpdateView,
    DraftDeleteView,
    UploadDocumentView,
)

urlpatterns = [
    path("upload-test/", TestCloudinaryUploadView.as_view(), name="upload-test"),
    path("feed/", FeedAPIView.as_view(), name="feed"),
    path("search/", SearchAPIView.as_view(), name="search"),

    path("drafts/", DraftCreateView.as_view(), name="draft-create"),
    path("drafts/preview-audio/", AudioPreviewView.as_view(), name="draft-preview-audio"),
    path("drafts/save-with-audio/", DraftSaveWithAudioView.as_view(), name="draft-save-with-audio"),
    path("drafts/upload-document/", UploadDocumentView.as_view(), name="draft-upload-document"),

    path("drafts/my/", MyDraftListView.as_view(), name="my-drafts"),
    path("drafts/<str:post_id>/", DraftDetailView.as_view(), name="draft-detail"),
    path("drafts/<str:post_id>/update/", DraftUpdateView.as_view(), name="draft-update"),
    path("drafts/<str:post_id>/delete/", DraftDeleteView.as_view(), name="draft-delete"),

]