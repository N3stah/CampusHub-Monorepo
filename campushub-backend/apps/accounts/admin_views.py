from django.contrib.auth import get_user_model
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from apps.accounts.jwt_utils import jwt_required
from apps.accounts.models import AuditEvent
from apps.placements.models import Application, Placement

User = get_user_model()


@csrf_exempt
@require_http_methods(['GET'])
@jwt_required
def admin_stats(request):
    if request.user.role != 'admin':
        return JsonResponse({'error': 'Only admins can view administration statistics.'}, status=403)

    return JsonResponse({
        'active_users': User.objects.filter(is_active=True).count(),
        'lecturers': User.objects.filter(role='lecturer', is_active=True).count(),
        'open_placements': Placement.objects.filter(is_active=True, deadline__gte=timezone.localdate()).count(),
        'pending_applications': Application.objects.filter(status='pending').count(),
    })


@csrf_exempt
@require_http_methods(['GET'])
@jwt_required
def admin_logs(request):
    if request.user.role != 'admin':
        return JsonResponse({'error': 'Only admins can view administration activity.'}, status=403)

    total = AuditEvent.objects.count()
    events = AuditEvent.objects.select_related('actor')[:50]
    results = [
        {
            'id': event.id,
            'action': event.action,
            'description': event.description,
            'actor': event.actor.get_full_name() if event.actor else 'System',
            'created_at': event.created_at.isoformat(),
        }
        for event in events
    ]
    return JsonResponse({
        'count': total,
        'next': None,
        'previous': None,
        'results': results,
    })
