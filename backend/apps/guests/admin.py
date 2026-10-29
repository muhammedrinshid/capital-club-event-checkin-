from django.contrib import admin
from .models import Guest


@admin.register(Guest)
class GuestAdmin(admin.ModelAdmin):
    list_display = ["full_name", "event", "company", "is_walk_in", "checked_in_at"]
    list_filter = ["is_walk_in", "event"]
    search_fields = ["full_name", "email", "company"]
