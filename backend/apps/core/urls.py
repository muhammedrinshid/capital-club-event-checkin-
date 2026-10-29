from django.urls import path
from . import views

urlpatterns = [
    path("settings/", views.site_settings),
    path("media/", views.media_files),
]
