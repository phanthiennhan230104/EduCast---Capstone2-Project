from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("apps.users.urls")),
    path("api/chat/", include("apps.chat.urls")),
    path("api/social/", include("apps.social.urls")),
    path("api/content/", include("apps.content.urls")),
    path("api/ai-services/", include("apps.ai_services.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)