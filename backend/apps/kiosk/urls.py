from django.urls import path
from . import views

urlpatterns = [
    path("unlock/", views.unlock),
    path("events/", views.kiosk_events),
    path("events/<int:event_id>/guests/", views.kiosk_guests),
    path("events/<int:event_id>/guests/<int:guest_id>/check-in/", views.check_in),
    path("events/<int:event_id>/guests/<int:guest_id>/undo/", views.undo_check_in),
    path("events/<int:event_id>/walk-ins/", views.walk_in),
    path("devices/", views.devices_list),
    path("devices/<int:pk>/", views.device_detail),
]
