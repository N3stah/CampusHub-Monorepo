import json
from django.db import transaction
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.contrib.auth import get_user_model

from apps.accounts.jwt_utils import jwt_required
from apps.accounts.models import AuditEvent
from .models import Department, Course, Enrollment

User = get_user_model()

# --- Department Views ---

@csrf_exempt
@require_http_methods(["GET", "POST"])
@jwt_required
def department_list_create(request):
    user = request.user
    
    if request.method == 'GET':
        departments = Department.objects.all().values('id', 'name', 'code', 'head_id')
        return JsonResponse(list(departments), safe=False)
        
    elif request.method == 'POST':
        if user.role != 'admin':
            return JsonResponse({'error': 'Only admins can create departments'}, status=403)
            
        try:
            data = json.loads(request.body)
            name = data.get('name')
            code = data.get('code')
            head_id = data.get('head_id')
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)
            
        if not name or not code:
            return JsonResponse({'error': 'Name and code are required'}, status=400)
            
        if Department.objects.filter(name=name).exists() or Department.objects.filter(code=code).exists():
            return JsonResponse({'error': 'Department name or code already exists'}, status=400)
            
        head = User.objects.filter(id=head_id, role='lecturer').first() if head_id else None
        dept = Department.objects.create(name=name, code=code, head=head)
        
        AuditEvent.objects.create(actor=user, action='department.create', description=f'Created department {dept.code}')
        return JsonResponse({'id': dept.id, 'name': dept.name, 'code': dept.code, 'head_id': dept.head_id}, status=201)

@csrf_exempt
@require_http_methods(["GET", "PATCH", "DELETE"])
@jwt_required
def department_detail_update_delete(request, pk):
    user = request.user
    try:
        dept = Department.objects.get(pk=pk)
    except Department.DoesNotExist:
        return JsonResponse({'error': 'Department not found'}, status=404)
        
    if request.method == 'GET':
        return JsonResponse({'id': dept.id, 'name': dept.name, 'code': dept.code, 'head_id': dept.head_id})
        
    elif request.method == 'PATCH':
        if user.role != 'admin':
            return JsonResponse({'error': 'Only admins can update departments'}, status=403)
            
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)
            
        if 'name' in data:
            if Department.objects.filter(name=data['name']).exclude(id=dept.id).exists():
                return JsonResponse({'error': 'Name already exists'}, status=400)
            dept.name = data['name']
        if 'code' in data:
            if Department.objects.filter(code=data['code']).exclude(id=dept.id).exists():
                return JsonResponse({'error': 'Code already exists'}, status=400)
            dept.code = data['code']
        if 'head_id' in data:
            head_id = data['head_id']
            if head_id:
                head = User.objects.filter(id=head_id, role='lecturer').first()
                if not head:
                    return JsonResponse({'error': 'Head must be a lecturer'}, status=400)
                dept.head = head
            else:
                dept.head = None
                
        dept.save()
        AuditEvent.objects.create(actor=user, action='department.update', description=f'Updated department {dept.code}')
        return JsonResponse({'id': dept.id, 'name': dept.name, 'code': dept.code, 'head_id': dept.head_id})
        
    elif request.method == 'DELETE':
        if user.role != 'admin':
            return JsonResponse({'error': 'Only admins can delete departments'}, status=403)
            
        if Course.objects.filter(department=dept).exists() or User.objects.filter(department=dept).exists():
            return JsonResponse({'error': 'Cannot delete department with active courses or members'}, status=400)
            
        dept.delete()
        AuditEvent.objects.create(actor=user, action='department.delete', description=f'Deleted department {pk}')
        return JsonResponse({'message': 'Department deleted successfully'})

# --- Course Views ---

