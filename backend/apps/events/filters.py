import django_filters as df
from .models import Event


class EventFilter(df.FilterSet):
    date_from = df.DateFilter(field_name="date", lookup_expr="gte")
    date_to = df.DateFilter(field_name="date", lookup_expr="lte")

    class Meta:
        model = Event
        fields = ["date", "host", "room", "coordinator", "status"]
