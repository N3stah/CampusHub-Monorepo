import json
import secrets
from datetime import timedelta
from decimal import Decimal, InvalidOperation

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from apps.academics.models import Department, Course, Enrollment
from apps.accounts.jwt_utils import jwt_required
from apps.accounts.emailing import send_initial_password
from apps.accounts.models import AuditEvent
from apps.common.service_api import collection_response

User = get_user_model()
VALID_ROLES = {choice[0] for choice in User.ROLE_CHOICES}
EDITABLE_FIELDS = {
    'email', 'username', 'first_name', 'last_name', 'role', 'department',
    'gpa', 'phone_number', 'title', 'bio', 'office_hours', 'is_active', 'admission_number',
}
TEXT_LIMITS = {
    'username': 50,
    'first_name': 100,
    'last_name': 100,
    'phone_number': 20,
    'title': 100,
    'office_hours': 200,
}


def _json_data(request):
    try:
        data = json.loads(request.body or b'{}')
    except json.JSONDecodeError:
        return None, JsonResponse({'error': 'Invalid JSON'}, status=400)
    if not isinstance(data, dict):
        return None, JsonResponse({'error': 'Expected a JSON object'}, status=400)
    return data, None


def _user_data(user):
    courses = []
    if user.role == 'lecturer':
        courses = list(user.taught_courses.values('id', 'title'))
        courses = [{'id': course['id'], 'name': course['title']} for course in courses]
    programme = None
    if user.role == 'student':
        enrollment = Enrollment.objects.filter(student=user, status='active').select_related('course').first()
        if enrollment:
            programme = {'id': enrollment.course.id, 'code': enrollment.course.code, 'title': enrollment.course.title}
    return {
        'id': user.id,
        'email': user.email,
        'username': user.username,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'role': user.role,
        'department': user.department_id,
        'gpa': str(user.gpa) if user.gpa is not None else None,
        'phone_number': user.phone_number,
        'title': user.title,
        'bio': user.bio,
        'office_hours': user.office_hours,
        'is_active': user.is_active,
        'must_change_password': user.must_change_password,
        'initial_password_expires_at': user.initial_password_expires_at.isoformat() if user.initial_password_expires_at else None,
        'invitation_email_status': user.invitation_email_status,
        'date_joined': user.date_joined.isoformat(),
        'courses': courses,
        'admission_number': user.admission_number,
        'profile_picture_url': user.profile_picture.url if user.profile_picture else None,
        'programme': programme,
    }


def _set_user_fields(user, data, *, creating=False, forced_role=None):
    unknown = set(data) - EDITABLE_FIELDS - {'password'}
    if unknown:
        raise ValueError(f'Unsupported fields: {", ".join(sorted(unknown))}')

    fields = set(data) & EDITABLE_FIELDS
    if forced_role:
        if 'role' in data and data['role'] != forced_role:
            raise ValueError(f'Role must be {forced_role}.')
        user.role = forced_role
        fields.discard('role')

    if creating:
        required = {'email', 'username', 'first_name', 'last_name', 'password'}
        missing = sorted(field for field in required if not data.get(field))
        if missing:
            raise ValueError(f"Required fields: {', '.join(missing)}.")
        if not forced_role and not data.get('role'):
            raise ValueError('role is required.')
        fields.update({'email', 'username', 'first_name', 'last_name'})
        if not forced_role:
            fields.add('role')

    for field in sorted(fields):
        value = data.get(field)
        if field in TEXT_LIMITS:
            if not isinstance(value, str):
                raise ValueError(f'{field} must be text.')
            value = value.strip()
            if field in {'username', 'first_name', 'last_name'} and not value:
                raise ValueError(f'{field} is required.')
            if len(value) > TEXT_LIMITS[field]:
                raise ValueError(f'{field} must be at most {TEXT_LIMITS[field]} characters.')
        if field == 'email':
            if not isinstance(value, str) or not value.strip():
                raise ValueError('email is required.')
            value = value.strip().lower()
            try:
                validate_email(value)
            except ValidationError as error:
                raise ValueError('Enter a valid email address.') from error
        elif field == 'role':
            if not isinstance(value, str) or value not in VALID_ROLES:
                raise ValueError(f'role must be one of: {", ".join(sorted(VALID_ROLES))}.')
        elif field == 'department':
            if value in (None, ''):
                value = None
            else:
                try:
                    value = Department.objects.get(pk=int(value))
                except (TypeError, ValueError, Department.DoesNotExist) as error:
                    raise ValueError('department must be the ID of an existing department.') from error
        elif field == 'admission_number':
            if value in (None, ''):
                value = None
            else:
                value = str(value).strip()
                if not value:
                    value = None
            if value is not None:
                if User.objects.filter(admission_number=value).exclude(pk=user.pk).exists():
                    raise ValueError('admission_number already exists.')
        elif field == 'gpa':
            if value in (None, ''):
                value = None
            else:
                try:
                    value = Decimal(str(value))
                except (InvalidOperation, ValueError) as error:
                    raise ValueError('gpa must be a number between 0.00 and 4.00.') from error
                if not value.is_finite() or value < 0 or value > 4:
                    raise ValueError('gpa must be a number between 0.00 and 4.00.')
        elif field == 'is_active' and not isinstance(value, bool):
            raise ValueError('is_active must be true or false.')
        elif field in {'bio'} and not isinstance(value, str):
            raise ValueError(f'{field} must be text.')
        setattr(user, field, value)

    if 'email' in fields and User.objects.filter(email__iexact=user.email).exclude(pk=user.pk).exists():
        raise ValueError('Email or username already exists.')
    if 'username' in fields and User.objects.filter(username__iexact=user.username).exclude(pk=user.pk).exists():
        raise ValueError('Email or username already exists.')

    if creating:
        password = data['password']
        if not isinstance(password, str) or len(password) < 8:
            raise ValueError('password must be at least 8 characters.')
        try:
            validate_password(password, user)
        except ValidationError as error:
            raise ValueError(' '.join(error.messages)) from error
        user.set_password(password)
    elif 'password' in data:
        password = data['password']
        if not isinstance(password, str) or len(password) < 8:
            raise ValueError('password must be at least 8 characters.')
        try:
            validate_password(password, user)
        except ValidationError as error:
            raise ValueError(' '.join(error.messages)) from error
        user.set_password(password)


