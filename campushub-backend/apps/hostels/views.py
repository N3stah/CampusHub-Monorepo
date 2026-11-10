from datetime import date

from django.db import IntegrityError, transaction
from django.db.models import Count, F, Q, Sum
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from apps.accounts.jwt_utils import jwt_required
from apps.accounts.models import AuditEvent, User
from apps.common.service_api import collection_response, date_value, integer_value, json_payload

from .models import Allocation, Hostel, Room

WARDEN_ROLES = {'hostel', 'admin'}
ACTIVE_ALLOCATION_STATUSES = ('allocated', 'checked_in')


def _occupied(room):
    if hasattr(room, 'occupied_count'):
        return room.occupied_count
    return room.allocations.filter(
        status__in=ACTIVE_ALLOCATION_STATUSES,
    ).filter(Q(ends_on__isnull=True) | Q(ends_on__gte=date.today())).count()


def _room_status(room):
    if room.status == 'maintenance':
        return 'maintenance'
    return 'full' if _occupied(room) >= room.capacity else 'available'


def _serialize_hostel(hostel):
    return {
        'id': hostel.id,
        'name': hostel.name,
        'location': hostel.location,
        'gender_policy': hostel.gender_policy,
        'capacity': hostel.capacity,
        'status': hostel.status,
        'description': hostel.description,
        'created_at': hostel.created_at.isoformat(),
    }


def _serialize_room(room):
    return {
        'id': room.id,
        'hostel_id': room.hostel_id,
        'hostel_name': room.hostel.name,
        'room_number': room.room_number,
        'capacity': room.capacity,
        'occupied': _occupied(room),
        'status': _room_status(room),
        'created_at': room.created_at.isoformat(),
    }


def _serialize_allocation(allocation):
    return {
        'id': allocation.id,
        'student_id': allocation.student_id,
        'student_name': allocation.student.get_full_name(),
        'room_id': allocation.room_id,
        'hostel_name': allocation.room.hostel.name,
        'room_number': allocation.room.room_number,
        'room_label': f'{allocation.room.hostel.name} · {allocation.room.room_number}',
        'academic_year': allocation.academic_year,
        'starts_on': allocation.starts_on.isoformat(),
        'ends_on': allocation.ends_on.isoformat() if allocation.ends_on else None,
        'status': allocation.status,
        'created_at': allocation.created_at.isoformat(),
        'updated_at': allocation.updated_at.isoformat(),
    }


def _room_queryset():
    return Room.objects.select_related('hostel').annotate(
        occupied_count=Count(
            'allocations',
            filter=Q(allocations__status__in=ACTIVE_ALLOCATION_STATUSES)
            & (Q(allocations__ends_on__isnull=True) | Q(allocations__ends_on__gte=date.today())),
        )
    )


@csrf_exempt
@require_http_methods(['GET', 'POST'])
@jwt_required
def hostel_list_create(request):
    user = request.user
    if user.role not in {'student', 'hostel', 'admin'}:
        return JsonResponse({'error': 'Forbidden'}, status=403)
    if request.method == 'GET':
        queryset = Hostel.objects.all()
        if user.role == 'student':
            queryset = queryset.filter(status='active')
        return collection_response(
            queryset, request, _serialize_hostel,
            search_fields=('name', 'location', 'description'),
            filters={'status': 'status'},
            ordering_fields={'name': 'name', 'location': 'location'},
            default_ordering=('name',),
        )
    if user.role not in WARDEN_ROLES:
        return JsonResponse({'error': 'Only Hostel Wardens can manage inventory'}, status=403)
    payload, error = json_payload(request)
    if error:
        return error
    name = payload.get('name')
    location = payload.get('location')
    if not isinstance(name, str) or not name.strip() or not isinstance(location, str) or not location.strip():
        return JsonResponse({'error': 'name and location are required'}, status=400)
    policy = payload.get('gender_policy')
    if not isinstance(policy, str) or policy not in {'male', 'female', 'mixed'}:
        return JsonResponse({'error': 'Invalid gender policy'}, status=400)
    capacity, error_text = integer_value(payload.get('capacity'), 'capacity', minimum=1)
    if error_text:
        return JsonResponse({'error': error_text}, status=400)
    status = payload.get('status', 'active')
    if not isinstance(status, str) or status not in {'active', 'inactive'}:
        return JsonResponse({'error': 'Invalid hostel status'}, status=400)
    try:
        hostel = Hostel.objects.create(name=name.strip(), location=location.strip(), gender_policy=policy, capacity=capacity, status=status, description=str(payload.get('description', '')).strip())
    except IntegrityError:
        return JsonResponse({'error': 'A hostel with this name already exists'}, status=409)
    AuditEvent.objects.create(actor=user, action='hostel.create', description=f'Created hostel {hostel.pk}')
    return JsonResponse(_serialize_hostel(hostel), status=201)


