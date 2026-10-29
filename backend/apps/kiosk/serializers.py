from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from rest_framework import serializers

from apps.accounts.models import User
from apps.guests.models import Guest
from .models import KioskProfile

OPTIONAL_FIELDS = ("company", "title", "email", "phone")


class KioskEventSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    description = serializers.CharField()
    room_name = serializers.CharField(source="room.name")
    date = serializers.DateField()
    start_time = serializers.TimeField()
    end_time = serializers.TimeField()
    checkin_opens_at = serializers.DateTimeField()
    ends_at = serializers.DateTimeField()
    host_name = serializers.CharField(source="host.full_name", default=None)
    poster = serializers.SerializerMethodField()
    show_guest_list = serializers.BooleanField()
    kiosk_display_fields = serializers.ListField()
    status = serializers.CharField()
    guest_count = serializers.IntegerField(default=0)
    checked_in_count = serializers.IntegerField(default=0)
    can_check_in = serializers.SerializerMethodField()

    def get_poster(self, ev):
        req = self.context.get("request")
        return req.build_absolute_uri(ev.poster.url) if ev.poster and req else None

    def get_can_check_in(self, ev):
        return ev.checkin_is_open


def serialize_guest(g, mode, event):
    """Guest mode sees only the name + fields the admin enabled. Reception sees everything."""
    data = {"id": g.id, "full_name": g.full_name, "checked_in": g.checked_in_at is not None,
            "checked_in_at": g.checked_in_at}
    if mode == "reception":
        data.update({f: getattr(g, f) for f in OPTIONAL_FIELDS}, is_walk_in=g.is_walk_in)
    else:
        data.update({f: getattr(g, f) for f in event.kiosk_display_fields if f in OPTIONAL_FIELDS})
    return data


class UnlockSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True, trim_whitespace=False)


class WalkInSerializer(serializers.ModelSerializer):
    class Meta:
        model = Guest
        fields = ["full_name", "email", "phone", "company", "title"]


class KioskDeviceSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email")
    is_active = serializers.BooleanField(source="user.is_active", required=False)
    password = serializers.CharField(write_only=True, required=False, trim_whitespace=False)

    class Meta:
        model = KioskProfile
        fields = ["id", "label", "email", "password", "room", "is_active", "last_seen_at"]
        read_only_fields = ["last_seen_at"]

    def validate_password(self, v):
        validate_password(v)
        return v

    def validate_email(self, v):
        v = v.lower()
        qs = User.objects.filter(email=v)
        if self.instance:
            qs = qs.exclude(pk=self.instance.user_id)
        if qs.exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return v

    @transaction.atomic
    def create(self, validated):
        udata = validated.pop("user")
        pw = validated.pop("password", None)
        if not pw:
            raise serializers.ValidationError({"password": "Required."})
        user = User.objects.create_user(email=udata["email"], password=pw, role=User.Role.KIOSK,
                                        full_name=validated["label"], is_active=udata.get("is_active", True))
        return KioskProfile.objects.create(user=user, **validated)

    @transaction.atomic
    def update(self, instance, validated):
        udata = validated.pop("user", {})
        pw = validated.pop("password", None)
        user = instance.user
        if "email" in udata:
            user.email = udata["email"]
        if "is_active" in udata:
            user.is_active = udata["is_active"]       # deactivating logs the tablet out immediately
        if pw:
            user.set_password(pw)
        if "label" in validated:
            user.full_name = validated["label"]
        user.save()
        for k, v in validated.items():
            setattr(instance, k, v)
        instance.save()
        return instance
