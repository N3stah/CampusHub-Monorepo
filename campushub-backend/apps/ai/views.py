import json
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.utils import timezone
from datetime import timedelta
from apps.accounts.jwt_utils import jwt_required
from apps.ai.models import AIInsight, AIConversation, AIMessage, AITaskLog
from apps.ai.router import AIRouter, EnsembleRouter
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

    router = EnsembleRouter(mode='fallback')  # auto-detects: MockProvider if no key, GeminiProvider if key set
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
    router = EnsembleRouter(mode='fallback')
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


# --- AI Tasks (drafts only — never auto-execute) ---

TASK_REGISTRY = {
    'student': [
        {'type': 'study_plan', 'description': 'Generate a personalized study plan', 'required_params': ['topics']},
        {'type': 'assignment_help', 'description': 'Get hints for an assignment (not the answer)', 'required_params': ['question']},
        {'type': 'placement_match', 'description': 'Find matching placements based on programme + GPA', 'required_params': []},
    ],
    'lecturer': [
        {'type': 'draft_announcement', 'description': 'Draft a course announcement', 'required_params': ['topic']},
        {'type': 'generate_quiz', 'description': 'Generate quiz questions with answers', 'required_params': ['topic']},
        {'type': 'intervention_plan', 'description': 'Suggest intervention for at-risk student', 'required_params': []},
        {'type': 'grade_analysis', 'description': 'Analyze assignment grades + common mistakes', 'required_params': []},
    ],
    'officer': [
        {'type': 'match_students', 'description': 'Match best-fit students to a placement', 'required_params': ['placement_id']},
        {'type': 'outcome_forecast', 'description': 'Forecast placement outcomes', 'required_params': []},
        {'type': 'outreach_email', 'description': 'Draft employer outreach email', 'required_params': ['employer']},
    ],
    'admin': [
        {'type': 'system_report', 'description': 'Generate system health report', 'required_params': []},
        {'type': 'resource_allocation', 'description': 'Suggest resource allocation', 'required_params': []},
        {'type': 'anomaly_detection', 'description': 'Detect unusual patterns', 'required_params': []},
    ],
}

TASK_PROMPTS = {
    'study_plan': "Create a personalized study plan. Topics: {topics}. Include a schedule.",
    'assignment_help': "Provide hints (NOT the answer) for: {question}. Guide the student toward the solution.",
    'placement_match': "Suggest suitable placements based on the student's programme and GPA.",
    'draft_announcement': "Draft a course announcement about: {topic}. Professional tone, under 200 words.",
    'generate_quiz': "Generate 5 quiz questions about: {topic}. Include correct answers marked.",
    'intervention_plan': "Suggest intervention steps for an at-risk student based on the lecturer's data.",
    'grade_analysis': "Analyze the grade distribution and suggest improvements. Identify common mistakes.",
    'match_students': "Suggest the best-fit students for placement ID: {placement_id}. Rank by GPA and relevance.",
    'outcome_forecast': "Forecast placement outcomes for the next cycle based on current data.",
    'outreach_email': "Draft a professional outreach email to {employer} about a placement opportunity.",
    'system_report': "Generate a system health report based on the admin context data.",
    'resource_allocation': "Suggest resource allocation — which courses need more support based on the data.",
    'anomaly_detection': "Detect any unusual patterns in the data (grade inflation, attendance drops, etc.).",
}


def _execute_task(user, task_type, params):
    """Execute an AI task. Returns DRAFT only — never saves/sends anything."""
    from apps.ai.context_builder import build_feed_context
    import json as _json
    context = build_feed_context(user)
    system_prompt = (
        f"You are CampusHub AI assisting a {context['role']}. "
        f"User context: {_json.dumps(context, default=str)}. "
        f"Generate a DRAFT for the task '{task_type}'. "
        f"This is a DRAFT only — the user will review and apply it through the existing system."
    )
    template = TASK_PROMPTS.get(task_type, f"Execute task: {task_type}")
    user_prompt = template.format(**{k: params.get(k, '') for k in params}) if params else template
    mode = "reasoning" if user.role == "admin" else "chain"
    router = EnsembleRouter(mode=mode)
    result = router.generate(user_prompt, system_prompt=system_prompt)
    # Log the task
    AITaskLog.objects.create(
        user=user, task_type=task_type,
        input_summary=_json.dumps(params, default=str)[:500],
        output_summary=result['content'][:500],
        provider=result['provider'], success=result['error'] is None,
    )
    return result


