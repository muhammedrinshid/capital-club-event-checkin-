from django.contrib import admin
from .models import ActivityLog


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ["created_at", "action", "user", "event", "guest_name"]
    list_filter = ["action"]
    def has_add_permission(self, request): return False
    def has_change_permission(self, request, obj=None): return False
