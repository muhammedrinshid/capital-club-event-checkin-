from datetime import datetime
from pathlib import Path

from django.conf import settings
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsAdminRole, require
from apps.events.models import Event
from .models import SiteSettings
from .serializers import SiteSettingsSerializer


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def site_settings(request):
    obj = SiteSettings.load()
    if request.method == "GET":
        return Response(SiteSettingsSerializer(obj).data)
    require(request, IsAdminRole)
    s = SiteSettingsSerializer(obj, data=request.data, partial=True)
    s.is_valid(raise_exception=True)
    s.save()
    return Response(s.data)


def _used_files():
    return set(Event.objects.exclude(poster="").exclude(poster__isnull=True).values_list("poster", flat=True))


@api_view(["GET", "DELETE", "POST"])
@permission_classes([IsAdminRole])
def media_files(request):
    """GET = list uploads | DELETE ?path=... = delete one unused file | POST = delete ALL unused files."""
    root = Path(settings.MEDIA_ROOT)
    used = _used_files()

    if request.method == "GET":
        files, total, unused = [], 0, 0
        if root.exists():
            for p in sorted(root.rglob("*")):
                if not p.is_file():
                    continue
                rel = p.relative_to(root).as_posix()
                st = p.stat()
                in_use = rel in used
                total += st.st_size
                unused += 0 if in_use else st.st_size
                files.append({
                    "path": rel, "url": request.build_absolute_uri(settings.MEDIA_URL + rel),
                    "size": st.st_size, "in_use": in_use,
                    "modified": datetime.fromtimestamp(st.st_mtime, tz=timezone.get_current_timezone()),
                })
        return Response({"files": files, "total_bytes": total, "unused_bytes": unused})

    if request.method == "DELETE":
        rel = request.query_params.get("path", "")
        if rel in used:
            return Response({"detail": "File is used by an event."}, status=409)
        target = (root / rel).resolve()
        if root.resolve() not in target.parents or not target.is_file():   # blocks ../ tricks
            return Response({"detail": "File not found."}, status=404)
        target.unlink()
        return Response(status=204)

    removed = freed = 0                                                     # POST
    for p in list(root.rglob("*")) if root.exists() else []:
        if p.is_file() and p.relative_to(root).as_posix() not in used:
            freed += p.stat().st_size
            p.unlink()
            removed += 1
    return Response({"removed": removed, "freed_bytes": freed})
