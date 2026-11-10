from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import IntegrityError
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from apps.accounts.jwt_utils import jwt_required
from apps.accounts.models import AuditEvent
from apps.academics.models import Course
from apps.common.service_api import collection_response, json_payload, require_role

from .models import Application


STATUS_TRANSITIONS = {
    'submitted': {'under_review', 'withdrawn'},
    'under_review': {'offered', 'rejected', 'withdrawn'},
    'offered': {'accepted', 'rejected', 'withdrawn'},
    'accepted': set(),
    'rejected': set(),
    'withdrawn': set(),
}


def _serialize(application):
    return {
        'id': application.id,
        'first_name': application.first_name,
        'last_name': application.last_name,
        'email': application.email,
        'phone_number': application.phone_number,
        'programme_id': application.programme_id,
        'programme_name': f'{application.programme.code} {application.programme.title}',
        'programme_code': application.programme.code,
        'status': application.status,
        'notes': application.notes,
        'created_at': application.created_at.isoformat(),
        'updated_at': application.updated_at.isoformat(),
    }


def _field_errors(payload, *, partial=False):
    required = ('first_name', 'last_name', 'email', 'programme_id')
    fields = ('first_name', 'last_name', 'email', 'phone_number', 'programme_id', 'notes')
    result = {}
    for field in fields:
        if partial and field not in payload:
            continue
        value = payload.get(field)
        if field in required and (value is None or value == ''):
            result[field] = 'This field is required.'
        elif field not in required and value is None:
            result[field] = ''
        elif field in ('first_name', 'last_name', 'phone_number', 'notes'):
            if not isinstance(value, str):
                result[field] = 'This field must be text.'
            else:
                result[field] = value.strip()
        elif field == 'email' and value:
            if not isinstance(value, str):
                result[field] = 'Enter a valid email address.'
            else:
                try:
                    validate_email(value)
                except ValidationError:
                    result[field] = 'Enter a valid email address.'
    if 'email' in payload and payload['email'] and isinstance(payload['email'], str):
        try:
            validate_email(payload['email'])
        except ValidationError:
            result['email'] = 'Enter a valid email address.'
    if 'programme_id' in payload and payload['programme_id'] not in (None, ''):
        try:
            result['programme_id'] = Course.objects.get(pk=int(payload['programme_id']), is_active=True)
        except (Course.DoesNotExist, TypeError, ValueError):
            result['programme_id'] = 'Select an existing active programme.'
    return result


@csrf_exempt
@require_http_methods(['GET', 'POST'])
@jwt_required
def application_list_create(request):
    denied = require_role(request, 'registrar', 'admin')
    if denied:
        return denied
    if request.method == 'GET':
        return collection_response(
            Application.objects.select_related('programme'),
            request,
            _serialize,
            search_fields=('first_name', 'last_name', 'email', 'programme__title', 'programme__code'),
            filters={'status': 'status'},
            ordering_fields={'created_at': 'created_at', 'first_name': 'first_name'},
            default_ordering=('-created_at',),
        )

    payload, error = json_payload(request)
    if error:
        return error
    values = _field_errors(payload)
    invalid = {
        key: value for key, value in values.items()
        if value in {'This field must be text.', 'Enter a valid email address.'}
        or (key == 'programme_id' and isinstance(value, str))
    }
    if invalid:
        return JsonResponse({'error': 'Invalid application fields', 'fields': invalid}, status=400)
    missing = {field: value for field, value in values.items() if value == 'This field is required.'}
    if missing:
        return JsonResponse({'error': 'Missing required fields', 'fields': missing}, status=400)
    if not isinstance(payload.get('status', 'submitted'), str) or payload.get('status', 'submitted') != 'submitted':
        return JsonResponse({'error': 'New applications must start with submitted status'}, status=400)
    programme = values['programme_id']
    email = payload['email'].strip().lower()
    if Application.objects.filter(email__iexact=email, programme=programme).exists():
        return JsonResponse({'error': 'An application already exists for this email and programme'}, status=409)
    try:
        application = Application.objects.create(
            first_name=values['first_name'],
            last_name=values['last_name'],
            email=email,
            phone_number=values.get('phone_number', ''),
            programme=programme,
            notes=values.get('notes', ''),
        )
    except IntegrityError:
        return JsonResponse({'error': 'A duplicate application already exists'}, status=409)
    AuditEvent.objects.create(actor=request.user, action='admission.application.create', description=f'Created application {application.pk}')
    return JsonResponse(_serialize(application), status=201)


@csrf_exempt
@require_http_methods(['GET', 'PATCH'])
@jwt_required
def application_detail(request, pk):
    denied = require_role(request, 'registrar', 'admin')
    if denied:
        return denied
    try:
        application = Application.objects.select_related('programme').get(pk=pk)
    except Application.DoesNotExist:
        return JsonResponse({'error': 'Application not found'}, status=404)
    if request.method == 'GET':
        return JsonResponse(_serialize(application))

    payload, error = json_payload(request)
    if error:
        return error
    values = _field_errors(payload, partial=True)
    field_errors = {
        key: value for key, value in values.items()
        if value in {'This field is required.', 'This field must be text.'}
        or value == 'Enter a valid email address.'
        or (key == 'programme_id' and isinstance(value, str))
    }
    if field_errors:
        return JsonResponse({'error': 'Invalid application fields', 'fields': field_errors}, status=400)
    new_status = payload.get('status', application.status)
    if not isinstance(new_status, str) or new_status not in STATUS_TRANSITIONS:
        return JsonResponse({'error': 'Invalid application status'}, status=400)
    if new_status != application.status and new_status not in STATUS_TRANSITIONS[application.status]:
        return JsonResponse({'error': f'Cannot transition from {application.status} to {new_status}'}, status=400)
    if 'email' in payload and Application.objects.filter(
        email__iexact=payload['email'].strip(),
        programme=values.get('programme_id', application.programme),
    ).exclude(pk=application.pk).exists():
        return JsonResponse({'error': 'An application already exists for this email and programme'}, status=409)

    old_status = application.status
    for field in ('first_name', 'last_name', 'phone_number', 'notes'):
        if field in values and isinstance(values[field], str):
            setattr(application, field, values[field])
    if 'email' in payload:
        application.email = payload['email'].strip().lower()
    if 'programme_id' in values and isinstance(values['programme_id'], Course):
        application.programme = values['programme_id']
    application.status = new_status
    application.save()
    if new_status != old_status:
        AuditEvent.objects.create(
            actor=request.user,
            action='admission.application.status',
            description=f'Application {application.pk}: {old_status} -> {new_status}',
        )
    return JsonResponse(_serialize(application))
