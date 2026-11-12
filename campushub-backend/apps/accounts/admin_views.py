from django.contrib.auth import get_user_model
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from apps.accounts.jwt_utils import jwt_required
from apps.accounts.models import AuditEvent
from apps.academics.models import Course, Department, Enrollment, School, Unit
from apps.placements.models import Application, Placement
from apps.common.service_api import collection_response

User = get_user_model()


@csrf_exempt
@require_http_methods(['GET'])
@jwt_required
def admin_stats(request):
    if request.user.role != 'admin':
        return JsonResponse({'error': 'Only admins can view administration statistics.'}, status=403)

    return JsonResponse({
        'active_users': User.objects.filter(is_active=True).count(),
        'students': User.objects.filter(role='student', is_active=True).count(),
        'lecturers': User.objects.filter(role='lecturer', is_active=True).count(),
        'placement_officers': User.objects.filter(role='officer', is_active=True).count(),
        'schools': School.objects.count(),
        'departments': Department.objects.count(),
        'courses': Course.objects.filter(is_active=True).count(),
        'units': Unit.objects.filter(is_active=True).count(),
        'active_enrollments': Enrollment.objects.filter(status='active').count(),
        'placements': Placement.objects.filter(is_active=True).count(),
        'applications': Application.objects.count(),
        'open_placements': Placement.objects.filter(is_active=True, deadline__gte=timezone.localdate()).count(),
        'pending_applications': Application.objects.filter(status='pending').count(),
    })


def _stat_directory_entry(item):
    if isinstance(item, User):
        department = item.department.name if item.department_id else ''
        return {
            'id': item.id,
            'name': item.get_full_name(),
            'subtitle': ' · '.join(part for part in (dict(User.ROLE_CHOICES).get(item.role, item.role), department, item.email) if part),
            'category': dict(User.ROLE_CHOICES).get(item.role, item.role),
            'status': 'Active' if item.is_active else 'Inactive',
        }
    if isinstance(item, School):
        return {
            'id': item.id,
            'name': item.name,
            'subtitle': item.code,
            'category': 'School',
            'status': 'Active' if item.is_active else 'Inactive',
        }
    if isinstance(item, Department):
        return {
            'id': item.id,
            'name': item.name,
            'subtitle': ' · '.join(part for part in (item.code, item.school.name if item.school else 'No school assigned') if part),
            'category': 'Department',
            'status': 'Listed',
        }
    if isinstance(item, Course):
        return {
            'id': item.id,
            'name': item.code,
            'subtitle': f'{item.title} · {item.department.name}',
            'category': 'Programme',
            'status': 'Active' if item.is_active else 'Inactive',
        }
    if isinstance(item, Unit):
        departments = ', '.join(department.name for department in item.departments.all())
        subtitle = f'{item.title} · {departments}' if departments else item.title
        return {
            'id': item.id,
            'name': item.code,
            'subtitle': subtitle,
            'category': 'Unit',
            'status': 'Active' if item.is_active else 'Inactive',
        }
    if isinstance(item, Enrollment):
        return {
            'id': item.id,
            'name': item.student.get_full_name(),
            'subtitle': f'{item.course.code} · {item.course.title}',
            'category': 'Student admission',
            'status': item.get_status_display(),
        }
    if isinstance(item, Placement):
        return {
            'id': item.id,
            'name': item.title,
            'subtitle': f'{item.company} · Deadline {item.deadline.isoformat()}',
            'category': 'Placement',
            'status': 'Inactive' if not item.is_active else (
                'Open' if item.deadline >= timezone.localdate() else 'Closed'
            ),
        }
    if isinstance(item, Application):
        return {
            'id': item.id,
            'name': item.student.get_full_name(),
            'subtitle': f'{item.placement.title} · {item.placement.company}',
            'category': 'Placement application',
            'status': item.get_status_display(),
        }
    raise TypeError(f'Unsupported stats directory object: {type(item).__name__}')