@csrf_exempt
@require_http_methods(["GET"])
@jwt_required
def ai_tasks_list(request):
    """GET /api/ai/tasks/ — list available tasks for the user's role."""
    user = request.user
    tasks = TASK_REGISTRY.get(user.role, [])
    return JsonResponse({'count': len(tasks), 'results': tasks})


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def ai_task_execute(request):
    """POST /api/ai/task/ — execute an AI task. Returns DRAFT only.
    The user must manually apply the result through the existing endpoint."""
    import json as _json
    user = request.user
    try:
        data = _json.loads(request.body)
        task_type = data.get('task_type')
        params = data.get('params', {})
    except (_json.JSONDecodeError, TypeError):
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    if not task_type:
        return JsonResponse({'error': 'task_type is required'}, status=400)
    # Check task is available for this role
    available = TASK_REGISTRY.get(user.role, [])
    if not any(t['type'] == task_type for t in available):
        return JsonResponse({'error': f'Task not available for role: {user.role}'}, status=403)
    result = _execute_task(user, task_type, params)
    return JsonResponse({
        'task_type': task_type,
        'draft': result['content'],
        'provider': result['provider'],
        'warning': 'This is a DRAFT. Review and apply through the existing endpoint.',
    })


# --- AI Analytics (admin-only) ---

@csrf_exempt
@require_http_methods(["GET"])
@jwt_required
def ai_analytics(request):
    """GET /api/ai/analytics/ — admin-only. Usage stats + model status.
    Honestly reports 'not yet trained: N/200 rows' when models are untrained."""
    import os
    from django.utils import timezone
    from datetime import timedelta
    user = request.user
    if user.role != 'admin':
        return JsonResponse({'error': 'Admin only'}, status=403)

    min_rows = getattr(settings, 'AI_AT_RISK_MIN_TRAINING_ROWS', 200)
    from apps.academics.models import AttendanceRecord
    from apps.placements.models import Application

    # AI usage stats
    total_logs = AITaskLog.objects.count()
    logs_today = AITaskLog.objects.filter(created_at__gte=timezone.now() - timedelta(hours=24)).count()
    by_provider = {}
    for log in AITaskLog.objects.all():
        by_provider[log.provider] = by_provider.get(log.provider, 0) + 1

    # Model status
    at_risk_rows = AttendanceRecord.objects.count()
    at_risk_offerings = AttendanceRecord.objects.values('session__offering_id').distinct().count()
    placement_rows = Application.objects.count()

    ml_dir = os.path.join(settings.BASE_DIR, 'apps', 'ai', 'ml_models')
    at_risk_trained = os.path.exists(os.path.join(ml_dir, 'at_risk_model.pkl'))
    placement_trained = os.path.exists(os.path.join(ml_dir, 'placement_model.pkl'))

    return JsonResponse({
        'usage': {
            'total_task_calls': total_logs,
            'calls_today': logs_today,
            'by_provider': by_provider,
        },
        'models': {
            'at_risk': {
                'trained': at_risk_trained,
                'available_rows': at_risk_rows,
                'required_rows': min_rows,
                'available_offerings': at_risk_offerings,
                'required_offerings': 3,
                'status': 'trained' if at_risk_trained else f'not yet trained: {at_risk_rows}/{min_rows} rows, {at_risk_offerings}/3 offerings',
            },
            'placement': {
                'trained': placement_trained,
                'available_rows': placement_rows,
                'required_rows': min_rows,
                'status': 'trained' if placement_trained else f'not yet trained: {placement_rows}/{min_rows} rows',
            },
        },
    })
