from datetime import datetime, timedelta

from django.conf import settings
from django.contrib.postgres.constraints import ExclusionConstraint
from django.contrib.postgres.fields import DateTimeRangeField, RangeBoundary, RangeOperators
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Func, Q
from django.utils import timezone

DISPLAY_FIELD_CHOICES = {"company", "title", "email", "phone"}


class TsTzRange(Func):
    function = "TSTZRANGE"
    output_field = DateTimeRangeField()


class EventQuerySet(models.QuerySet):
    def kiosk_visible(self, now=None):
        """Events a kiosk should show: from check-in opening until the event ends."""
        now = now or timezone.now()
        return self.filter(status=Event.Status.SCHEDULED, checkin_opens_at__lte=now, ends_at__gt=now)

    def overlapping(self, starts_at, ends_at):
        return self.filter(status=Event.Status.SCHEDULED, starts_at__lt=ends_at, ends_at__gt=starts_at)


class Event(models.Model):
    class Status(models.TextChoices):
        SCHEDULED = "scheduled"
        CANCELLED = "cancelled"

    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    room = models.ForeignKey("venues.Room", on_delete=models.PROTECT, related_name="events")
    date = models.DateField(db_index=True)
    start_time = models.TimeField()
    end_time = models.TimeField()
    # Derived from date + times (Asia/Dubai) on save; used for fast queries and the DB clash constraint.
    starts_at = models.DateTimeField(editable=False, db_index=True)
    ends_at = models.DateTimeField(editable=False, db_index=True)
    checkin_minutes_before = models.PositiveSmallIntegerField(default=60)
    checkin_opens_at = models.DateTimeField(editable=False, db_index=True)

    host = models.ForeignKey("members.Member", null=True, blank=True, on_delete=models.SET_NULL, related_name="hosted_events")
    coordinator = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
                                    related_name="coordinated_events")
    poster = models.ImageField(upload_to="events/posters/", null=True, blank=True)

    # Kiosk privacy controls
    show_guest_list = models.BooleanField(default=False, help_text="Kiosk shows the full list (else names only when searched).")
    kiosk_display_fields = models.JSONField(default=list, blank=True,
                                            help_text="Extra guest fields shown beside the name: company, title, email, phone.")

    status = models.CharField(max_length=12, choices=Status.choices, default=Status.SCHEDULED, db_index=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = EventQuerySet.as_manager()

    class Meta:
        ordering = ["starts_at"]
        constraints = [
            models.CheckConstraint(condition=Q(end_time__gt=models.F("start_time")), name="event_end_after_start"),
            ExclusionConstraint(
                name="event_no_room_overlap",
                expressions=[(TsTzRange("starts_at", "ends_at", RangeBoundary()), RangeOperators.OVERLAPS),
                             ("room", RangeOperators.EQUAL)],
                condition=Q(status="scheduled"),
            ),
        ]
        indexes = [models.Index(fields=["date", "room"])]

    def __str__(self):
        return f"{self.name} ({self.date})"

    def compute_times(self):
        tz = timezone.get_current_timezone()
        self.starts_at = timezone.make_aware(datetime.combine(self.date, self.start_time), tz)
        self.ends_at = timezone.make_aware(datetime.combine(self.date, self.end_time), tz)
        self.checkin_opens_at = self.starts_at - timedelta(minutes=self.checkin_minutes_before)

    def clean(self):
        if self.end_time <= self.start_time:
            raise ValidationError("End time must be after start time (single-day events).")
        bad = set(self.kiosk_display_fields) - DISPLAY_FIELD_CHOICES
        if bad:
            raise ValidationError(f"Unknown kiosk display fields: {sorted(bad)}")

    def save(self, *args, **kwargs):
        self.compute_times()
        super().save(*args, **kwargs)

    @property
    def checkin_is_open(self):
        now = timezone.now()
        return self.status == self.Status.SCHEDULED and self.checkin_opens_at <= now < self.ends_at
