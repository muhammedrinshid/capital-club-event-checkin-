from rest_framework import serializers

from apps.accounts.models import User
from apps.core.models import SiteSettings
from apps.venues.models import Room
from .models import DISPLAY_FIELD_CHOICES, Event


class EventSerializer(serializers.ModelSerializer):
    room_name = serializers.CharField(source="room.name", read_only=True)
    host_name = serializers.CharField(source="host.full_name", read_only=True, default=None)
    coordinator_name = serializers.CharField(source="coordinator.full_name", read_only=True, default=None)
    guest_count = serializers.IntegerField(read_only=True, default=0)
    checked_in_count = serializers.IntegerField(read_only=True, default=0)
    walk_in_count = serializers.IntegerField(read_only=True, default=0)
    checkin_minutes_before = serializers.IntegerField(required=False, min_value=0, max_value=1440)
    coordinator = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role__in=[User.Role.COORDINATOR, User.Role.ADMIN], is_active=True),
        required=False, allow_null=True)

    class Meta:
        model = Event
        fields = ["id", "name", "description", "room", "room_name", "date", "start_time", "end_time",
                  "starts_at", "ends_at", "checkin_minutes_before", "checkin_opens_at",
                  "host", "host_name", "coordinator", "coordinator_name", "poster",
                  "show_guest_list", "kiosk_display_fields", "status",
                  "guest_count", "checked_in_count", "walk_in_count", "created_at"]
        read_only_fields = ["starts_at", "ends_at", "checkin_opens_at", "status", "created_at"]

    def validate_poster(self, f):
        if f and f.size > 5 * 1024 * 1024:
            raise serializers.ValidationError("Poster must be 5 MB or smaller.")
        return f

    def validate_kiosk_display_fields(self, value):
        bad = set(value) - DISPLAY_FIELD_CHOICES
        if bad:
            raise serializers.ValidationError(f"Allowed: {sorted(DISPLAY_FIELD_CHOICES)}")
        return list(dict.fromkeys(value))

    def validate_room(self, room):
        if not room.is_active:
            raise serializers.ValidationError("This room is archived.")
        return room

    def validate(self, attrs):
        inst = self.instance
        get = lambda k: attrs.get(k, getattr(inst, k, None))
        start, end = get("start_time"), get("end_time")
        if start and end and end <= start:
            raise serializers.ValidationError({"end_time": "End time must be after start time."})

        if inst is None or any(k in attrs for k in ("room", "date", "start_time", "end_time")):
            probe = Event(date=get("date"), start_time=start, end_time=end, checkin_minutes_before=0)
            probe.compute_times()
            clashes = Event.objects.overlapping(probe.starts_at, probe.ends_at).filter(room=get("room"))
            if inst:
                clashes = clashes.exclude(pk=inst.pk)
            if clashes.exists():
                busy = Event.objects.overlapping(probe.starts_at, probe.ends_at).values("room")
                free = Room.objects.filter(is_active=True).exclude(pk__in=busy)
                raise serializers.ValidationError({
                    "room": ["This room is already booked at that time."],
                    "conflicts": [{"id": e.id, "name": e.name, "start_time": e.start_time, "end_time": e.end_time}
                                  for e in clashes],
                    "suggested_rooms": [{"id": r.id, "name": r.name} for r in free],
                })
        return attrs

    def create(self, validated):
        validated.setdefault("checkin_minutes_before", SiteSettings.load().default_checkin_minutes)
        return super().create(validated)
