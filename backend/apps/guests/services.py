from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from django.db import transaction

from apps.audit.models import ActivityLog, log_activity
from apps.core.utils import normalize_name
from .models import Guest


def bulk_import(event, rows, user, dry_run=False):
    """Create guests from parsed CSV rows. Duplicates (same name in event or file) are skipped, not fatal."""
    seen = set(Guest.objects.filter(event=event).values_list("name_key", flat=True))
    to_create, skipped, errors = [], [], []
    for i, row in enumerate(rows, start=2):          # row 1 is the header
        name = " ".join((row.get("full_name") or "").split())
        if not name:
            errors.append({"row": i, "error": "full_name is required"})
            continue
        email = row.get("email", "")
        if email:
            try:
                validate_email(email)
            except DjangoValidationError:
                errors.append({"row": i, "name": name, "error": "invalid email"})
                continue
        key = normalize_name(name)
        if key in seen:
            skipped.append({"row": i, "name": name, "reason": "duplicate name in this event"})
            continue
        seen.add(key)
        to_create.append(Guest(event=event, full_name=name, email=email, phone=row.get("phone", ""),
                               company=row.get("company", ""), title=row.get("title", ""), created_by=user))
    if not dry_run and to_create:
        with transaction.atomic():
            for g in to_create:      # save() normalises name_key (bulk_create would skip it)
                g.save()
        log_activity(ActivityLog.Action.GUEST_BULK_IMPORT, user=user, event=event, created=len(to_create),
                     skipped=len(skipped), errors=len(errors))
    return {"dry_run": dry_run, "created": len(to_create), "skipped": skipped, "errors": errors}
