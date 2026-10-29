from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from two_factor.admin import AdminSiteOTPRequired
from two_factor.urls import urlpatterns as tf_urls

admin.site.__class__ = AdminSiteOTPRequired   # Django admin requires 2FA

urlpatterns = [
    path("", include(tf_urls)),
    path("admin/", admin.site.urls),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/kiosk/", include("apps.kiosk.urls")),
    path("api/", include("apps.core.urls")),
    path("api/", include("apps.members.urls")),
    path("api/", include("apps.venues.urls")),
    path("api/", include("apps.events.urls")),
    path("api/", include("apps.guests.urls")),
    path("api/", include("apps.audit.urls")),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