def _visible_users(request):
    if request.user.role == 'admin':
        users = User.objects.all().select_related('department')
        requested_role = request.GET.get('role')
        if requested_role:
            if requested_role not in VALID_ROLES:
                raise ValueError(f'role must be one of: {", ".join(sorted(VALID_ROLES))}.')
            users = users.filter(role=requested_role)
    elif request.user.role in {'officer', 'registrar', 'finance', 'librarian', 'hostel'}:
        users = User.objects.filter(role='student', is_active=True).select_related('department')
        requested_role = request.GET.get('role')
        if requested_role not in (None, '', 'student'):
            raise PermissionError('This role may only view student accounts.')
    else:
        raise PermissionError('Permission denied.')

    department_id = request.GET.get('department_id')
    if department_id:
        try:
            department_id = int(department_id)
        except ValueError:
            raise ValueError('department_id must be an integer.')
        users = users.filter(department_id=department_id)

    return users


def _student_lookup_data(user):
    return {
        'id': user.id,
        'admission_number': user.admission_number,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'email': user.email,
        'role': user.role,
    }




def _handle_course_enrollment(user, course_id):
    """Validate course_id, set department from course, manage student enrollment."""
    if course_id is None:
        return
    try:
        course = Course.objects.get(pk=int(course_id))
    except (TypeError, ValueError, Course.DoesNotExist):
        raise ValueError('course_id must be the ID of an existing course.')
    if user.role != 'student':
        raise ValueError('course_id can only be set for student accounts.')
    user.department = course.department
    user.save(update_fields=['department'])
    existing = Enrollment.objects.filter(student=user, status='active').first()
    if existing:
        if existing.course_id != course.id:
            existing.status = 'dropped'
            existing.save(update_fields=['status'])
            Enrollment.objects.create(student=user, course=course, status='active')
    else:
        Enrollment.objects.create(student=user, course=course, status='active')