@csrf_exempt
@require_http_methods(['GET', 'PATCH'])
@jwt_required
def hostel_detail(request, pk):
    if request.user.role not in {'student', 'hostel', 'admin'}:
        return JsonResponse({'error': 'Forbidden'}, status=403)
    try:
        hostel = Hostel.objects.get(pk=pk)
    except Hostel.DoesNotExist:
        return JsonResponse({'error': 'Hostel not found'}, status=404)
    if request.user.role == 'student' and hostel.status != 'active':
        return JsonResponse({'error': 'Hostel not found'}, status=404)
    if request.method == 'GET':
        return JsonResponse(_serialize_hostel(hostel))
    if request.user.role not in WARDEN_ROLES:
        return JsonResponse({'error': 'Only Hostel Wardens can manage inventory'}, status=403)
    payload, error = json_payload(request)
    if error:
        return error
    for field in ('name', 'location', 'description'):
        if field in payload:
            if not isinstance(payload[field], str) or (field in {'name', 'location'} and not payload[field].strip()):
                return JsonResponse({'error': f'{field} must be a non-empty string'}, status=400)
            setattr(hostel, field, payload[field].strip())
    if 'gender_policy' in payload:
        if not isinstance(payload['gender_policy'], str) or payload['gender_policy'] not in {'male', 'female', 'mixed'}:
            return JsonResponse({'error': 'Invalid gender policy'}, status=400)
        hostel.gender_policy = payload['gender_policy']
    if 'capacity' in payload:
        hostel.capacity, error_text = integer_value(payload['capacity'], 'capacity', minimum=1)
        if error_text:
            return JsonResponse({'error': error_text}, status=400)
        if (hostel.rooms.aggregate(total=Sum('capacity'))['total'] or 0) > hostel.capacity:
            return JsonResponse({'error': 'Hostel capacity cannot be less than the sum of room capacities'}, status=400)
    if 'status' in payload:
        if not isinstance(payload['status'], str) or payload['status'] not in {'active', 'inactive'}:
            return JsonResponse({'error': 'Invalid hostel status'}, status=400)
        hostel.status = payload['status']
    try:
        hostel.save()
    except IntegrityError:
        return JsonResponse({'error': 'A hostel with this name already exists'}, status=409)
    return JsonResponse(_serialize_hostel(hostel))


