import json
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.utils import timezone
from datetime import timedelta
from apps.accounts.jwt_utils import jwt_required
from apps.ai.models import AIInsight, AIConversation, AIMessage
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


# --- AI Chat ---

def _build_chat_system_prompt(user):
    """Build role-specific system prompt. Reuses context_builder.
    CRITICAL: Only includes the requesting user's own data — never another student's."""
    from apps.ai.context_builder import build_feed_context
    import json
    context = build_feed_context(user)
    return (
        f"You are CampusHub AI, an educational assistant for a university portal. "
        f"You are assisting a {context['role']}. "
        f"User context: {json.dumps(context, default=str)}. "
        f"Provide helpful, concise responses. Never share another student's personal data. "
        f"Keep responses under 200 words unless specifically asked for detail."
    )


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def ai_chat(request):
    """POST /api/ai/chat/ — send a message, get AI response. Multi-turn."""
    import json as _json
    user = request.user
    try:
        data = _json.loads(request.body)
        message = data.get('message', '').strip()
        conversation_id = data.get('conversation_id')
    except (_json.JSONDecodeError, TypeError):
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    if not message:
        return JsonResponse({'error': 'message is required'}, status=400)

    # Get or create conversation (only own conversations)
    if conversation_id:
        try:
            conv = AIConversation.objects.get(pk=int(conversation_id), user=user)
        except (AIConversation.DoesNotExist, ValueError):
            return JsonResponse({'error': 'Conversation not found'}, status=404)
    else:
        conv = AIConversation.objects.create(
            user=user, role_context=user.role, title=message[:50]
        )

    # Save user message
    AIMessage.objects.create(conversation=conv, role='user', content=message)

    # Build system prompt + history
    system_prompt = _build_chat_system_prompt(user)
    history = AIMessage.objects.filter(conversation=conv).order_by('created_at')
    history_text = "\n".join([f"{m.role}: {m.content}" for m in history])

    # Call AI (MockProvider in tests, Gemini in prod)
    router = AIRouter()
    result = router.generate(history_text, system_prompt=system_prompt)

    # Save AI response
    ai_msg = AIMessage.objects.create(
        conversation=conv, role='assistant',
        content=result['content'], ai_provider=result['provider'],
    )

    return JsonResponse({
        'conversation_id': conv.id,
        'message': {
            'id': ai_msg.id,
            'role': 'assistant',
            'content': result['content'],
            'provider': result['provider'],
            'created_at': ai_msg.created_at.isoformat(),
        }
    })


@csrf_exempt
@require_http_methods(["GET"])
@jwt_required
def ai_chat_history(request, pk):
    """GET /api/ai/chat/<id>/ — get conversation history (own conversations only)."""
    user = request.user
    try:
        conv = AIConversation.objects.get(pk=pk, user=user)
    except AIConversation.DoesNotExist:
        return JsonResponse({'error': 'Conversation not found'}, status=404)
    messages = AIMessage.objects.filter(conversation=conv).order_by('created_at')
    data = [
        {
            'id': m.id, 'role': m.role, 'content': m.content,
            'provider': m.ai_provider if m.role == 'assistant' else None,
            'created_at': m.created_at.isoformat(),
        }
        for m in messages
    ]
    return JsonResponse({
        'conversation_id': conv.id, 'title': conv.title, 'messages': data,
    })
