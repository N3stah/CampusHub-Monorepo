import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.utils import timezone
from django.db import transaction
from apps.accounts.jwt_utils import jwt_required
from apps.accounts.models import User
from apps.academics.models import Offering, UnitTeachingAssignment, Enrollment
from apps.notifications.models import Notification
from apps.notifications.services import NotificationService
from apps.common.service_api import collection_response
from .models import Conversation, ConversationParticipant, Message


def _broadcast_roles(user):
    if user.role in {'admin', 'ict_admin'}:
        return {'student', 'lecturer'}
    if user.role == 'lecturer':
        return {'student'}
    return set()


def _broadcast_recipient_data(user):
    return {
        'id': user.id,
        'first_name': user.first_name,
        'last_name': user.last_name,
    }


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
def broadcast_recipients(request):
    role = request.GET.get('role', '')
    if role not in _broadcast_roles(request.user):
        return JsonResponse({'error': 'You cannot send messages to this audience'}, status=403)

    users = User.objects.filter(role=role, is_active=True).exclude(pk=request.user.pk)
    return collection_response(
        users,
        request,
        _broadcast_recipient_data,
        search_fields=('first_name', 'last_name', 'email'),
        ordering_fields={'first_name': 'first_name', 'last_name': 'last_name', 'email': 'email'},
        default_ordering=('first_name', 'last_name', 'id'),
    )


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def send_broadcast(request):
    user = request.user
    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, TypeError):
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    if not isinstance(data, dict):
        return JsonResponse({'error': 'Expected a JSON object'}, status=400)

    role = data.get('role')
    if role not in _broadcast_roles(user):
        return JsonResponse({'error': 'You cannot send messages to this audience'}, status=403)

    body = data.get('body')
    if not isinstance(body, str) or not body.strip():
        return JsonResponse({'error': 'Message is required'}, status=400)
    body = body.strip()

    allow_replies = data.get('allow_replies')
    if not isinstance(allow_replies, bool):
        return JsonResponse({'error': 'allow_replies must be true or false'}, status=400)
    max_length = 5000 if allow_replies else 255
    if len(body) > max_length:
        return JsonResponse({'error': f'Message must be at most {max_length} characters'}, status=400)

    recipient_ids = data.get('recipient_ids')
    if recipient_ids is not None:
        if (
            not isinstance(recipient_ids, list)
            or not recipient_ids
            or len(recipient_ids) > 10000
            or any(isinstance(value, bool) or not isinstance(value, int) for value in recipient_ids)
        ):
            return JsonResponse({'error': 'recipient_ids must be a non-empty list of user IDs'}, status=400)
        recipient_ids = list(dict.fromkeys(recipient_ids))
        recipients = list(
            User.objects.filter(
                pk__in=recipient_ids,
                role=role,
                is_active=True,
            ).exclude(pk=user.pk).order_by('id')
        )
        if len(recipients) != len(recipient_ids):
            return JsonResponse({'error': 'One or more recipients are unavailable for this audience'}, status=400)
    else:
        recipients = list(
            User.objects.filter(role=role, is_active=True)
            .exclude(pk=user.pk)
            .order_by('id')
        )

    if not recipients:
        return JsonResponse({'error': 'There are no active recipients in this audience'}, status=400)

    with transaction.atomic():
        if allow_replies:
            for recipient in recipients:
                conversation = (
                    Conversation.objects.filter(kind='direct', participants__user=user)
                    .filter(participants__user=recipient)
                    .distinct()
                    .first()
                )
                if conversation is None:
                    conversation = Conversation.objects.create(kind='direct')
                    ConversationParticipant.objects.create(conversation=conversation, user=user)
                    ConversationParticipant.objects.create(conversation=conversation, user=recipient)
                Message.objects.create(conversation=conversation, sender=user, body=body)
                NotificationService.notify(
                    recipient=recipient,
                    verb='New message',
                    message=f'New message from {user.get_full_name()}',
                    actor=user,
                    link=f'/messaging/?conversation={conversation.id}',
                )
            delivery = 'chat'
        else:
            notifications = NotificationService.notify_bulk(
                recipients=recipients,
                verb='Message',
                message=body,
                actor=user,
            )
            for notification in notifications:
                notification.link = f'/notifications/?notification={notification.id}'
            Notification.objects.bulk_update(notifications, ['link'])
            delivery = 'notification'

    return JsonResponse({'delivery': delivery, 'recipient_count': len(recipients)}, status=201)


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
            NotificationService.notify(
                recipient=p.user,
                verb='New message',
                message=f'New message from {user.get_full_name()}',
                actor=user,
                link=f'/messaging/?conversation={conv.id}',
            )
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