@csrf_exempt
@require_http_methods(['GET', 'POST'])
@jwt_required
def room_list_create(request):
    user = request.user
    if user.role not in {'student', 'hostel', 'admin'}:
        return JsonResponse({'error': 'Forbidden'}, status=403)
    if request.method == 'GET':
        queryset = _room_queryset()
        if user.role == 'student':
            queryset = queryset.filter(hostel__status='active', status__in=['available', 'full'])
        requested_status = request.GET.get('status')
        if requested_status == 'available':
            queryset = queryset.filter(hostel__status='active', status__in=['available', 'full'], occupied_count__lt=F('capacity'))
        elif requested_status == 'full':
            queryset = queryset.filter(status__in=['available', 'full'], occupied_count__gte=F('capacity'))
        elif requested_status == 'maintenance':
            queryset = queryset.filter(status='maintenance')
        return collection_response(
            queryset, request, _serialize_room,
            search_fields=('hostel__name', 'room_number'),
            ordering_fields={'hostel_name': 'hostel__name', 'room_number': 'room_number'},
            default_ordering=('hostel__name', 'room_number'),
        )
    if user.role not in WARDEN_ROLES:
        return JsonResponse({'error': 'Only Hostel Wardens can manage rooms'}, status=403)
    payload, error = json_payload(request)
    if error:
        return error
    try:
        hostel = Hostel.objects.get(pk=int(payload.get('hostel_id')), status='active')
    except (Hostel.DoesNotExist, TypeError, ValueError):
        return JsonResponse({'error': 'Select an active hostel'}, status=400)
    room_number = payload.get('room_number')
    if not isinstance(room_number, str) or not room_number.strip():
        return JsonResponse({'error': 'room_number is required'}, status=400)
    capacity, error_text = integer_value(payload.get('capacity'), 'capacity', minimum=1)
    if error_text:
        return JsonResponse({'error': error_text}, status=400)
    if (hostel.rooms.aggregate(total=Sum('capacity'))['total'] or 0) + capacity > hostel.capacity:
        return JsonResponse({'error': 'Room capacity exceeds the hostel capacity'}, status=400)
    status = payload.get('status', 'available')
    if not isinstance(status, str) or status not in {'available', 'full', 'maintenance'}:
        return JsonResponse({'error': 'Invalid room status'}, status=400)
    try:
        room = Room.objects.create(hostel=hostel, room_number=room_number.strip(), capacity=capacity, status=status)
    except IntegrityError:
        return JsonResponse({'error': 'Room number already exists in this hostel'}, status=409)
    return JsonResponse(_serialize_room(_room_queryset().get(pk=room.pk)), status=201)


@csrf_exempt
@require_http_methods(['GET', 'PATCH'])
@jwt_required
def room_detail(request, pk):
    if request.user.role not in {'student', 'hostel', 'admin'}:
        return JsonResponse({'error': 'Forbidden'}, status=403)
    try:
        room = _room_queryset().get(pk=pk)
    except Room.DoesNotExist:
        return JsonResponse({'error': 'Room not found'}, status=404)
    if request.user.role == 'student' and room.hostel.status != 'active':
        return JsonResponse({'error': 'Room not found'}, status=404)
    if request.method == 'GET':
        return JsonResponse(_serialize_room(room))
    if request.user.role not in WARDEN_ROLES:
        return JsonResponse({'error': 'Only Hostel Wardens can manage rooms'}, status=403)
    payload, error = json_payload(request)
    if error:
        return error
    if 'room_number' in payload:
        if not isinstance(payload['room_number'], str) or not payload['room_number'].strip():
            return JsonResponse({'error': 'room_number is required'}, status=400)
        room.room_number = payload['room_number'].strip()
    if 'capacity' in payload:
        room.capacity, error_text = integer_value(payload['capacity'], 'capacity', minimum=1)
        if error_text:
            return JsonResponse({'error': error_text}, status=400)
        if room.capacity < _occupied(room):
            return JsonResponse({'error': 'Room capacity cannot be less than occupied beds'}, status=400)
        other_capacity = room.hostel.rooms.exclude(pk=room.pk).aggregate(total=Sum('capacity'))['total'] or 0
        if other_capacity + room.capacity > room.hostel.capacity:
            return JsonResponse({'error': 'Room capacity exceeds the hostel capacity'}, status=400)
    if 'status' in payload:
        if not isinstance(payload['status'], str) or payload['status'] not in {'available', 'full', 'maintenance'}:
            return JsonResponse({'error': 'Invalid room status'}, status=400)
        room.status = payload['status']
    try:
        room.save()
    except IntegrityError:
        return JsonResponse({'error': 'Room number already exists in this hostel'}, status=409)
    return JsonResponse(_serialize_room(_room_queryset().get(pk=room.pk)))


def _allocation_overlap(queryset, starts_on, ends_on):
    return queryset.filter(
        Q(ends_on__isnull=True) | Q(ends_on__gte=starts_on),
    ).filter(
        Q(starts_on__lte=ends_on) if ends_on else Q(),
    )


