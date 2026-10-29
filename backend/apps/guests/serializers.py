from rest_framework import serializers

from apps.core.utils import normalize_name
from .models import Guest


class GuestSerializer(serializers.ModelSerializer):
    checked_in = serializers.BooleanField(source="is_checked_in", read_only=True)

    class Meta:
        model = Guest
        fields = ["id", "full_name", "email", "phone", "company", "title", "is_walk_in",
                  "checked_in", "checked_in_at", "qr_token", "created_at"]
        read_only_fields = ["is_walk_in", "checked_in_at", "qr_token", "created_at"]

    def validate_full_name(self, value):
        value = " ".join(value.split())
        if not value:
            raise serializers.ValidationError("Name is required.")
        event = self.context["event"]
        qs = Guest.objects.filter(event=event, name_key=normalize_name(value))
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("A guest with this name already exists in this event.")
        return value


class BulkUploadSerializer(serializers.Serializer):
    file = serializers.FileField()
    dry_run = serializers.BooleanField(required=False, default=False)
