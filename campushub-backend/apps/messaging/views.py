import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.utils import timezone
from django.db import transaction
from apps.accounts.jwt_utils import jwt_required
from apps.accounts.models import User
from apps.academics.models import Offering, UnitTeachingAssignment, Enrollment
from apps.notifications.services import NotificationService
from .models import Conversation, ConversationParticipant, Message


def _is_participant(user, conv):
    return ConversationParticipant.objects.filter(conversation=conv, user=user).exists()


def _can_dm(user_a, user_b):
    if user_a.role == 'admin' or user_b.role == 'admin':
        return True
    if user_a.role == 'student' and user_b.role == 'lecturer':
        student_courses = set(Enrollment.objects.filter(student=user_a, status='active').values_list('course_id', flat=True))
        lecturer_courses = set(Offering.objects.filter(teaching_assignments__lecturer=user_b).values_list('course_id', flat=True))
        return bool(student_courses & lecturer_courses)
    if user_a.role == 'lecturer' and user_b.role == 'student':
        return _can_dm(user_b, user_a)
    return False


def _serialize_message(msg):
    return {
        'id': msg.id,
        'sender_id': msg.sender_id,
        'sender_name': msg.sender.get_full_name(),
        'sender_profile_picture_url': msg.sender.profile_picture.url if msg.sender.profile_picture else None,
        'body': msg.body,
        'created_at': msg.created_at.isoformat(),
        'is_deleted': msg.deleted_at is not None,
    }


def _serialize_conversation(conv, user):
    latest = Message.objects.filter(conversation=conv, deleted_at__isnull=True).order_by('-created_at').first()
    p = ConversationParticipant.objects.filter(conversation=conv, user=user).first()
    unread_qs = Message.objects.filter(conversation=conv, deleted_at__isnull=True).exclude(sender=user)
    if p and p.last_read_at:
        unread_qs = unread_qs.filter(created_at__gt=p.last_read_at)
    data = {
        'id': conv.id,
        'kind': conv.kind,
        'created_at': conv.created_at.isoformat(),
        'unread_count': unread_qs.count(),
        'latest_message': _serialize_message(latest) if latest else None,
    }
    if conv.kind == 'group' and conv.offering:
        data['offering_id'] = conv.offering_id
        data['title'] = f"{conv.offering.unit.code} - {conv.offering.course.code}"
    else:
        other = ConversationParticipant.objects.filter(conversation=conv).exclude(user=user).select_related('user').first()
        data['title'] = other.user.get_full_name() if other else 'Direct'
        data['other_profile_picture_url'] = other.user.profile_picture.url if other and other.user.profile_picture else None
    return data


@csrf_exempt
@require_http_methods(["GET"])
@jwt_required
def conversation_list(request):
    user = request.user
    parts = ConversationParticipant.objects.filter(user=user).select_related('conversation')
    data = [_serialize_conversation(p.conversation, user) for p in parts]
    data.sort(key=lambda x: x['latest_message']['created_at'] if x['latest_message'] else x['created_at'], reverse=True)
    return JsonResponse({'count': len(data), 'results': data})


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def create_direct_conversation(request):
    user = request.user
    try:
        data = json.loads(request.body)
        recipient_id = data.get('recipient_id')
    except (json.JSONDecodeError, TypeError):
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    if not recipient_id:
        return JsonResponse({'error': 'recipient_id is required'}, status=400)
    try:
        recipient = User.objects.get(pk=int(recipient_id))
    except (User.DoesNotExist, ValueError):
        return JsonResponse({'error': 'recipient not found'}, status=404)
    if recipient.id == user.id:
        return JsonResponse({'error': 'Cannot DM yourself'}, status=400)
    if not _can_dm(user, recipient):
        return JsonResponse({'error': 'You can only DM lecturers in your courses or your enrolled students'}, status=403)
    # Get-or-create: find a direct conversation with both users
    existing = Conversation.objects.filter(kind='direct', participants__user=user).filter(participants__user=recipient).distinct()
    conv = existing.first()
    if not conv:
        with transaction.atomic():
            conv = Conversation.objects.create(kind='direct')
            ConversationParticipant.objects.create(conversation=conv, user=user)
            ConversationParticipant.objects.create(conversation=conv, user=recipient)
    return JsonResponse(_serialize_conversation(conv, user))


