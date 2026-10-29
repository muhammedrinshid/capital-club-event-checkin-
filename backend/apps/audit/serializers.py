from rest_framework import serializers
from .models import ActivityLog


class ActivityLogSerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source="user.email", read_only=True, default=None)
    event_name = serializers.CharField(source="event.name", read_only=True, default=None)

    class Meta:
        model = ActivityLog
        fields = ["id", "created_at", "action", "user", "user_email", "event", "event_name",
                  "guest", "guest_name", "metadata"]
