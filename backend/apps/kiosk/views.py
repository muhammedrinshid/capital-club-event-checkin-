from datetime import date as date_cls

from django.db import transaction
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from apps.accounts.permissions import IsAdminRole, IsKiosk, IsKioskReception, kiosk_mode
from apps.accounts.tokens import reception_token
from apps.audit.models import ActivityLog, log_activity
from apps.core.models import SiteSettings
from apps.core.throttles import UnlockThrottle
from apps.core.utils import apply_search, normalize_name
from apps.events.models import Event
from apps.guests.models import Guest
from .models import KioskProfile
from .serializers import (KioskDeviceSerializer, KioskEventSerializer, UnlockSerializer, WalkInSerializer,
                          serialize_guest)

MAX_RESULTS = 50
MIN_QUERY = 2


def _annotated(qs):
    return qs.select_related("room", "host").annotate(
        guest_count=Count("guests"), checked_in_count=Count("guests", filter=Q(guests__checked_in_at__isnull=False)))


def _kiosk_event(request, pk):
    """Guest mode: only events visible right now (and in this tablet's room). Reception: any scheduled event."""
    mode = kiosk_mode(request)
    qs = Event.objects.select_related("room", "host").filter(status=Event.Status.SCHEDULED)
    if mode != "reception":
        qs = qs.kiosk_visible()
        room_id = getattr(getattr(request.user, "kiosk_profile", None), "room_id", None)
        if room_id:
            qs = qs.filter(room_id=room_id)
    return get_object_or_404(qs, pk=pk)


@api_view(["POST"])
@permission_classes([IsKiosk])
@throttle_classes([UnlockThrottle])
def unlock(request):
    """Re-enter the kiosk account password to enter reception mode (returns a short-lived token)."""
    s = UnlockSerializer(data=request.data)
    s.is_valid(raise_exception=True)
    if not request.user.check_password(s.validated_data["password"]):
        log_activity(ActivityLog.Action.RECEPTION_UNLOCK_FAILED, user=request.user)
        return Response({"detail": "Incorrect password."}, status=status.HTTP_403_FORBIDDEN)
    minutes = SiteSettings.load().reception_unlock_minutes
    log_activity(ActivityLog.Action.RECEPTION_UNLOCK, user=request.user)
    return Response({"reception_access": reception_token(request.user, minutes), "expires_in": minutes * 60})


@api_view(["GET"])
@permission_classes([IsKiosk])
def kiosk_events(request):
    """Guest mode: events whose check-in window is open now.
    Reception mode: ?date=YYYY-MM-DD (default today; other days are view-only)."""
    mode = kiosk_mode(request)
    KioskProfile.objects.filter(user=request.user).update(last_seen_at=timezone.now())
    if mode == "reception":
        try:
            day = date_cls.fromisoformat(request.query_params["date"]) if "date" in request.query_params \
                else timezone.localdate()
        except ValueError:
            raise ValidationError({"date": "Use YYYY-MM-DD."})
        qs = Event.objects.filter(date=day, status=Event.Status.SCHEDULED)
    else:
        qs = Event.objects.kiosk_visible()
        room_id = getattr(getattr(request.user, "kiosk_profile", None), "room_id", None)
        if room_id:
            qs = qs.filter(room_id=room_id)
    data = KioskEventSerializer(_annotated(qs).order_by("starts_at"), many=True, context={"request": request}).data
    return Response({"mode": mode, "server_time": timezone.now(), "events": data})


@api_view(["GET"])
@permission_classes([IsKiosk])
def kiosk_guests(request, event_id):
    """Search guests. Guest mode: >=2 chars (or the full list if the admin allowed it). Reception: everything."""
    mode = kiosk_mode(request)
    event = _kiosk_event(request, event_id)
    q = normalize_name(request.query_params.get("q", ""))
    guests = Guest.objects.filter(event=event)
    if mode != "reception":
        if q and len(q) < MIN_QUERY:
            return Response([])
        if not q and not event.show_guest_list:
            return Response([])          # privacy: names appear only when searched
    if q:
        guests = guests.filter(name_key__contains=q)
    if mode != "reception" or q:
        guests = guests[:MAX_RESULTS]
    return Response([serialize_guest(g, mode, event) for g in guests])


