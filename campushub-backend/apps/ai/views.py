import json
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.utils import timezone
from datetime import timedelta
from apps.accounts.jwt_utils import jwt_required
from apps.ai.models import AIInsight
from apps.ai.router import AIRouter
from apps.ai.context_builder import build_feed_context


@csrf_exempt
@require_http_methods(["GET"])
@jwt_required
def ai_feed(request):
    user = request.user
    cache_ttl = getattr(settings, 'AI_FEED_CACHE_HOURS', 24)
    now = timezone.now()

    # Check for cached insight (within TTL)
    cached = AIInsight.objects.filter(
        user=user,
        insight_type='daily_feed',
        generated_at__gte=now - timedelta(hours=cache_ttl)
    ).first()

    if cached:
        return JsonResponse({
            'feed': cached.content,
            'cached': True,
            'generated_at': cached.generated_at.isoformat(),
        })

    # Build context and call AI
    context = build_feed_context(user)
    system_prompt = (
        "You are CampusHub AI, an educational assistant for a university portal. "
        "Provide a concise, encouraging daily summary based on the user's data. "
        "Include 2-3 actionable recommendations. Keep it under 200 words."
    )
    user_prompt = f"User context (JSON): {json.dumps(context, default=str)}\n\nGenerate a daily feed summary for this user."

    router = AIRouter()  # auto-detects: MockProvider if no key, GeminiProvider if key set
    result = router.generate(user_prompt, system_prompt=system_prompt)

    feed_content = {
        'summary': result['content'],
        'provider': result['provider'],
        'context_role': context['role'],
    }

    insight = AIInsight.objects.create(
        user=user,
        insight_type='daily_feed',
        content=feed_content,
        expires_at=now + timedelta(hours=cache_ttl),
    )

    return JsonResponse({
        'feed': feed_content,
        'cached': False,
        'generated_at': insight.generated_at.isoformat(),
    })
