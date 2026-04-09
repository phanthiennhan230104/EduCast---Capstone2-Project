from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    RegisterView,
    VerifyOTPView,
    MyTokenObtainPairView,
    get_current_user,
    ForgotPasswordView,
    VerifyResetOTPView,
    ResetPasswordView,
    GoogleLoginView,
    AdminUsersListView,
    UpdateUserProfileView,
)

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
    
]