@csrf_exempt
@require_http_methods(['GET', 'POST'])
@jwt_required
def allocation_list_create(request):
    user = request.user
    queryset = Allocation.objects.select_related('student', 'room__hostel')
    if request.method == 'GET':
        if user.role == 'student':
            queryset = queryset.filter(student=user)
        elif user.role not in WARDEN_ROLES:
            return JsonResponse({'error': 'Forbidden'}, status=403)
        return collection_response(
            queryset, request, _serialize_allocation,
            search_fields=('student__first_name', 'student__last_name', 'student__email', 'room__hostel__name', 'room__room_number'),
            filters={'status': 'status'},
            ordering_fields={'starts_on': 'starts_on', 'created_at': 'created_at'},
            default_ordering=('-created_at',),
        )
    if user.role not in {'student', *WARDEN_ROLES}:
        return JsonResponse({'error': 'Forbidden'}, status=403)
    payload, error = json_payload(request)
    if error:
        return error
    if user.role == 'student':
        student = user
        if payload.get('status', 'requested') != 'requested':
            return JsonResponse({'error': 'Student requests must start with requested status'}, status=400)
        status = 'requested'
    else:
        try:
            student = User.objects.get(pk=int(payload.get('student_id')), role='student', is_active=True)
        except (User.DoesNotExist, TypeError, ValueError):
            return JsonResponse({'error': 'Select an active student'}, status=400)
        status = payload.get('status', 'requested')
        if not isinstance(status, str) or status not in {'requested', 'allocated'}:
            return JsonResponse({'error': 'New allocations must be requested or allocated'}, status=400)
    try:
        room = Room.objects.select_related('hostel').get(pk=int(payload.get('room_id')), hostel__status='active', status__in=['available', 'full'])
    except (Room.DoesNotExist, TypeError, ValueError):
        return JsonResponse({'error': 'Select an active room'}, status=400)
    academic_year = payload.get('academic_year')
    if not isinstance(academic_year, str) or not academic_year.strip():
        return JsonResponse({'error': 'academic_year is required'}, status=400)
    starts_on, date_error = date_value(payload.get('starts_on'), 'starts_on')
    if date_error:
        return JsonResponse({'error': date_error}, status=400)
    ends_on, date_error = date_value(payload.get('ends_on'), 'ends_on', required=False)
    if date_error:
        return JsonResponse({'error': date_error}, status=400)
    if ends_on and ends_on < starts_on:
        return JsonResponse({'error': 'ends_on must not precede starts_on'}, status=400)
    with transaction.atomic():
        room = Room.objects.select_for_update().select_related('hostel').get(pk=room.pk)
        active = Allocation.objects.filter(
            room=room, status__in=ACTIVE_ALLOCATION_STATUSES,
        ).filter(Q(ends_on__isnull=True) | Q(ends_on__gte=starts_on))
        if ends_on:
            active = active.filter(starts_on__lte=ends_on)
        if status == 'allocated' and active.count() >= room.capacity:
            return JsonResponse({'error': 'Room capacity is full for the requested dates'}, status=409)
        overlap = Allocation.objects.filter(
            student=student,
            status__in=['requested', *ACTIVE_ALLOCATION_STATUSES],
        ).filter(Q(ends_on__isnull=True) | Q(ends_on__gte=starts_on))
        if ends_on:
            overlap = overlap.filter(starts_on__lte=ends_on)
        if overlap.exists():
            return JsonResponse({'error': 'Student already has an overlapping accommodation request or allocation'}, status=409)
        allocation = Allocation.objects.create(student=student, room=room, academic_year=academic_year.strip(), starts_on=starts_on, ends_on=ends_on, status=status)
    AuditEvent.objects.create(actor=user, action='hostel.allocation.create', description=f'Created allocation {allocation.pk}')
    return JsonResponse(_serialize_allocation(allocation), status=201)


