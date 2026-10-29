from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.accounts.permissions import IsAdminRole
from apps.core.utils import apply_filters, apply_search, limit_offset
from .models import ActivityLog
from .serializers import ActivityLogSerializer


@api_view(["GET"])
@permission_classes([IsAdminRole])
def audit_list(request):
    """?action= &event= &user= &search=guest name &limit= &offset="""
    qs = ActivityLog.objects.select_related("user", "event")
    qs = apply_filters(qs, request, {"action": "action", "event": "event_id", "user": "user_id"})
    qs = apply_search(qs, request, ["guest_name"])
    return Response(ActivityLogSerializer(limit_offset(qs, request), many=True).data)