@csrf_exempt
@require_http_methods(["GET", "POST"])
@jwt_required
def course_list_create(request):
    user = request.user
    
    if request.method == 'GET':
        department_id = request.GET.get('department')
        courses = Course.objects.filter(is_active=True)
        if department_id:
            courses = courses.filter(department_id=department_id)
        data = list(courses.values('id', 'title', 'code', 'department_id', 'lecturer_id', 'credits', 'is_active'))
        return JsonResponse(data, safe=False)
        
    elif request.method == 'POST':
        if user.role != 'admin':
            return JsonResponse({'error': 'Only admins can create courses'}, status=403)
            
        try:
            data = json.loads(request.body)
            code = data.get('code')
            title = data.get('title')
            department_id = data.get('department_id')
            lecturer_id = data.get('lecturer_id')
            credits = data.get('credits', 3)
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)
            
        if not all([code, title, department_id]):
            return JsonResponse({'error': 'Code, title, and department_id are required'}, status=400)
            
        if Course.objects.filter(code=code).exists():
            return JsonResponse({'error': 'Course code already exists'}, status=400)
            
        try:
            dept = Department.objects.get(pk=department_id)
        except Department.DoesNotExist:
            return JsonResponse({'error': 'Invalid department_id'}, status=400)
            
        lecturer = None
        if lecturer_id:
            lecturer = User.objects.filter(id=lecturer_id, role='lecturer').first()
            if not lecturer:
                return JsonResponse({'error': 'Lecturer must be a user with role=lecturer'}, status=400)
                
        course = Course.objects.create(
            code=code, title=title, department=dept, lecturer=lecturer, credits=credits
        )
        AuditEvent.objects.create(actor=user, action='course.create', description=f'Created course {course.code}')
        return JsonResponse({
            'id': course.id, 'code': course.code, 'title': course.title,
            'department_id': course.department_id, 'lecturer_id': course.lecturer_id,
            'credits': course.credits, 'is_active': course.is_active
        }, status=201)

@csrf_exempt
@require_http_methods(["GET", "PATCH", "DELETE"])
@jwt_required
def course_detail_update_delete(request, pk):
    user = request.user
    try:
        course = Course.objects.get(pk=pk)
    except Course.DoesNotExist:
        return JsonResponse({'error': 'Course not found'}, status=404)
        
    if request.method == 'GET':
        data = {
            'id': course.id, 'code': course.code, 'title': course.title,
            'department_id': course.department_id, 'lecturer_id': course.lecturer_id,
            'credits': course.credits, 'is_active': course.is_active,
            'description': course.description
        }
        return JsonResponse(data)
        
    elif request.method == 'PATCH':
        if user.role != 'admin':
            return JsonResponse({'error': 'Only admins can update courses'}, status=403)
            
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)
            
        if 'department_id' in data:
            try:
                dept = Department.objects.get(pk=data['department_id'])
                course.department = dept
            except Department.DoesNotExist:
                return JsonResponse({'error': 'Invalid department_id'}, status=400)
                
        if 'lecturer_id' in data:
            lecturer_id = data['lecturer_id']
            if lecturer_id:
                lecturer = User.objects.filter(id=lecturer_id, role='lecturer').first()
                if not lecturer:
                    return JsonResponse({'error': 'Lecturer must be a user with role=lecturer'}, status=400)
                course.lecturer = lecturer
            else:
                course.lecturer = None
                
        course.title = data.get('title', course.title)
        course.code = data.get('code', course.code)
        course.credits = data.get('credits', course.credits)
        course.description = data.get('description', course.description)
        
        course.save()
        AuditEvent.objects.create(actor=user, action='course.update', description=f'Updated course {course.code}')
        return JsonResponse({'id': course.id, 'code': course.code, 'title': course.title, 'is_active': course.is_active})
        
    elif request.method == 'DELETE':
        if user.role != 'admin':
            return JsonResponse({'error': 'Only admins can delete courses'}, status=403)
            
        course.is_active = False
        course.save()
        AuditEvent.objects.create(actor=user, action='course.deactivate', description=f'Deactivated course {course.code}')
        return JsonResponse({'message': 'Course deactivated successfully'})

