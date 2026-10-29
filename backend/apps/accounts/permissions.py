from rest_framework.permissions import BasePermission
from .models import User


def _claim(request, key, default=None):
    auth = getattr(request, "auth", None)
    try:
        return auth.get(key, default) if auth is not None else default
    except AttributeError:
        return default


def kiosk_mode(request):
    """'guest' (locked) or 'reception' (unlocked) for kiosk tokens."""
    return _claim(request, "mode", "guest")


class IsAdminRole(BasePermission):
    """Club Admin whose token passed the TOTP step (or who has no way to enrol yet)."""
    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and u.role == User.Role.ADMIN and _claim(request, "otp", False))


class IsAdminOrCoordinator(BasePermission):
    def has_permission(self, request, view):
        u = request.user
        if not (u and u.is_authenticated):
            return False
        if u.role == User.Role.ADMIN:
            return bool(_claim(request, "otp", False))
        return u.role == User.Role.COORDINATOR


class IsKiosk(BasePermission):
    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and u.role == User.Role.KIOSK)


class IsKioskReception(IsKiosk):
    def has_permission(self, request, view):
        return super().has_permission(request, view) and kiosk_mode(request) == "reception"


def can_manage_event(user, event):
    """Admin: any event. Coordinator: only the events assigned to them."""
    return user.role == User.Role.ADMIN or (user.role == User.Role.COORDINATOR and event.coordinator_id == user.id)


def require(request, *permission_classes):
    """Inside a function view: allow if ANY of the given permission classes passes, else 403."""
    from rest_framework.exceptions import PermissionDenied
    if not any(p().has_permission(request, None) for p in permission_classes):
        raise PermissionDenied()
