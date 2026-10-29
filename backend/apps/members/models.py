from django.db import models


class Member(models.Model):
    """Club member. Not an app user; used as an event host."""
    membership_number = models.CharField(max_length=40, unique=True, null=True, blank=True)
    full_name = models.CharField(max_length=150, db_index=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=40, blank=True)
    company = models.CharField(max_length=150, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["full_name"]

    def __str__(self):
        return self.full_name