@csrf_exempt
@require_http_methods(["GET"])
@jwt_required
def course_roster(request, pk):
    user = request.user
    try:
        course = Course.objects.get(pk=pk)
    except Course.DoesNotExist:
        return JsonResponse({'error': 'Course not found'}, status=404)
        
    if user.role != 'admin' and course.lecturer_id != user.id:
        return JsonResponse({'error': 'Only the assigned lecturer or admin can view the roster'}, status=403)
        
    enrollments = Enrollment.objects.filter(course=course).select_related('student')
    data = [
        {
            'id': e.id,
            'student_id': e.student.id,
            'student_name': e.student.get_full_name(),
            'student_email': e.student.email,
            'status': e.status,
            'enrolled_at': e.enrolled_at.isoformat()
        } for e in enrollments
    ]
    return JsonResponse({'count': len(data), 'results': data})

# --- Enrollment Views ---

@csrf_exempt
@require_http_methods(["GET", "POST"])
@jwt_required
def enrollment_list_create(request):
    user = request.user

    if request.method == 'GET':
        enrollments = Enrollment.objects.filter(student=user).select_related('course')
        data = [
            {
                'id': e.id,
                'course_id': e.course_id,
                'course_code': e.course.code,
                'course_title': e.course.title,
                'status': e.status,
                'enrolled_at': e.enrolled_at.isoformat()
            } for e in enrollments
        ]
        return JsonResponse(data, safe=False)

    elif request.method == 'POST':
        if user.role != 'student':
            return JsonResponse({'error': 'Only students can enroll in courses'}, status=403)

        try:
            data = json.loads(request.body)
            course_id = data.get('course_id')
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)

        if not course_id:
            return JsonResponse({'error': 'course_id is required'}, status=400)

        try:
            course = Course.objects.get(pk=course_id, is_active=True)
        except Course.DoesNotExist:
            return JsonResponse({'error': 'Active course not found'}, status=404)

        _, created = Enrollment.objects.get_or_create(
            student=user,
            course=course,
            defaults={'status': 'active'}
        )
        
        if not created:
            return JsonResponse({'error': 'Already enrolled in this course'}, status=400)

        return JsonResponse({'message': 'Enrolled successfully'}, status=201)

@csrf_exempt
@require_http_methods(["DELETE"])
@jwt_required
def enrollment_drop(request, pk):
    user = request.user

    try:
        enrollment = Enrollment.objects.get(pk=pk, student=user)
    except Enrollment.DoesNotExist:
        return JsonResponse({'error': 'Enrollment not found'}, status=404)

    if enrollment.status == 'dropped':
        return JsonResponse({'message': 'Already dropped'}, status=200)

    enrollment.status = 'dropped'
    enrollment.save()
    
    return JsonResponse({'message': 'Enrollment dropped successfully'})


@csrf_exempt
@require_http_methods(['POST'])
@jwt_required
def course_bulk_assign_lecturer(request):
    if request.user.role != 'admin':
        return JsonResponse({'error': 'Only admins can assign lecturers.'}, status=403)
        
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
        
    course_ids = data.get('course_ids')
    if not isinstance(course_ids, list) or not course_ids:
        return JsonResponse({'error': 'course_ids must be a non-empty list.'}, status=400)
        
    lecturer_id = data.get('lecturer_id')
    lecturer = None
    if lecturer_id:
        lecturer = User.objects.filter(pk=lecturer_id, role='lecturer').first()
        if lecturer is None:
            return JsonResponse({'error': 'lecturer_id must reference an existing lecturer.'}, status=400)
            
    courses = list(Course.objects.filter(pk__in=course_ids))
    found_ids = {c.id for c in courses}
    missing = [cid for cid in course_ids if cid not in found_ids]
    if missing:
        return JsonResponse({'error': f'Unknown course id(s): {missing}'}, status=400)
        
    with transaction.atomic():
        updated = Course.objects.filter(pk__in=course_ids).update(lecturer=lecturer)
        AuditEvent.objects.create(
            actor=request.user,
            action='course.bulk_lecturer_assigned',
            description=f'Assigned {"lecturer " + lecturer.get_full_name() if lecturer else "no lecturer"} '
                        f'to {updated} course(s): {sorted(found_ids)}.',
        )
        
    return JsonResponse({'updated': updated, 'lecturer_id': lecturer.id if lecturer else None})
