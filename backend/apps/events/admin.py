from django.contrib import admin
from .models import Event


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ["name", "date", "start_time", "end_time", "room", "host", "coordinator", "status"]
    list_filter = ["status", "room", "date"]
    search_fields = ["name"]