@api_view(["POST"])
@permission_classes([IsKiosk])
@transaction.atomic
def check_in(request, event_id, guest_id):
    event = _kiosk_event(request, event_id)
    if not event.checkin_is_open:
        raise PermissionDenied("Check-in is not open for this event.")
    guest = get_object_or_404(Guest.objects.select_for_update(), pk=guest_id, event=event)
    already = guest.checked_in_at is not None
    if not already:
        guest.checked_in_at = timezone.now()
        guest.checked_in_by = request.user
        guest.save(update_fields=["checked_in_at", "checked_in_by"])
        log_activity(ActivityLog.Action.CHECK_IN, user=request.user, event=event, guest=guest, mode=kiosk_mode(request))
    return Response({"guest": serialize_guest(guest, kiosk_mode(request), event), "already_checked_in": already})


@api_view(["POST"])
@permission_classes([IsKiosk])
@transaction.atomic
def undo_check_in(request, event_id, guest_id):
    """Guest mode: only within the grace window right after check-in. Reception: any time."""
    mode = kiosk_mode(request)
    event = _kiosk_event(request, event_id)
    guest = get_object_or_404(Guest.objects.select_for_update(), pk=guest_id, event=event)
    if guest.checked_in_at is None:
        raise ValidationError("Guest is not checked in.")
    if mode != "reception":
        grace = SiteSettings.load().undo_grace_seconds
        if (timezone.now() - guest.checked_in_at).total_seconds() > grace:
            raise PermissionDenied("Undo period has passed. Please ask reception.")
    guest.checked_in_at = None
    guest.checked_in_by = None
    guest.save(update_fields=["checked_in_at", "checked_in_by"])
    log_activity(ActivityLog.Action.UNDO_CHECK_IN, user=request.user, event=event, guest=guest, mode=mode)
    return Response({"guest": serialize_guest(guest, mode, event)})


@api_view(["POST"])
@permission_classes([IsKioskReception])
def walk_in(request, event_id):
    """Reception only. Creates the guest flagged as walk-in; check-in is a separate manual step."""
    event = _kiosk_event(request, event_id)
    if event.ends_at <= timezone.now():
        raise ValidationError("This event has ended.")
    s = WalkInSerializer(data=request.data)
    s.is_valid(raise_exception=True)
    name = " ".join(s.validated_data["full_name"].split())
    existing = Guest.objects.filter(event=event, name_key=normalize_name(name)).first()
    if existing:
        return Response({"full_name": ["Already on this event's list."], "existing_guest_id": existing.id},
                        status=status.HTTP_409_CONFLICT)
    guest = Guest(event=event, is_walk_in=True, created_by=request.user, **s.validated_data)
    guest.save()
    log_activity(ActivityLog.Action.WALKIN_ADDED, user=request.user, event=event, guest=guest)
    return Response(serialize_guest(guest, "reception", event), status=status.HTTP_201_CREATED)


@api_view(["GET", "POST"])
@permission_classes([IsAdminRole])
def devices_list(request):
    """Admin: list / create tablet logins (each has its own email + password)."""
    if request.method == "GET":
        qs = KioskProfile.objects.select_related("user", "room")
        qs = apply_search(qs, request, ["label", "user__email"])
        return Response(KioskDeviceSerializer(qs, many=True).data)
    s = KioskDeviceSerializer(data=request.data)
    s.is_valid(raise_exception=True)
    s.save()
    return Response(s.data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
@permission_classes([IsAdminRole])
def device_detail(request, pk):
    profile = get_object_or_404(KioskProfile.objects.select_related("user", "room"), pk=pk)
    if request.method == "GET":
        return Response(KioskDeviceSerializer(profile).data)
    if request.method == "DELETE":
        profile.user.is_active = False          # logs the tablet out immediately
        profile.user.save(update_fields=["is_active"])
        return Response(status=status.HTTP_204_NO_CONTENT)
    s = KioskDeviceSerializer(profile, data=request.data, partial=(request.method == "PATCH"))
    s.is_valid(raise_exception=True)
    s.save()
    return Response(s.data)
