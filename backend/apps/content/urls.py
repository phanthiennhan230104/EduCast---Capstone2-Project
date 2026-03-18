from django.urls import path
from .views import TestCloudinaryUploadView

urlpatterns = [
    path("upload-test/", TestCloudinaryUploadView.as_view(), name="upload-test"),
]