@csrf_exempt
@require_http_methods(["GET"])
@jwt_required
def group_conversation(request, pk):
    user = request.user
    try:
        offering = Offering.objects.get(pk=pk)
    except Offering.DoesNotExist:
        return JsonResponse({'error': 'Offering not found'}, status=404)
    if user.role == 'admin':
        pass
    elif user.role == 'lecturer':
        if not UnitTeachingAssignment.objects.filter(offering=offering, lecturer=user).exists():
            return JsonResponse({'error': 'Not assigned to this offering'}, status=403)
    elif user.role == 'student':
        if not Enrollment.objects.filter(student=user, course=offering.course, status='active').exists():
            return JsonResponse({'error': 'Not enrolled in this course'}, status=403)
    else:
        return JsonResponse({'error': 'Unsupported role'}, status=403)
    conv, created = Conversation.objects.get_or_create(kind='group', offering=offering)
    # Sync participants
    for ta in UnitTeachingAssignment.objects.filter(offering=offering):
        ConversationParticipant.objects.get_or_create(conversation=conv, user=ta.lecturer, defaults={'is_admin': True})
    for e in Enrollment.objects.filter(course=offering.course, status='active'):
        ConversationParticipant.objects.get_or_create(conversation=conv, user=e.student, defaults={'is_admin': e.is_class_prefect})
    return JsonResponse(_serialize_conversation(conv, user))


@csrf_exempt
@require_http_methods(["GET", "POST"])
@jwt_required
def messages(request, pk):
    user = request.user
    try:
        conv = Conversation.objects.get(pk=pk)
    except Conversation.DoesNotExist:
        return JsonResponse({'error': 'Conversation not found'}, status=404)
    if not _is_participant(user, conv):
        return JsonResponse({'error': 'Not a participant'}, status=403)
    if request.method == 'GET':
        qs = Message.objects.filter(conversation=conv, deleted_at__isnull=True).order_by('created_at')
        after = request.GET.get('after')
        if after:
            try:
                qs = qs.filter(id__gt=int(after))
            except ValueError:
                return JsonResponse({'error': 'after must be an integer'}, status=400)
        data = [_serialize_message(msg) for msg in qs]
        return JsonResponse({'count': len(data), 'results': data})
    else:  # POST
        try:
            data = json.loads(request.body)
            body = data.get('body', '').strip()
        except (json.JSONDecodeError, TypeError):
            return JsonResponse({'error': 'Invalid JSON'}, status=400)
        if not body:
            return JsonResponse({'error': 'body is required'}, status=400)
        msg = Message.objects.create(conversation=conv, sender=user, body=body)
        for p in ConversationParticipant.objects.filter(conversation=conv).exclude(user=user):
            NotificationService.notify(recipient=p.user, verb='message', message=f'New message from {user.get_full_name()}', actor=user)
        return JsonResponse(_serialize_message(msg), status=201)


@csrf_exempt
@require_http_methods(["DELETE"])
@jwt_required
def delete_message(request, pk):
    user = request.user
    try:
        msg = Message.objects.get(pk=pk)
    except Message.DoesNotExist:
        return JsonResponse({'error': 'Message not found'}, status=404)
    if msg.sender_id != user.id:
        p = ConversationParticipant.objects.filter(conversation=msg.conversation, user=user).first()
        if not p or not p.is_admin:
            return JsonResponse({'error': 'Can only delete your own messages'}, status=403)
    msg.deleted_at = timezone.now()
    msg.save(update_fields=['deleted_at'])
    return JsonResponse({'message': 'Message deleted'})


@csrf_exempt
@require_http_methods(["PATCH"])
@jwt_required
def mark_read(request, pk):
    user = request.user
    try:
        conv = Conversation.objects.get(pk=pk)
    except Conversation.DoesNotExist:
        return JsonResponse({'error': 'Conversation not found'}, status=404)
    if not _is_participant(user, conv):
        return JsonResponse({'error': 'Not a participant'}, status=403)
    p = ConversationParticipant.objects.filter(conversation=conv, user=user).first()
    p.last_read_at = timezone.now()
    p.save(update_fields=['last_read_at'])
    return JsonResponse({'message': 'Marked as read'})