@csrf_exempt
@require_http_methods(['GET', 'POST'])
@jwt_required
def user_list_create(request):
    if request.method == 'GET':
        try:
            users = _visible_users(request)
        except ValueError as error:
            return JsonResponse({'error': str(error)}, status=400)
        except PermissionError as error:
            return JsonResponse({'error': str(error)}, status=403)
        restricted_lookup = request.user.role not in {'admin', 'officer'}
        return collection_response(
            users,
            request,
            _student_lookup_data if restricted_lookup else _user_data,
            search_fields=('first_name', 'last_name', 'email', 'username', 'admission_number'),
            ordering_fields={
                'first_name': 'first_name',
                'last_name': 'last_name',
                'email': 'email',
                'admission_number': 'admission_number',
                'date_joined': 'date_joined',
            },
            default_ordering=('first_name', 'last_name'),
        )

    if request.user.role not in {'admin', 'registrar'}:
        return JsonResponse({'error': 'Only admins or registrars can create user accounts.'}, status=403)
    data, error = _json_data(request)
    if error:
        return error
    send_welcome_email = data.pop('send_welcome_email', False)
    if not isinstance(send_welcome_email, bool):
        return JsonResponse({'error': 'send_welcome_email must be true or false.'}, status=400)
    if request.user.role == 'registrar' and data.get('role') != 'student':
        return JsonResponse({'error': 'Registrars may only create student accounts.'}, status=403)
    if request.user.role == 'registrar' and not send_welcome_email:
        return JsonResponse({'error': 'Student accounts must receive initial sign-in instructions by email.'}, status=400)
    course_id = data.pop('course_id', None)
    initial_password = None
    if send_welcome_email:
        initial_password = secrets.token_urlsafe(24)
        data['password'] = initial_password
    user = User()
    try:
        with transaction.atomic():
            _set_user_fields(user, data, creating=True)
            user.must_change_password = send_welcome_email
            user.initial_password_expires_at = timezone.now() + timedelta(hours=48) if send_welcome_email else None
            user.invitation_email_status = 'failed' if send_welcome_email else 'not_sent'
            user.save()
            _handle_course_enrollment(user, course_id)
            AuditEvent.objects.create(
                actor=request.user,
                action='user.created',
                description=f'Created {user.role} account for {user.get_full_name()}.',
            )
    except ValueError as validation_error:
        return JsonResponse({'error': str(validation_error)}, status=400)
    except IntegrityError:
        return JsonResponse({'error': 'Email or username already exists.'}, status=400)
    response_data = _user_data(user)
    if send_welcome_email:
        sent = send_initial_password(user=user, password=initial_password)
        user.invitation_email_status = 'sent' if sent else 'failed'
        user.save(update_fields=['invitation_email_status'])
        response_data['invitation_email_status'] = user.invitation_email_status
        response_data['welcome_email_status'] = user.invitation_email_status
    return JsonResponse(response_data, status=201)


@csrf_exempt
@require_http_methods(['POST'])
@jwt_required
def resend_user_invitation(request, pk):
    if request.user.role != 'admin':
        return JsonResponse({'error': 'Only admins can resend account invitations.'}, status=403)
    try:
        user = User.objects.get(pk=pk)
    except User.DoesNotExist:
        return JsonResponse({'error': 'User not found.'}, status=404)
    if not user.is_active:
        return JsonResponse({'error': 'Reactivate the account before resending its invitation.'}, status=400)

    password = secrets.token_urlsafe(24)
    sent = send_initial_password(user=user, password=password)
    if sent:
        user.set_password(password)
        user.must_change_password = True
        user.initial_password_expires_at = timezone.now() + timedelta(hours=48)
    user.invitation_email_status = 'sent' if sent else 'failed'
    changed_fields = ['invitation_email_status']
    if sent:
        changed_fields.extend(['password', 'must_change_password', 'initial_password_expires_at'])
    user.save(update_fields=changed_fields)
    AuditEvent.objects.create(
        actor=request.user,
        action='user.invitation_resent',
        description=f'Resent initial sign-in instructions for {user.get_full_name()}.',
    )
    return JsonResponse({'welcome_email_status': 'sent' if sent else 'failed'})


def _get_user_for_request(request, pk):
    try:
        user = User.objects.select_related('department').get(pk=pk)
    except User.DoesNotExist:
        return None, JsonResponse({'error': 'User not found.'}, status=404)
    if request.user.role == 'admin':
        return user, None
    if request.user.role == 'officer' and user.role == 'student':
        return user, None
    return None, JsonResponse({'error': 'Permission denied.'}, status=403)


@csrf_exempt
@require_http_methods(['GET', 'PATCH', 'DELETE'])
@jwt_required
def user_detail_update_deactivate(request, pk):
    user, error = _get_user_for_request(request, pk)
    if error:
        return error
    if request.method == 'GET':
        return JsonResponse(_user_data(user))
    if request.user.role != 'admin':
        return JsonResponse({'error': 'Only admins can modify user accounts.'}, status=403)
    if request.user.pk == user.pk:
        return JsonResponse({'error': 'You cannot deactivate or change your own account.'}, status=400)

    if request.method == 'DELETE':
        if user.is_superuser and User.objects.filter(is_superuser=True, is_active=True).count() <= 1:
            return JsonResponse({'error': 'The last active superuser cannot be deactivated.'}, status=400)
        user.is_active = False
        user.save(update_fields=['is_active'])
        AuditEvent.objects.create(
            actor=request.user,
            action='user.deactivated',
            description=f'Deactivated {user.role} account for {user.get_full_name()}.',
        )
        return JsonResponse({'message': 'User account deactivated.'})

    data, error = _json_data(request)
    if error:
        return error
    course_id = data.pop('course_id', None)
    if 'role' in data and user.is_superuser and data['role'] != 'admin':
        if User.objects.filter(is_superuser=True, is_active=True).count() <= 1:
            return JsonResponse({'error': 'The last active superuser cannot be demoted.'}, status=400)
    if data.get('is_active') is False and user.is_superuser:
        if User.objects.filter(is_superuser=True, is_active=True).count() <= 1:
            return JsonResponse({'error': 'The last active superuser cannot be deactivated.'}, status=400)
    try:
        with transaction.atomic():
            _set_user_fields(user, data)
            user.save()
            _handle_course_enrollment(user, course_id)
            AuditEvent.objects.create(
                actor=request.user,
                action='user.updated',
                description=f'Updated {user.role} account for {user.get_full_name()}.',
            )
    except ValueError as validation_error:
        return JsonResponse({'error': str(validation_error)}, status=400)
    except IntegrityError:
        return JsonResponse({'error': 'Email or username already exists.'}, status=400)
    return JsonResponse(_user_data(user))


