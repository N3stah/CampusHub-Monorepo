import logging
from django.http import JsonResponse
from django_ratelimit.exceptions import Ratelimited

logger = logging.getLogger(__name__)

def handler500(request):
    logger.exception("Unhandled server error on %s %s", request.method, request.path)
    return JsonResponse({"error": "Internal server error"}, status=500)

def handler404(request, exception=None):
    return JsonResponse({"error": "Not found"}, status=404)

def handler403(request, exception=None):
    if isinstance(exception, Ratelimited):
        return JsonResponse({"error": "Too many requests. Please try again later."}, status=429)
    return JsonResponse({"error": "Forbidden"}, status=403)
