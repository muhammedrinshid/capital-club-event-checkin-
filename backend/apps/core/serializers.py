from rest_framework import serializers
from .models import SiteSettings


class SiteSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteSettings
        fields = ["club_name", "default_checkin_minutes", "undo_grace_seconds", "reception_unlock_minutes"]
