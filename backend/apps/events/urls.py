from django.urls import path
from . import views

urlpatterns = [
    path("events/", views.events_list),
    path("events/check-conflict/", views.event_check_conflict),
    path("events/report/", views.events_report_all),
    path("events/<int:pk>/", views.event_detail),
    path("events/<int:pk>/cancel/", views.event_cancel),
    path("events/<int:pk>/report/", views.event_report),
]