@csrf_exempt
@require_http_methods(['GET'])
@jwt_required
def admin_stat_directory(request, metric):
    if request.user.role != 'admin':
        return JsonResponse({'error': 'Only Super Admins can view campus directories.'}, status=403)

    users = {'active_users', 'students', 'lecturers', 'placement_officers'}
    if metric in users:
        queryset = User.objects.select_related('department')
        if metric == 'students':
            queryset = queryset.filter(role='student')
        elif metric == 'lecturers':
            queryset = queryset.filter(role='lecturer')
        elif metric == 'placement_officers':
            queryset = queryset.filter(role='officer')
        role = request.GET.get('role', '')
        if metric == 'active_users' and role:
            if role != 'all' and role not in dict(User.ROLE_CHOICES):
                return JsonResponse({'error': 'Invalid role filter'}, status=400)
            if role != 'all':
                queryset = queryset.filter(role=role)
        account_status = request.GET.get('account_status', 'active')
        if account_status not in {'active', 'inactive', 'all'}:
            return JsonResponse({'error': 'Invalid account status filter'}, status=400)
        if account_status != 'all':
            queryset = queryset.filter(is_active=account_status == 'active')
        department_id = request.GET.get('department_id', '')
        if department_id:
            try:
                queryset = queryset.filter(department_id=int(department_id))
            except ValueError:
                return JsonResponse({'error': 'department_id must be an integer'}, status=400)
        search_fields = ('first_name', 'last_name', 'email', 'username', 'admission_number', 'department__name')
        ordering_fields = {'name': 'first_name', 'email': 'email', 'role': 'role'}
    elif metric == 'schools':
        queryset = School.objects.all()
        is_active = request.GET.get('is_active', 'all')
        if is_active not in {'active', 'inactive', 'all'}:
            return JsonResponse({'error': 'Invalid active status filter'}, status=400)
        if is_active != 'all':
            queryset = queryset.filter(is_active=is_active == 'active')
        search_fields = ('name', 'code')
        ordering_fields = {'name': 'name', 'code': 'code'}
    elif metric == 'departments':
        queryset = Department.objects.select_related('school')
        school_id = request.GET.get('school_id', '')
        if school_id:
            try:
                queryset = queryset.filter(school_id=int(school_id))
            except ValueError:
                return JsonResponse({'error': 'school_id must be an integer'}, status=400)
        search_fields = ('name', 'code', 'school__name')
        ordering_fields = {'name': 'name', 'code': 'code'}
    elif metric == 'courses':
        queryset = Course.objects.select_related('department')
        is_active = request.GET.get('is_active', 'active')
        if is_active not in {'active', 'inactive', 'all'}:
            return JsonResponse({'error': 'Invalid active status filter'}, status=400)
        if is_active != 'all':
            queryset = queryset.filter(is_active=is_active == 'active')
        department_id = request.GET.get('department_id', '')
        if department_id:
            try:
                queryset = queryset.filter(department_id=int(department_id))
            except ValueError:
                return JsonResponse({'error': 'department_id must be an integer'}, status=400)
        search_fields = ('code', 'title', 'department__name')
        ordering_fields = {'name': 'code', 'code': 'code', 'title': 'title'}
    elif metric == 'units':
        queryset = Unit.objects.prefetch_related('departments')
        is_active = request.GET.get('is_active', 'active')
        if is_active not in {'active', 'inactive', 'all'}:
            return JsonResponse({'error': 'Invalid active status filter'}, status=400)
        if is_active != 'all':
            queryset = queryset.filter(is_active=is_active == 'active')
        department_id = request.GET.get('department_id', '')
        if department_id:
            try:
                queryset = queryset.filter(departments__id=int(department_id)).distinct()
            except ValueError:
                return JsonResponse({'error': 'department_id must be an integer'}, status=400)
        search_fields = ('code', 'title', 'departments__name')
        ordering_fields = {'name': 'code', 'code': 'code', 'title': 'title'}
    elif metric == 'active_enrollments':
        queryset = Enrollment.objects.select_related('student', 'course')
        status = request.GET.get('status', 'active')
        if status != 'all' and status not in dict(Enrollment.STATUS_CHOICES):
            return JsonResponse({'error': 'Invalid enrollment status filter'}, status=400)
        if status != 'all':
            queryset = queryset.filter(status=status)
        department_id = request.GET.get('department_id', '')
        if department_id:
            try:
                queryset = queryset.filter(course__department_id=int(department_id))
            except ValueError:
                return JsonResponse({'error': 'department_id must be an integer'}, status=400)
        search_fields = ('student__first_name', 'student__last_name', 'student__email', 'student__admission_number', 'course__code', 'course__title')
        ordering_fields = {'name': 'student__first_name', 'course': 'course__code', 'enrolled_at': 'enrolled_at'}
    elif metric in {'placements', 'open_placements'}:
        queryset = Placement.objects.select_related('posted_by')
        placement_status = request.GET.get('placement_status', 'open' if metric == 'open_placements' else 'active')
        today = timezone.localdate()
        if placement_status == 'active':
            queryset = queryset.filter(is_active=True)
        elif placement_status == 'inactive':
            queryset = queryset.filter(is_active=False)
        elif placement_status == 'open':
            queryset = queryset.filter(is_active=True, deadline__gte=today)
        elif placement_status == 'closed':
            queryset = queryset.filter(is_active=True, deadline__lt=today)
        elif placement_status != 'all':
            return JsonResponse({'error': 'Invalid placement status filter'}, status=400)
        search_fields = ('title', 'company', 'location')
        ordering_fields = {'name': 'title', 'company': 'company', 'deadline': 'deadline'}
    elif metric in {'applications', 'pending_applications'}:
        queryset = Application.objects.select_related('student', 'placement')
        status = request.GET.get('status', 'pending' if metric == 'pending_applications' else 'all')
        if status != 'all' and status not in dict(Application.STATUS_CHOICES):
            return JsonResponse({'error': 'Invalid application status filter'}, status=400)
        if status != 'all':
            queryset = queryset.filter(status=status)
        search_fields = ('student__first_name', 'student__last_name', 'student__email', 'student__admission_number', 'placement__title', 'placement__company')
        ordering_fields = {'name': 'student__first_name', 'placement': 'placement__title', 'applied_at': 'applied_at', 'status': 'status'}
    else:
        return JsonResponse({'error': 'Unknown campus stats directory'}, status=404)

    return collection_response(
        queryset,
        request,
        _stat_directory_entry,
        search_fields=search_fields,
        ordering_fields=ordering_fields,
    )


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
