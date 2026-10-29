from django.contrib.postgres.operations import BtreeGistExtension
from django.db import migrations


class Migration(migrations.Migration):
    """Needed for the room double-booking exclusion constraint on events."""
    dependencies = []
    operations = [BtreeGistExtension()]
