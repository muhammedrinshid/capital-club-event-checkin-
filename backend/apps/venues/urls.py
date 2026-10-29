from django.urls import path
from . import views

urlpatterns = [
    path("rooms/", views.rooms_list),
    path("rooms/<int:pk>/", views.room_detail),
]
