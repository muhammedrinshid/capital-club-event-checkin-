from datetime import datetime

from django.db import IntegrityError
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import User
from apps.accounts.permissions import IsAdminOrCoordinator, IsAdminRole, require
from apps.audit.models import ActivityLog, log_activity
from apps.core import reports
from apps.core.utils import apply_filters, apply_search
from apps.guests.models import Guest
from apps.venues.models import Room
from .models import Event
from .serializers import EventSerializer

FORM_PARSERS = [MultiPartParser, FormParser, JSONParser]     # multipart = poster upload


def events_for(user):
    """Admin sees all events (with guest counts); a coordinator only their own."""
    qs = Event.objects.select_related("room", "host", "coordinator").annotate(
        guest_count=Count("guests"),
        checked_in_count=Count("guests", filter=Q(guests__checked_in_at__isnull=False)),
        walk_in_count=Count("guests", filter=Q(guests__is_walk_in=True)),
    )
    return qs.filter(coordinator=user) if user.role == User.Role.COORDINATOR else qs


def filter_events(qs, request):
    """?date= &date_from= &date_to= &host= &room= &coordinator= &status= &search="""
    qs = apply_filters(qs, request, {
        "date": "date", "date_from": "date__gte", "date_to": "date__lte",
        "host": "host_id", "room": "room_id", "coordinator": "coordinator_id", "status": "status"})
    return apply_search(qs, request, ["name", "host__full_name", "room__name"])


def save_event(serializer, **extra):
    try:
        return serializer.save(**extra)
    except IntegrityError:    # race: the DB exclusion constraint caught a double booking
        raise ValidationError({"room": ["This room is already booked at that time."]})


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
@parser_classes(FORM_PARSERS)
def events_list(request):
    """GET: admin + coordinator.  POST (create event): admin only."""
    if request.method == "GET":
        require(request, IsAdminOrCoordinator)
        qs = filter_events(events_for(request.user), request)
        return Response(EventSerializer(qs, many=True, context={"request": request}).data)
    require(request, IsAdminRole)
    s = EventSerializer(data=request.data, context={"request": request})
    s.is_valid(raise_exception=True)
    event = save_event(s, created_by=request.user)
    log_activity(ActivityLog.Action.EVENT_CREATED, user=request.user, event=event)
    return Response(EventSerializer(events_for(request.user).get(pk=event.pk), context={"request": request}).data,
                    status=status.HTTP_201_CREATED)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
@parser_classes(FORM_PARSERS)
def event_detail(request, pk):
    event = get_object_or_404(events_for(request.user), pk=pk)
    if request.method == "GET":
        require(request, IsAdminOrCoordinator)
        return Response(EventSerializer(event, context={"request": request}).data)

    require(request, IsAdminRole)
    if request.method == "DELETE":
        if event.guests.filter(checked_in_at__isnull=False).exists():
            raise ValidationError("This event has check-ins. Cancel it instead of deleting.")
        event.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    s = EventSerializer(event, data=request.data, partial=(request.method == "PATCH"), context={"request": request})
    s.is_valid(raise_exception=True)
    save_event(s)
    log_activity(ActivityLog.Action.EVENT_UPDATED, user=request.user, event=event)
    return Response(EventSerializer(events_for(request.user).get(pk=pk), context={"request": request}).data)


@api_view(["POST"])
@permission_classes([IsAdminRole])
def event_cancel(request, pk):
    event = get_object_or_404(events_for(request.user), pk=pk)
    event.status = Event.Status.CANCELLED
    event.save(update_fields=["status", "updated_at"])
    log_activity(ActivityLog.Action.EVENT_CANCELLED, user=request.user, event=event)
    return Response(EventSerializer(event, context={"request": request}).data)


@api_view(["GET"])
@permission_classes([IsAdminRole])
def event_check_conflict(request):
    """?room= &date=YYYY-MM-DD &start_time=HH:MM &end_time=HH:MM &exclude=<event id>"""
    p = request.query_params
    try:
        probe = Event(date=datetime.strptime(p["date"], "%Y-%m-%d").date(),
                      start_time=datetime.strptime(p["start_time"][:5], "%H:%M").time(),
                      end_time=datetime.strptime(p["end_time"][:5], "%H:%M").time(), checkin_minutes_before=0)
    except (KeyError, ValueError):
        raise ValidationError("date (YYYY-MM-DD), start_time and end_time (HH:MM) are required.")
    probe.compute_times()
    overlap = Event.objects.overlapping(probe.starts_at, probe.ends_at)
    if p.get("exclude"):
        overlap = overlap.exclude(pk=p["exclude"])
    conflicts = overlap.filter(room_id=p["room"]) if p.get("room") else overlap.none()
    free = Room.objects.filter(is_active=True).exclude(pk__in=overlap.values("room"))
    return Response({
        "has_conflict": conflicts.exists(),
        "conflicts": [{"id": e.id, "name": e.name, "start_time": e.start_time, "end_time": e.end_time}
                      for e in conflicts],
        "free_rooms": [{"id": r.id, "name": r.name} for r in free],
    })


def _report(request, events, filename, title, multi):
    guests = (Guest.objects.filter(event__in=events).select_related("event")
              .order_by("event__starts_at", "full_name"))
    if request.query_params.get("type") == "pdf":
        return reports.pdf_response(guests, filename, title, multi)
    return reports.csv_response(guests, filename, multi)


@api_view(["GET"])
@permission_classes([IsAdminOrCoordinator])
def event_report(request, pk):
    """Attendance for one event: ?type=csv|pdf"""
    event = get_object_or_404(events_for(request.user), pk=pk)
    return _report(request, Event.objects.filter(pk=event.pk), f"attendance-{event.date}-{event.pk}",
                   f"{event.name} - {event.date}", multi=False)


@api_view(["GET"])
@permission_classes([IsAdminOrCoordinator])
def events_report_all(request):
    """Attendance for every event matching the filters (date_from, host, room, ...): ?type=csv|pdf"""
    events = filter_events(events_for(request.user), request)
    return _report(request, events, "attendance-report", "Attendance report", multi=True)
