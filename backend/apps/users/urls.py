from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .admin_views import AdminUsersListView, AdminUserLockView, AdminUserUnlockView

from .views import (
    RegisterView,
    VerifyOTPView,
    MyTokenObtainPairView,
    get_current_user,
    ForgotPasswordView,
    VerifyResetOTPView,
    ResetPasswordView,
    GoogleLoginView,
    UpdateUserProfileView,
)
from .admin_views import (
    AdminOverviewView,
    AdminUsersListView,
    AdminUserLockView,
    AdminUserUnlockView,
)
from .views_tag import (
    get_user_tag_preferences,
    update_user_tag_preferences,
    add_tag_preference,
    remove_tag_preference,
    get_available_tags,
    search_tags,
    create_and_add_tag,
)
from .admin_views import AdminUserUnlockView, AdminUsersListView

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("verify-otp/", VerifyOTPView.as_view(), name="verify-otp"),
    path("login/", MyTokenObtainPairView.as_view(), name="login"),
    path("me/", get_current_user, name="current_user"),
    path("profile/update/", UpdateUserProfileView.as_view(), name="update-profile"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("forgot-password/", ForgotPasswordView.as_view(), name="forgot-password"),
    path("verify-reset-otp/", VerifyResetOTPView.as_view(), name="verify-reset-otp"),
    path("reset-password/", ResetPasswordView.as_view(), name="reset-password"),
    path("login/google/", GoogleLoginView.as_view(), name="google-login"),

    path("admin/users/", AdminUsersListView.as_view(), name="admin-users-list"),
    path("admin/overview/", AdminOverviewView.as_view(), name="admin-overview"),
    path("admin/users/<str:user_id>/lock/", AdminUserLockView.as_view(), name="admin-user-lock"),
    path("admin/users/<str:user_id>/unlock/", AdminUserUnlockView.as_view(), name="admin-user-unlock"),
    
    # Tag preferences endpoints
    path("tags/available/", get_available_tags, name="available-tags"),
    path("tags/search/", search_tags, name="search-tags"),
    path("tags/create-and-add/", create_and_add_tag, name="create-and-add-tag"),
    path("me/tag-preferences/", get_user_tag_preferences, name="get-tag-preferences"),
    path("me/tag-preferences/update/", update_user_tag_preferences, name="update-tag-preferences"),
    path("me/tag-preferences/add/", add_tag_preference, name="add-tag-preference"),
    path("me/tag-preferences/<str:tag_id>/delete/", remove_tag_preference, name="remove-tag-preference"),
]