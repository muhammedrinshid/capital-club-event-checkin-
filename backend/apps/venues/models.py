from django.db import models


class Room(models.Model):
    name = models.CharField(max_length=100, unique=True)
    floor = models.CharField(max_length=40, blank=True)
    capacity = models.PositiveIntegerField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name
