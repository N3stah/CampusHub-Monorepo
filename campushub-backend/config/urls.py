from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from apps.common.api_root import API_URL_GROUPS

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(API_URL_GROUPS)),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

handler500 = 'apps.common.error_views.handler500'
handler404 = 'apps.common.error_views.handler404'
handler403 = 'apps.common.error_views.handler403'
