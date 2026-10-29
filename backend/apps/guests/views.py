from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from apps.accounts.permissions import IsAdminOrCoordinator, can_manage_event
from apps.audit.models import ActivityLog, log_activity
from apps.core.utils import apply_filters, apply_search, read_csv_rows
from apps.events.models import Event
from . import services
from .models import Guest
from .serializers import BulkUploadSerializer, GuestSerializer


def get_managed_event(request, event_pk):
    """Admin: any event. Coordinator: only events assigned to them."""
    event = get_object_or_404(Event, pk=event_pk)
    if not can_manage_event(request.user, event):
        raise PermissionDenied("This event is not assigned to you.")
    return event


@api_view(["GET", "POST"])
@permission_classes([IsAdminOrCoordinator])
@parser_classes([JSONParser, MultiPartParser, FormParser])
def guests_list(request, event_pk):
    """GET ?search= &is_walk_in=   |   POST add one guest (only full_name is required)."""
    event = get_managed_event(request, event_pk)
    if request.method == "GET":
        qs = apply_filters(Guest.objects.filter(event=event), request, {"is_walk_in": "is_walk_in"})
        qs = apply_search(qs, request, ["full_name", "email", "company"])
        return Response(GuestSerializer(qs, many=True).data)
    s = GuestSerializer(data=request.data, context={"event": event})
    s.is_valid(raise_exception=True)
    guest = s.save(event=event, created_by=request.user)
    log_activity(ActivityLog.Action.GUEST_ADDED, user=request.user, event=event, guest=guest)
    return Response(s.data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
@permission_classes([IsAdminOrCoordinator])
def guest_detail(request, event_pk, pk):
    event = get_managed_event(request, event_pk)
    guest = get_object_or_404(Guest, pk=pk, event=event)
    if request.method == "GET":
        return Response(GuestSerializer(guest).data)
    if request.method == "DELETE":
        log_activity(ActivityLog.Action.GUEST_REMOVED, user=request.user, event=event, name=guest.full_name)
        guest.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    s = GuestSerializer(guest, data=request.data, partial=(request.method == "PATCH"), context={"event": event})
    s.is_valid(raise_exception=True)
    s.save()
    return Response(s.data)


@api_view(["POST"])
@permission_classes([IsAdminOrCoordinator])
@parser_classes([MultiPartParser, FormParser])
def guests_bulk_upload(request, event_pk):
    """CSV columns: full_name (required), email, company, phone, title. Send dry_run=true to preview."""
    event = get_managed_event(request, event_pk)
    s = BulkUploadSerializer(data=request.data)
    s.is_valid(raise_exception=True)
    rows = read_csv_rows(s.validated_data["file"])
    return Response(services.bulk_import(event, rows, request.user, s.validated_data["dry_run"]))
