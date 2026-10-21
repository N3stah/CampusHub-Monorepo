"""
Single reference point for CampusHub's full API surface.
Does not replace config/urls.py (which remains the actual router) — this
file exists so there is one place that documents every mounted endpoint
group, for the mentor review and for onboarding.
"""
from django.http import JsonResponse
from django.urls import path, include

# Status code conventions used across every app in this project.
# Every view returns JsonResponse with one of these shapes:
#   success:        {"count": N, "results": [...]}        (list endpoints)
#                    {<resource fields>}                    (detail/create)
#   client error:    {"error": "<message>"}                 4xx
#   server error:    {"error": "internal server error"}      500 (never a traceback)
HTTP_OK = 200
HTTP_CREATED = 201
HTTP_BAD_REQUEST = 400
HTTP_UNAUTHORIZED = 401
HTTP_FORBIDDEN = 403
HTTP_NOT_FOUND = 404
HTTP_METHOD_NOT_ALLOWED = 405
HTTP_INTERNAL_ERROR = 500


def health_check(request):
    """Lightweight endpoint for Render health checks / uptime monitors."""
    return JsonResponse({"status": "ok"})


API_URL_GROUPS = [
    path('health/', health_check, name='health-check'),
    path('auth/', include('apps.accounts.urls')),
    path('', include('apps.accounts.user_urls')),
    path('academics/', include('apps.academics.urls')),
    path('resources/', include('apps.resources.urls')),
    path('', include('apps.placements.urls')),
    path('', include('apps.notifications.urls')),
]
