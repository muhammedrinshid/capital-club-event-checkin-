from django.urls import path
from . import views

urlpatterns = [
    path("login/", views.login),
    path("login/otp/", views.login_otp),
    path("refresh/", views.refresh),
    path("logout/", views.logout),
    path("me/", views.me),
    path("2fa/setup/", views.two_factor_setup),
    path("2fa/confirm/", views.two_factor_confirm),
    path("users/", views.users_list),
    path("users/<int:pk>/", views.user_detail),
]
