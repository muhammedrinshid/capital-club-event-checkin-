from django.db.models import ProtectedError
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsAdminOrCoordinator, IsAdminRole, require
from apps.core.utils import apply_filters
from .models import Room
from .serializers import RoomSerializer


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def rooms_list(request):
    """GET: admin + coordinators (?is_active=true).  POST: admin only."""
    if request.method == "GET":
        require(request, IsAdminOrCoordinator)
        qs = apply_filters(Room.objects.all(), request, {"is_active": "is_active"})
        return Response(RoomSerializer(qs, many=True).data)
    require(request, IsAdminRole)
    s = RoomSerializer(data=request.data)
    s.is_valid(raise_exception=True)
    s.save()
    return Response(s.data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def room_detail(request, pk):
    room = get_object_or_404(Room, pk=pk)
    if request.method == "GET":
        require(request, IsAdminOrCoordinator)
        return Response(RoomSerializer(room).data)
    require(request, IsAdminRole)
    if request.method == "DELETE":
        try:
            room.delete()
        except ProtectedError:          # room has events: archive instead of deleting
            room.is_active = False
            room.save(update_fields=["is_active"])
        return Response(status=status.HTTP_204_NO_CONTENT)
    s = RoomSerializer(room, data=request.data, partial=(request.method == "PATCH"))
    s.is_valid(raise_exception=True)
    s.save()
    return Response(s.data)
