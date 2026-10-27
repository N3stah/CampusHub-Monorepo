import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from apps.accounts.jwt_utils import jwt_required
from .models import Notification
from apps.common.pagination import paginate_queryset

def format_notification(n):
    return {
        "id": n.id,
        "verb": n.verb,
        "message": n.message,
        "link": n.link,
        "is_read": n.is_read,
        "created_at": n.created_at.isoformat(),
        "actor": {
            "id": n.actor.id,
            "name": n.actor.get_full_name()
        } if n.actor else None
    }

@csrf_exempt
@require_http_methods(["GET"])
@jwt_required
def notification_list(request):
    user = request.user
    notifications = Notification.objects.filter(recipient=user).select_related('actor')
    
    if request.GET.get('unread') == 'true':
        notifications = notifications.filter(is_read=False)
        
    return paginate_queryset(notifications, request, format_notification)

@csrf_exempt
@require_http_methods(["PATCH"])
@jwt_required
def mark_notification_read(request, pk):
    user = request.user
    try:
        # Use get() to fetch the specific notification.
        # If it doesn't exist OR doesn't belong to the user, it raises DoesNotExist.
        notification = Notification.objects.get(pk=pk, recipient=user)
    except Notification.DoesNotExist:
        return JsonResponse({"error": "Notification not found"}, status=404)
        
    if not notification.is_read:
        notification.is_read = True
        notification.save(update_fields=['is_read'])
        
    return JsonResponse(format_notification(notification))

@csrf_exempt
@require_http_methods(["PATCH"])
@jwt_required
def mark_all_notifications_read(request):
    user = request.user
    # Update all unread notifications for this user in a single query
    count = Notification.objects.filter(recipient=user, is_read=False).update(is_read=True)
    return JsonResponse({"message": f"Marked {count} notifications as read"})

@csrf_exempt
@require_http_methods(["GET"])
@jwt_required
def unread_notification_count(request):
    user = request.user
    # Use a lightweight count() query - no joins, no serialization
    count = Notification.objects.filter(recipient=user, is_read=False).count()
    return JsonResponse({"count": count})
