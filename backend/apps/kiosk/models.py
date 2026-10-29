from django.conf import settings
from django.db import models


class KioskProfile(models.Model):
    """One tablet login. The same password unlocks reception mode (re-entered on the device)."""
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="kiosk_profile")
    label = models.CharField(max_length=100, help_text="e.g. 'Main lobby tablet'")
    room = models.ForeignKey("venues.Room", null=True, blank=True, on_delete=models.SET_NULL, related_name="kiosks",
                             help_text="If set, guest mode only shows events in this room.")
    last_seen_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.label
