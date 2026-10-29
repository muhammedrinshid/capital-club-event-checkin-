from django.db.models.signals import post_delete, pre_save
from django.dispatch import receiver

from .models import Event


@receiver(pre_save, sender=Event)
def delete_replaced_poster(sender, instance, **kwargs):
    if not instance.pk:
        return
    old = Event.objects.filter(pk=instance.pk).values_list("poster", flat=True).first()
    if old and old != (instance.poster.name if instance.poster else None):
        instance.__class__._meta.get_field("poster").storage.delete(old)


@receiver(post_delete, sender=Event)
def delete_poster_with_event(sender, instance, **kwargs):
    if instance.poster:
        instance.poster.storage.delete(instance.poster.name)
