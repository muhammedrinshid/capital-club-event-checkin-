from django.urls import path
from . import views

urlpatterns = [
    path("events/<int:event_pk>/guests/", views.guests_list),
    path("events/<int:event_pk>/guests/bulk-upload/", views.guests_bulk_upload),
    path("events/<int:event_pk>/guests/<int:pk>/", views.guest_detail),
]
