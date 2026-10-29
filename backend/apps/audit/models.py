from django.conf import settings
from django.db import models


class ActivityLog(models.Model):
    class Action(models.TextChoices):
        LOGIN = "login"
        LOGIN_FAILED = "login_failed"
        RECEPTION_UNLOCK = "reception_unlock"
        RECEPTION_UNLOCK_FAILED = "reception_unlock_failed"
        EVENT_CREATED = "event_created"
        EVENT_UPDATED = "event_updated"
        EVENT_CANCELLED = "event_cancelled"
        GUEST_ADDED = "guest_added"
        GUEST_BULK_IMPORT = "guest_bulk_import"
        WALKIN_ADDED = "walkin_added"
        GUEST_REMOVED = "guest_removed"
        CHECK_IN = "check_in"
        UNDO_CHECK_IN = "undo_check_in"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    action = models.CharField(max_length=40, choices=Action.choices, db_index=True)
    event = models.ForeignKey("events.Event", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    guest = models.ForeignKey("guests.Guest", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    guest_name = models.CharField(max_length=200, blank=True)     # snapshot, survives guest deletion
    metadata = models.JSONField(default=dict, blank=True)         # e.g. {"mode": "reception"}
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["event", "-created_at"])]


def log_activity(action, *, user=None, event=None, guest=None, **metadata):
    return ActivityLog.objects.create(
        user=user if getattr(user, "pk", None) else None, action=action, event=event, guest=guest,
        guest_name=guest.full_name if guest else "", metadata=metadata)
