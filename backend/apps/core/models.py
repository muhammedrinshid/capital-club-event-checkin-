from django.db import models


class SiteSettings(models.Model):
    """Singleton (pk=1) with global defaults the admin can change."""
    club_name = models.CharField(max_length=120, default="Capital Club Dubai")
    default_checkin_minutes = models.PositiveSmallIntegerField(
        default=60, help_text="Check-in opens this many minutes before an event starts (default for new events).")
    undo_grace_seconds = models.PositiveSmallIntegerField(
        default=10, help_text="Window in which a guest may undo their own check-in on the kiosk.")
    reception_unlock_minutes = models.PositiveSmallIntegerField(
        default=15, help_text="Lifetime of the reception-mode token after unlocking.")

    class Meta:
        verbose_name_plural = "Site settings"

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return "Site settings"