@csrf_exempt
@require_http_methods(['GET', 'PATCH'])
@jwt_required
def allocation_detail(request, pk):
    try:
        allocation = Allocation.objects.select_related('student', 'room__hostel').get(pk=pk)
    except Allocation.DoesNotExist:
        return JsonResponse({'error': 'Allocation not found'}, status=404)
    if request.user.role == 'student':
        if allocation.student_id != request.user.id:
            return JsonResponse({'error': 'Allocation not found'}, status=404)
        if request.method == 'PATCH':
            return JsonResponse({'error': 'Forbidden'}, status=403)
    elif request.user.role not in WARDEN_ROLES:
        return JsonResponse({'error': 'Forbidden'}, status=403)
    if request.method == 'GET':
        return JsonResponse(_serialize_allocation(allocation))
    payload, error = json_payload(request)
    if error:
        return error
    target = payload.get('status', allocation.status)
    transitions = {
        'requested': {'allocated', 'cancelled'},
        'allocated': {'checked_in', 'cancelled'},
        'checked_in': {'checked_out'},
        'checked_out': set(),
        'cancelled': set(),
    }
    if not isinstance(target, str) or (target != allocation.status and target not in transitions[allocation.status]):
        return JsonResponse({'error': f'Cannot transition from {allocation.status} to {target}'}, status=400)
    student = allocation.student
    room = allocation.room
    if 'student_id' in payload:
        try:
            student = User.objects.get(pk=int(payload['student_id']), role='student', is_active=True)
        except (User.DoesNotExist, TypeError, ValueError):
            return JsonResponse({'error': 'Select an active student'}, status=400)
    if 'room_id' in payload:
        try:
            room = Room.objects.select_related('hostel').get(
                pk=int(payload['room_id']),
                hostel__status='active',
                status__in=['available', 'full'],
            )
        except (Room.DoesNotExist, TypeError, ValueError):
            return JsonResponse({'error': 'Select an active room'}, status=400)
    starts_on = allocation.starts_on
    ends_on = allocation.ends_on
    if 'starts_on' in payload:
        starts_on, date_error = date_value(payload['starts_on'], 'starts_on')
        if date_error:
            return JsonResponse({'error': date_error}, status=400)
    if 'ends_on' in payload:
        ends_on, date_error = date_value(payload['ends_on'], 'ends_on', required=False)
        if date_error:
            return JsonResponse({'error': date_error}, status=400)
    if ends_on and ends_on < starts_on:
        return JsonResponse({'error': 'ends_on must not precede starts_on'}, status=400)
    if 'academic_year' in payload:
        if not isinstance(payload['academic_year'], str) or not payload['academic_year'].strip():
            return JsonResponse({'error': 'academic_year is required'}, status=400)
        allocation.academic_year = payload['academic_year'].strip()
    with transaction.atomic():
        room = Room.objects.select_for_update().select_related('hostel').get(pk=room.pk)
        student_overlap = Allocation.objects.filter(
            student=student,
            status__in=['requested', *ACTIVE_ALLOCATION_STATUSES],
        ).exclude(pk=allocation.pk).filter(Q(ends_on__isnull=True) | Q(ends_on__gte=starts_on))
        if ends_on:
            student_overlap = student_overlap.filter(starts_on__lte=ends_on)
        if student_overlap.exists():
            return JsonResponse({'error': 'Student already has an overlapping accommodation request or allocation'}, status=409)
        if target in ACTIVE_ALLOCATION_STATUSES:
            conflicts = Allocation.objects.filter(room=room, status__in=ACTIVE_ALLOCATION_STATUSES).exclude(pk=allocation.pk)
            conflicts = conflicts.filter(Q(ends_on__isnull=True) | Q(ends_on__gte=starts_on))
            if ends_on:
                conflicts = conflicts.filter(starts_on__lte=ends_on)
            if conflicts.count() >= room.capacity:
                return JsonResponse({'error': 'Room capacity is full for the requested dates'}, status=409)
        allocation.student = student
        allocation.room = room
        allocation.starts_on = starts_on
        allocation.ends_on = ends_on
        allocation.status = target
        allocation.save()
    AuditEvent.objects.create(actor=request.user, action='hostel.allocation.status', description=f'Allocation {allocation.pk} changed to {target}')
    return JsonResponse(_serialize_allocation(allocation))
