from django.urls import path
from .views import register_view, login_view, me_view, logout_view

urlpatterns = [
    path("register/", register_view, name="register"),
    path("login/", login_view, name="login"),
    path("me/", me_view, name="me"),
    path("logout/", logout_view, name="logout"),
]