import uuid

from django.conf import settings
from django.db import models

from apps.core.utils import normalize_name


class Guest(models.Model):
    """A person invited to ONE event. Only full_name is mandatory (hosts supply patchy data)."""
    event = models.ForeignKey("events.Event", on_delete=models.CASCADE, related_name="guests")
    full_name = models.CharField(max_length=200)
    name_key = models.CharField(max_length=200, editable=False)    # normalised full_name; unique per event
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=40, blank=True)
    company = models.CharField(max_length=150, blank=True)
    title = models.CharField(max_length=150, blank=True)

    is_walk_in = models.BooleanField(default=False, db_index=True)
    qr_token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)   # ready for QR check-in later

    checked_in_at = models.DateTimeField(null=True, blank=True, db_index=True)
    checked_in_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["full_name"]
        constraints = [models.UniqueConstraint(fields=["event", "name_key"], name="guest_unique_name_per_event")]
        indexes = [models.Index(fields=["event", "name_key"])]

    def save(self, *args, **kwargs):
        self.full_name = " ".join(self.full_name.split())
        self.name_key = normalize_name(self.full_name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.full_name

    @property
    def is_checked_in(self):
        return self.checked_in_at is not None
