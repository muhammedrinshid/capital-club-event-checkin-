from django.urls import path
from . import views

urlpatterns = [
    path("members/", views.members_list),
    path("members/import/", views.members_import),
    path("members/<int:pk>/", views.member_detail),
]