@csrf_exempt
@require_http_methods(['GET', 'POST'])
@jwt_required
def lecturer_list_create(request):
    if request.method == 'GET':
        if request.user.role not in {'admin', 'officer', 'lecturer'}:
            return JsonResponse({'error': 'Permission denied.'}, status=403)
        lecturers = User.objects.filter(role='lecturer').select_related('department')
        search = request.GET.get('search', '').strip()
        if search:
            lecturers = lecturers.filter(
                Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(email__icontains=search)
                | Q(username__icontains=search)
            )
        department_id = request.GET.get('department_id')
        if department_id:
            try:
                department_id = int(department_id)
            except ValueError:
                return JsonResponse({'error': 'department_id must be an integer.'}, status=400)
            lecturers = lecturers.filter(department_id=department_id)
        results = [_user_data(user) for user in lecturers]
        return JsonResponse({'count': len(results), 'next': None, 'previous': None, 'results': results})

    if request.user.role != 'admin':
        return JsonResponse({'error': 'Only admins can create lecturer accounts.'}, status=403)
    data, error = _json_data(request)
    if error:
        return error
    send_welcome_email = data.pop('send_welcome_email', False)
    if not isinstance(send_welcome_email, bool):
        return JsonResponse({'error': 'send_welcome_email must be true or false.'}, status=400)
    initial_password = None
    if send_welcome_email:
        initial_password = secrets.token_urlsafe(24)
        data['password'] = initial_password
    user = User()
    try:
        with transaction.atomic():
            _set_user_fields(user, data, creating=True, forced_role='lecturer')
            user.must_change_password = send_welcome_email
            user.initial_password_expires_at = timezone.now() + timedelta(hours=48) if send_welcome_email else None
            user.invitation_email_status = 'failed' if send_welcome_email else 'not_sent'
            user.save()
            AuditEvent.objects.create(
                actor=request.user,
                action='lecturer.created',
                description=f'Created lecturer account for {user.get_full_name()}.',
            )
    except ValueError as validation_error:
        return JsonResponse({'error': str(validation_error)}, status=400)
    except IntegrityError:
        return JsonResponse({'error': 'Email or username already exists.'}, status=400)
    response_data = _user_data(user)
    if send_welcome_email:
        sent = send_initial_password(user=user, password=initial_password)
        user.invitation_email_status = 'sent' if sent else 'failed'
        user.save(update_fields=['invitation_email_status'])
        response_data['invitation_email_status'] = user.invitation_email_status
        response_data['welcome_email_status'] = user.invitation_email_status
    return JsonResponse(response_data, status=201)


@csrf_exempt
@require_http_methods(['GET', 'PATCH'])
@jwt_required
def lecturer_detail_update(request, pk):
    try:
        user = User.objects.select_related('department').get(pk=pk, role='lecturer')
    except User.DoesNotExist:
        return JsonResponse({'error': 'Lecturer not found.'}, status=404)
    if request.user.role not in {'admin', 'officer', 'lecturer'}:
        return JsonResponse({'error': 'Permission denied.'}, status=403)
    if request.method == 'GET':
        return JsonResponse(_user_data(user))
    if request.user.role != 'admin':
        return JsonResponse({'error': 'Only admins can modify lecturer accounts.'}, status=403)
    if request.user.pk == user.pk:
        return JsonResponse({'error': 'You cannot change your own account through this endpoint.'}, status=400)
    data, error = _json_data(request)
    if error:
        return error
    try:
        _set_user_fields(user, data, forced_role='lecturer')
        user.save()
        AuditEvent.objects.create(
            actor=request.user,
            action='lecturer.updated',
            description=f'Updated lecturer account for {user.get_full_name()}.',
        )
    except ValueError as validation_error:
        return JsonResponse({'error': str(validation_error)}, status=400)
    except IntegrityError:
        return JsonResponse({'error': 'Email or username already exists.'}, status=400)
    return JsonResponse(_user_data(user))
