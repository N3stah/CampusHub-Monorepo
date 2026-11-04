import os
import json
import csv
from django.http import HttpResponse
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.contrib.auth import get_user_model

from apps.accounts.jwt_utils import jwt_required
from apps.accounts.models import AuditEvent
from .models import Department, Course, Enrollment, School, Unit, Offering, UnitTeachingAssignment, ClassSession, Assignment, AssignmentQuestion, AssignmentSubmission, GroupSet, StudentGroup, Lesson, AttendanceRecord
from apps.common.pagination import paginate_queryset
from apps.notifications.services import NotificationService
from datetime import timedelta

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
            'profile_picture_url': e.student.profile_picture.url if e.student.profile_picture else None,
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


# --- School Views ---

@csrf_exempt
@require_http_methods(["GET", "POST"])
@jwt_required
def school_list_create(request):
    user = request.user
    if request.method == 'GET':
        schools = School.objects.all().values('id', 'name', 'code', 'is_active')
        return paginate_queryset(schools, request)
    elif request.method == 'POST':
        if user.role != 'admin':
            return JsonResponse({'error': 'Only admins can create schools'}, status=403)
        try:
            data = json.loads(request.body)
            name = data.get('name')
            code = data.get('code')
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)
        if not name or not code:
            return JsonResponse({'error': 'Name and code are required'}, status=400)
        if School.objects.filter(name=name).exists() or School.objects.filter(code=code).exists():
            return JsonResponse({'error': 'School name or code already exists'}, status=400)
        school = School.objects.create(name=name, code=code)
        AuditEvent.objects.create(actor=user, action='school.create', description=f'Created school {school.code}')
        return JsonResponse({'id': school.id, 'name': school.name, 'code': school.code, 'is_active': school.is_active}, status=201)

@csrf_exempt
@require_http_methods(["GET", "PATCH", "DELETE"])
@jwt_required
def school_detail_update_delete(request, pk):
    user = request.user
    try:
        school = School.objects.get(pk=pk)
    except School.DoesNotExist:
        return JsonResponse({'error': 'School not found'}, status=404)
    if request.method == 'GET':
        return JsonResponse({'id': school.id, 'name': school.name, 'code': school.code, 'is_active': school.is_active})
    elif request.method == 'PATCH':
        if user.role != 'admin':
            return JsonResponse({'error': 'Only admins can update schools'}, status=403)
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)
        if 'name' in data:
            if School.objects.filter(name=data['name']).exclude(id=school.id).exists():
                return JsonResponse({'error': 'Name already exists'}, status=400)
            school.name = data['name']
        if 'code' in data:
            if School.objects.filter(code=data['code']).exclude(id=school.id).exists():
                return JsonResponse({'error': 'Code already exists'}, status=400)
            school.code = data['code']
        if 'is_active' in data:
            school.is_active = data['is_active']
        school.save()
        AuditEvent.objects.create(actor=user, action='school.update', description=f'Updated school {school.code}')
        return JsonResponse({'id': school.id, 'name': school.name, 'code': school.code, 'is_active': school.is_active})
    elif request.method == 'DELETE':
        if user.role != 'admin':
            return JsonResponse({'error': 'Only admins can delete schools'}, status=403)
        if Department.objects.filter(school=school).exists():
            return JsonResponse({'error': 'Cannot delete school with active departments'}, status=400)
        school.delete()
        AuditEvent.objects.create(actor=user, action='school.delete', description=f'Deleted school {pk}')
        return JsonResponse({'message': 'School deleted successfully'})

# --- Unit Views ---

def format_unit(unit):
    return {
        'id': unit.id,
        'code': unit.code,
        'title': unit.title,
        'credits': unit.credits,
        'description': unit.description,
        'is_active': unit.is_active,
        'departments': list(unit.departments.values('id', 'name', 'code')),
        'offerings': [
            {
                'id': o.id,
                'course_id': o.course_id,
                'course_code': o.course.code,
                'lecturers': list(o.teaching_assignments.values('lecturer_id', 'lecturer__first_name', 'lecturer__last_name'))
            } for o in unit.offerings.all()
        ]
    }

@csrf_exempt
@require_http_methods(["GET", "POST"])
@jwt_required
def unit_list_create(request):
    user = request.user
    if request.method == 'GET':
        units = Unit.objects.all().prefetch_related('departments', 'offerings', 'offerings__teaching_assignments')
        return paginate_queryset(units, request, format_unit)
    elif request.method == 'POST':
        if user.role != 'admin':
            return JsonResponse({'error': 'Only admins can create units'}, status=403)
        try:
            data = json.loads(request.body)
            code = data.get('code')
            title = data.get('title')
            credits = data.get('credits', 3)
            description = data.get('description', '')
            department_ids = data.get('department_ids', [])
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)
        if not code or not title:
            return JsonResponse({'error': 'Code and title are required'}, status=400)
        if Unit.objects.filter(code=code).exists():
            return JsonResponse({'error': 'Unit code already exists'}, status=400)
        unit = Unit.objects.create(code=code, title=title, credits=credits, description=description)
        if department_ids:
            depts = Department.objects.filter(id__in=department_ids)
            unit.departments.set(depts)
        AuditEvent.objects.create(actor=user, action='unit.create', description=f'Created unit {unit.code}')
        return JsonResponse(format_unit(unit), status=201)

@csrf_exempt
@require_http_methods(["GET", "PATCH", "DELETE"])
@jwt_required
def unit_detail_update_delete(request, pk):
    user = request.user
    try:
        unit = Unit.objects.get(pk=pk)
    except Unit.DoesNotExist:
        return JsonResponse({'error': 'Unit not found'}, status=404)
    if request.method == 'GET':
        return JsonResponse(format_unit(unit))
    elif request.method == 'PATCH':
        if user.role != 'admin':
            return JsonResponse({'error': 'Only admins can update units'}, status=403)
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)
        unit.title = data.get('title', unit.title)
        unit.code = data.get('code', unit.code)
        unit.credits = data.get('credits', unit.credits)
        unit.description = data.get('description', unit.description)
        if 'department_ids' in data:
            depts = Department.objects.filter(id__in=data['department_ids'])
            unit.departments.set(depts)
        unit.save()
        AuditEvent.objects.create(actor=user, action='unit.update', description=f'Updated unit {unit.code}')
        return JsonResponse(format_unit(unit))
    elif request.method == 'DELETE':
        if user.role != 'admin':
            return JsonResponse({'error': 'Only admins can delete units'}, status=403)
        unit.delete()
        AuditEvent.objects.create(actor=user, action='unit.delete', description=f'Deleted unit {pk}')
        return JsonResponse({'message': 'Unit deleted successfully'})

@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def unit_teaching_assignment(request, pk):
    user = request.user
    if user.role != 'admin':
        return JsonResponse({'error': 'Only admins can assign lecturers'}, status=403)
    try:
        unit = Unit.objects.get(pk=pk)
    except Unit.DoesNotExist:
        return JsonResponse({'error': 'Unit not found'}, status=404)
    try:
        data = json.loads(request.body)
        course_id = data.get('course_id')
        lecturer_id = data.get('lecturer_id')
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    if not course_id or not lecturer_id:
        return JsonResponse({'error': 'course_id and lecturer_id are required'}, status=400)
    try:
        course = Course.objects.get(pk=course_id)
    except Course.DoesNotExist:
        return JsonResponse({'error': 'Course not found'}, status=404)
    lecturer = User.objects.filter(pk=lecturer_id, role='lecturer').first()
    if not lecturer:
        return JsonResponse({'error': 'Lecturer must be a user with role=lecturer'}, status=400)
    offering, _ = Offering.objects.get_or_create(unit=unit, course=course, defaults={'is_active': True})
    assignment, created = UnitTeachingAssignment.objects.get_or_create(offering=offering, lecturer=lecturer)
    if not created:
        return JsonResponse({'error': 'Lecturer already assigned to this offering'}, status=400)
    AuditEvent.objects.create(actor=user, action='unit.teaching_assigned', description=f'Assigned {lecturer.email} to {unit.code} in {course.code}')
    return JsonResponse({'id': assignment.id, 'offering_id': offering.id, 'lecturer_id': lecturer.id}, status=201)


# --- Admin Enrollment (Admissions) Views ---

@csrf_exempt
@require_http_methods(["GET", "POST"])
@jwt_required
def admin_enrollment_list_create(request):
    user = request.user
    if user.role != 'admin':
        return JsonResponse({'error': 'Only admins can manage admissions'}, status=403)
        
    if request.method == 'GET':
        enrollments = Enrollment.objects.all().select_related('student', 'course').order_by('-enrolled_at')
        
        def fmt(e):
            return {
                'id': e.id,
                'student_id': e.student_id,
                'student_name': e.student.get_full_name(),
            'profile_picture_url': e.student.profile_picture.url if e.student.profile_picture else None,
                'admission_number': e.student.admission_number,
                'course_id': e.course_id,
                'course_code': e.course.code,
                'status': e.status,
                'enrolled_at': e.enrolled_at.isoformat()
            }
        return paginate_queryset(enrollments, request, fmt)
        
    elif request.method == 'POST':
        try:
            data = json.loads(request.body)
            admission_number = data.get('admission_number')
            course_id = data.get('course_id')
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)
            
        if not admission_number or not course_id:
            return JsonResponse({'error': 'admission_number and course_id are required'}, status=400)
            
        student = User.objects.filter(admission_number=admission_number, role='student').first()
        if not student:
            return JsonResponse({'error': 'Student not found with that admission number'}, status=400)
            
        try:
            course = Course.objects.get(pk=course_id)
        except Course.DoesNotExist:
            return JsonResponse({'error': 'Course not found'}, status=404)
            
        with transaction.atomic():
            # Drop existing active enrollment
            Enrollment.objects.filter(student=student, status='active').update(status='dropped')
            # Create new active enrollment
            enrollment = Enrollment.objects.create(student=student, course=course, status='active')
            
        AuditEvent.objects.create(actor=user, action='admin.enrollment_create', description=f'Enrolled {student.email} in {course.code}')
        return JsonResponse({
            'id': enrollment.id,
            'student_id': enrollment.student_id,
            'course_id': enrollment.course_id,
            'status': enrollment.status
        }, status=201)

@csrf_exempt
@require_http_methods(["PATCH"])
@jwt_required
def admin_enrollment_update(request, pk):
    user = request.user
    if user.role != 'admin':
        return JsonResponse({'error': 'Only admins can update enrollments'}, status=403)
        
    try:
        enrollment = Enrollment.objects.get(pk=pk)
    except Enrollment.DoesNotExist:
        return JsonResponse({'error': 'Enrollment not found'}, status=404)
        
    try:
        data = json.loads(request.body)
        course_id = data.get('course_id')
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
        
    if course_id and int(course_id) != enrollment.course_id:
        try:
            new_course = Course.objects.get(pk=course_id)
        except Course.DoesNotExist:
            return JsonResponse({'error': 'Course not found'}, status=404)
            
        with transaction.atomic():
            # Flip current to dropped
            enrollment.status = 'dropped'
            enrollment.save()
            # Drop any other active enrollments for this student
            Enrollment.objects.filter(student=enrollment.student, status='active').update(status='dropped')
            # Create new active enrollment
            new_enrollment = Enrollment.objects.create(
                student=enrollment.student,
                course=new_course,
                status='active'
            )
            
        AuditEvent.objects.create(actor=user, action='admin.enrollment_update', description=f'Moved {enrollment.student.email} to {new_course.code}')
        return JsonResponse({
            'id': new_enrollment.id,
            'student_id': new_enrollment.student_id,
            'course_id': new_enrollment.course_id,
            'status': new_enrollment.status
        })
    else:
        return JsonResponse({'error': 'No course_id provided or same as current'}, status=400)


# --- Offering Views ---

def is_offering_lecturer(user, offering):
    if user.role == 'admin':
        return True
    return offering.teaching_assignments.filter(lecturer=user).exists()

@csrf_exempt
@require_http_methods(["GET"])
@jwt_required
def offering_detail(request, pk):
    try:
        offering = Offering.objects.select_related('unit', 'course').get(pk=pk)
    except Offering.DoesNotExist:
        return JsonResponse({'error': 'Offering not found'}, status=404)
        
    lecturers = list(offering.teaching_assignments.select_related('lecturer').values('lecturer_id', 'lecturer__first_name', 'lecturer__last_name'))
    data = {
        'id': offering.id,
        'unit': {'id': offering.unit.id, 'code': offering.unit.code, 'title': offering.unit.title},
        'course': {'id': offering.course.id, 'code': offering.course.code, 'title': offering.course.title},
        'lecturers': lecturers,
        'is_active': offering.is_active
    }
    return JsonResponse(data)

@csrf_exempt
@require_http_methods(["GET"])
@jwt_required
def offering_roster(request, pk):
    user = request.user
    try:
        offering = Offering.objects.select_related('course').get(pk=pk)
    except Offering.DoesNotExist:
        return JsonResponse({'error': 'Offering not found'}, status=404)
        
    if not is_offering_lecturer(user, offering):
        return JsonResponse({'error': 'Only the assigned lecturer or admin can view the roster'}, status=403)
        
    enrollments = Enrollment.objects.filter(course=offering.course, status='active').select_related('student')
        
    search = request.GET.get('search', '').strip()
        
    if search:
        
        enrollments = enrollments.filter(
        
            Q(student__first_name__icontains=search) |
        
            Q(student__last_name__icontains=search) |
        
            Q(student__admission_number__icontains=search)
        
        )
    data = [
        {
            'id': e.id,
            'student_id': e.student.id,
            'student_name': e.student.get_full_name(),
            'profile_picture_url': e.student.profile_picture.url if e.student.profile_picture else None,
            'student_email': e.student.email,
            'admission_number': e.student.admission_number
        } for e in enrollments
    ]
    return JsonResponse({'count': len(data), 'results': data})

@csrf_exempt
@require_http_methods(["GET", "POST"])
@jwt_required
def offering_sessions(request, pk):
    user = request.user
    try:
        offering = Offering.objects.get(pk=pk)
    except Offering.DoesNotExist:
        return JsonResponse({'error': 'Offering not found'}, status=404)
        
    if request.method == 'GET':
        if not is_offering_lecturer(user, offering) and user.role != 'student':
            return JsonResponse({'error': 'Permission denied'}, status=403)
        sessions = offering.sessions.all().values('id', 'day_of_week', 'start_time', 'end_time', 'starts_on', 'ends_on', 'location')
        return JsonResponse(list(sessions), safe=False)
        
    elif request.method == 'POST':
        if not is_offering_lecturer(user, offering):
            return JsonResponse({'error': 'Only assigned lecturers or admins can create sessions'}, status=403)
        try:
            data = json.loads(request.body)
            session = ClassSession.objects.create(
                offering=offering,
                day_of_week=data['day_of_week'],
                start_time=data['start_time'],
                end_time=data['end_time'],
                starts_on=data['starts_on'],
                ends_on=data['ends_on'],
                location=data.get('location', '')
            )
        except (KeyError, json.JSONDecodeError):
            return JsonResponse({'error': 'Invalid JSON or missing fields'}, status=400)
        return JsonResponse({'id': session.id, 'day_of_week': session.day_of_week}, status=201)

@csrf_exempt
@require_http_methods(["DELETE"])
@jwt_required
def session_delete(request, pk):
    user = request.user
    try:
        session = ClassSession.objects.select_related('offering').get(pk=pk)
    except ClassSession.DoesNotExist:
        return JsonResponse({'error': 'Session not found'}, status=404)
        
    if not is_offering_lecturer(user, session.offering):
        return JsonResponse({'error': 'Only assigned lecturers or admins can delete sessions'}, status=403)
        
    session.delete()
    return JsonResponse({'message': 'Session deleted successfully'})

def _get_calendar_events(user, query_params=None):
    """Build calendar events for a user from sessions, assignments, and lessons."""
    if user.role == 'student':
        course_ids = Enrollment.objects.filter(student=user, status='active').values_list('course_id', flat=True)
        offerings = Offering.objects.filter(course_id__in=course_ids)
    elif user.role == 'lecturer':
        offering_ids = UnitTeachingAssignment.objects.filter(lecturer=user).values_list('offering_id', flat=True)
        offerings = Offering.objects.filter(id__in=offering_ids)
    else:
        offerings = Offering.objects.all()

    offering_ids = list(offerings.values_list('id', flat=True))
    now = timezone.now()
    events = []

    sessions = ClassSession.objects.filter(
        offering_id__in=offering_ids
    ).select_related('offering__unit', 'offering__course')
    for s in sessions:
        days_ahead = (s.day_of_week - now.weekday()) % 7
        next_date = (now + timedelta(days=days_ahead)).date()
        events.append({
            'id': f'class-{s.id}',
            'kind': 'class',
            'title': f"{s.offering.unit.code} - {s.offering.course.code}",
            'unit_code': s.offering.unit.code,
            'offering_id': s.offering_id,
            'date': next_date.isoformat(),
            'start_time': str(s.start_time),
            'end_time': str(s.end_time) if s.end_time else None,
            'location': getattr(s, 'location', None),
            'due_at': None,
            'day_of_week': s.day_of_week,
        })

    a_filter = {'offering_id__in': offering_ids, 'due_at__isnull': False}
    if user.role == 'student':
        a_filter['is_published'] = True
    assignments = Assignment.objects.filter(**a_filter).select_related('offering__unit')
    for a in assignments:
        events.append({
            'id': f'assignment-{a.id}',
            'kind': 'assignment',
            'title': a.title,
            'unit_code': a.offering.unit.code,
            'offering_id': a.offering_id,
            'date': a.due_at.date().isoformat(),
            'start_time': a.due_at.time().isoformat(),
            'end_time': None,
            'location': None,
            'due_at': a.due_at.isoformat(),
        })

    lessons = Lesson.objects.filter(
        offering_id__in=offering_ids,
    ).select_related('offering__unit')
    for l in lessons:
        lesson_end = l.scheduled_at + timedelta(minutes=l.duration_minutes)
        events.append({
            'id': f'lesson-{l.id}',
            'kind': 'lesson',
            'title': l.title,
            'unit_code': l.offering.unit.code,
            'offering_id': l.offering_id,
            'date': l.scheduled_at.date().isoformat(),
            'start_time': l.scheduled_at.time().isoformat(),
            'end_time': lesson_end.time().isoformat(),
            'location': None,
            'due_at': None,
        })

    if query_params:
        from_date = query_params.get('from')
        to_date = query_params.get('to')
        if from_date:
            events = [e for e in events if e['date'] >= from_date]
        if to_date:
            events = [e for e in events if e['date'] <= to_date]
    events.sort(key=lambda e: (e['date'], e['start_time']))
    return events


def _format_ics_dt(date_str, time_str):
    """Convert ISO date + time to iCalendar datetime (YYYYMMDDTHHMMSS)."""
    date_clean = date_str.replace('-', '')
    if time_str:
        parts = str(time_str).split(':')
        h = parts[0].zfill(2)[:2]
        m = parts[1].zfill(2)[:2] if len(parts) > 1 else '00'
        s = parts[2].split('.')[0].zfill(2)[:2] if len(parts) > 2 else '00'
        return f"{date_clean}T{h}{m}{s}"
    return date_clean


def _serialize_ics(events):
    """Serialize events list as an iCalendar (ICS) document."""
    lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CampusHub//Calendar//EN']
    for e in events:
        date_str = e.get('date')
        if not date_str:
            continue
        dtstart = _format_ics_dt(date_str, e.get('start_time'))
        dtend = _format_ics_dt(date_str, e.get('end_time')) if e.get('end_time') else dtstart
        lines.append('BEGIN:VEVENT')
        lines.append(f'UID:{e.get("id", "")}@campushub')
        lines.append(f'DTSTART:{dtstart}')
        lines.append(f'DTEND:{dtend}')
        lines.append(f'SUMMARY:{e.get("title", "")}')
        if e.get('location'):
            lines.append(f'LOCATION:{e["location"]}')
        lines.append('END:VEVENT')
    lines.append('END:VCALENDAR')
    return '\r\n'.join(lines)


@csrf_exempt
@require_http_methods(["GET"])
@jwt_required
def calendar_view(request):
    events = _get_calendar_events(request.user, request.GET)
    return JsonResponse(events, safe=False)


@csrf_exempt
@require_http_methods(["GET"])
@jwt_required
def calendar_ics_view(request):
    events = _get_calendar_events(request.user, request.GET)
    ics_content = _serialize_ics(events)
    return HttpResponse(ics_content, content_type='text/calendar')


# --- Assignment Views ---

def format_assignment(a, include_questions=False, include_correct=False):
    data = {
        'id': a.id,
        'offering_id': a.offering_id,
        'title': a.title,
        'instructions': a.instructions,
        'assignment_type': a.assignment_type,
        'allowed_file_types': a.allowed_file_types,
        'due_at': a.due_at.isoformat() if hasattr(a.due_at, 'isoformat') else str(a.due_at),
        'max_points': a.max_points,
        'is_published': a.is_published,
        'created_at': a.created_at.isoformat()
    }
    if include_questions:
        questions = []
        for q in a.questions.all():
            q_data = {'id': q.id, 'prompt': q.prompt, 'options': q.options}
            if include_correct:
                q_data['correct_option'] = q.correct_option
            questions.append(q_data)
        data['questions'] = questions
    return data

@csrf_exempt
@require_http_methods(["GET"])
@jwt_required
def assignment_list(request):
    user = request.user
    if user.role == 'student':
        course_ids = Enrollment.objects.filter(student=user, status='active').values_list('course_id', flat=True)
        offering_ids = Offering.objects.filter(course_id__in=course_ids).values_list('id', flat=True)
        assignments = Assignment.objects.filter(offering_id__in=offering_ids, is_published=True)
    elif user.role == 'lecturer':
        offering_ids = UnitTeachingAssignment.objects.filter(lecturer=user).values_list('offering_id', flat=True)
        assignments = Assignment.objects.filter(offering_id__in=offering_ids)
    elif user.role == 'admin':
        assignments = Assignment.objects.all()
    else:
        return JsonResponse({'error': 'Unsupported role'}, status=403)
    return paginate_queryset(assignments, request, format_assignment)

@csrf_exempt
@require_http_methods(["GET", "POST"])
@jwt_required
def offering_assignments(request, pk):
    user = request.user
    try:
        offering = Offering.objects.get(pk=pk)
    except Offering.DoesNotExist:
        return JsonResponse({'error': 'Offering not found'}, status=404)
        
    if request.method == 'GET':
        if user.role == 'admin':
            pass
        elif user.role == 'lecturer':
            if not is_offering_lecturer(user, offering):
                return JsonResponse({'error': 'Permission denied'}, status=403)
        elif user.role == 'student':
            if not Enrollment.objects.filter(student=user, course=offering.course, status='active').exists():
                return JsonResponse({'error': 'You are not enrolled in this course'}, status=403)
        else:
            return JsonResponse({'error': 'Unsupported role'}, status=403)
        if user.role == 'student':
            assignments = offering.assignments.filter(is_published=True)
        else:
            assignments = offering.assignments.all()
        return paginate_queryset(assignments, request, lambda a: format_assignment(a, include_questions=True, include_correct=is_offering_lecturer(user, offering)))
        
    elif request.method == 'POST':
        if not is_offering_lecturer(user, offering):
            return JsonResponse({'error': 'Only assigned lecturers or admins can create assignments'}, status=403)
        try:
            data = json.loads(request.body)
            # Validate type vs questions consistency
            atype = data.get('assignment_type')
            questions = data.get('questions', [])
            if atype == 'quiz':
                if not questions:
                    return JsonResponse({'error': 'Quiz assignments require at least one question'}, status=400)
                for q in questions:
                    if q.get('correct_option') is None:
                        return JsonResponse({'error': 'Each quiz question must have a correct_option'}, status=400)
            assignment = Assignment.objects.create(
                offering=offering,
                title=data['title'],
                instructions=data.get('instructions', ''),
                assignment_type=data['assignment_type'],
                allowed_file_types=data.get('allowed_file_types', []),
                due_at=timezone.now() if not data.get('due_at') else data['due_at'],
                max_points=data['max_points'],
                is_published=data.get('is_published', False)
            )
            if assignment.assignment_type == 'quiz' and 'questions' in data:
                for q in data['questions']:
                    AssignmentQuestion.objects.create(
                        assignment=assignment,
                        prompt=q['prompt'],
                        options=q['options'],
                        correct_option=q.get('correct_option')
                    )
        except (KeyError, json.JSONDecodeError):
            return JsonResponse({'error': 'Invalid JSON or missing fields'}, status=400)
        # Notify enrolled students if assignment is published
        if assignment.is_published:
            student_ids = list(Enrollment.objects.filter(
                course=offering.course, status='active'
            ).values_list('student_id', flat=True))
            if student_ids:
                NotificationService.notify_bulk(
                    recipients=student_ids,
                    verb='assignment.published',
                    message=f'New assignment: {assignment.title}',
                    actor=user,
                    link=f'/api/academics/assignments/{assignment.id}/'
                )
        return JsonResponse(format_assignment(assignment, include_questions=True, include_correct=True), status=201)

@csrf_exempt
@require_http_methods(["DELETE"])
@jwt_required
def assignment_delete(request, pk):
    user = request.user
    try:
        assignment = Assignment.objects.select_related('offering').get(pk=pk)
    except Assignment.DoesNotExist:
        return JsonResponse({'error': 'Assignment not found'}, status=404)
    if not is_offering_lecturer(user, assignment.offering):
        return JsonResponse({'error': 'Only assigned lecturers or admins can delete assignments'}, status=403)
    assignment.delete()
    return JsonResponse({'message': 'Assignment deleted successfully'})

@csrf_exempt
@require_http_methods(["GET", "POST"])
@jwt_required
def assignment_submission(request, pk):
    user = request.user
    try:
        assignment = Assignment.objects.select_related('offering').get(pk=pk)
    except Assignment.DoesNotExist:
        return JsonResponse({'error': 'Assignment not found'}, status=404)
        
    if request.method == 'GET':
        if user.role != 'student':
            return JsonResponse({'error': 'Only students can view their own submission'}, status=403)
        sub = AssignmentSubmission.objects.filter(assignment=assignment, student=user).first()
        if sub:
            released = sub.released_at is not None
            score = str(sub.score) if sub.score and released else None
            feedback = sub.feedback if released else None
            return JsonResponse({'submission': {'id': sub.id, 'score': score, 'submitted_at': sub.submitted_at.isoformat(), 'feedback': feedback, 'released_at': sub.released_at.isoformat() if sub.released_at else None}})
        return JsonResponse({'submission': None})
        
    elif request.method == 'POST':
        
        # Submission deadline enforcement
        
        if assignment.due_at and timezone.now() > assignment.due_at:
        
            return JsonResponse({'error': 'Submission deadline has passed'}, status=400)
        if user.role != 'student':
            return JsonResponse({'error': 'Only students can submit assignments'}, status=403)
            
            
        # Check if already submitted
        if AssignmentSubmission.objects.filter(assignment=assignment, student=user).exists():
            return JsonResponse({'error': 'Already submitted'}, status=400)
            
        if assignment.assignment_type == 'file':
            uploaded_file = request.FILES.get('file')
            if not uploaded_file:
                return JsonResponse({'error': 'File is required for file-type assignments'}, status=400)
            # File size guard (10 MB max)
            MAX_FILE_SIZE = 10 * 1024 * 1024
            if uploaded_file.size > MAX_FILE_SIZE:
                return JsonResponse({'error': 'File too large (max 10MB)'}, status=400)
            # Extension guard: assignment whitelist or global default
            DEFAULT_ALLOWED_TYPES = ['pdf', 'docx', 'doc', 'txt', 'png', 'jpg', 'jpeg', 'zip']
            allowed_types = assignment.allowed_file_types or DEFAULT_ALLOWED_TYPES
            ext = os.path.splitext(uploaded_file.name)[1][1:].lower()
            if ext not in allowed_types:
                return JsonResponse({'error': f'File type {ext} not allowed'}, status=400)
            submission = AssignmentSubmission.objects.create(
                assignment=assignment, student=user, file=uploaded_file
            )
        else:  # quiz
            try:
                data = json.loads(request.body)
                answers = data.get('answers', {})
            except json.JSONDecodeError:
                return JsonResponse({'error': 'Invalid JSON'}, status=400)
                
            # Auto-mark quiz
            correct_count = 0
            total_questions = 0
            for q in assignment.questions.all():
                total_questions += 1
                if str(q.id) in answers and answers[str(q.id)] == q.correct_option:
                    correct_count += 1
                    
            score = (correct_count / total_questions * assignment.max_points) if total_questions > 0 else 0
            submission = AssignmentSubmission.objects.create(
                assignment=assignment, student=user, answers=answers, score=score, graded_at=timezone.now(), released_at=timezone.now()
            )
            
        return JsonResponse({'id': submission.id, 'score': str(submission.score) if submission.score else None}, status=201)


# --- Submission Management Views ---

@csrf_exempt
@require_http_methods(["GET"])
@jwt_required
def assignment_submissions_list(request, pk):
    user = request.user
    try:
        assignment = Assignment.objects.select_related('offering').get(pk=pk)
    except Assignment.DoesNotExist:
        return JsonResponse({'error': 'Assignment not found'}, status=404)
        
    if not is_offering_lecturer(user, assignment.offering):
        return JsonResponse({'error': 'Only assigned lecturers or admins can view all submissions'}, status=403)
        
    submissions = assignment.submissions.all().select_related('student')
    data = [
        {
            'id': s.id,
            'student_id': s.student_id,
            'student_name': s.student.get_full_name(),
            'profile_picture_url': s.student.profile_picture.url if s.student.profile_picture else None,
            'submitted_at': s.submitted_at.isoformat(),
            'score': str(s.score) if s.score else None,
            'feedback': s.feedback,
            'graded_at': s.graded_at.isoformat() if s.graded_at else None
        } for s in submissions
    ]
    return JsonResponse({'count': len(data), 'results': data})

@csrf_exempt
@require_http_methods(["GET"])
@jwt_required
def submission_download(request, pk):
    user = request.user
    try:
        submission = AssignmentSubmission.objects.select_related('assignment__offering', 'student').get(pk=pk)
    except AssignmentSubmission.DoesNotExist:
        return JsonResponse({'error': 'Submission not found'}, status=404)
        
    # Permission: submitting student, assigned lecturer, or admin
    if user.role != 'admin' and submission.student_id != user.id and not is_offering_lecturer(user, submission.assignment.offering):
        return JsonResponse({'error': 'Not found'}, status=404)
        
    if not submission.file:
        return JsonResponse({'error': 'No file attached'}, status=404)
        
    file_handle = submission.file.open('rb')
    from django.http import FileResponse
    return FileResponse(file_handle, as_attachment=True, filename=os.path.basename(submission.file.name))

@csrf_exempt
@require_http_methods(["PATCH"])
@jwt_required
def submission_grade(request, pk):
    user = request.user
    try:
        submission = AssignmentSubmission.objects.select_related('assignment__offering').get(pk=pk)
    except AssignmentSubmission.DoesNotExist:
        return JsonResponse({'error': 'Submission not found'}, status=404)
        
    if not is_offering_lecturer(user, submission.assignment.offering):
        return JsonResponse({'error': 'Only assigned lecturers or admins can grade submissions'}, status=403)
        
    try:
        data = json.loads(request.body)
        score = data.get('score')
        feedback = data.get('feedback', '')
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
        
    submission.score = score
    submission.feedback = feedback
    submission.graded_at = timezone.now()
    released = data.get('released', True)
    if released:
        submission.released_at = timezone.now()
    else:
        submission.released_at = None
    submission.save(update_fields=['score', 'feedback', 'graded_at', 'released_at'])
    
    # Notify student if grade is released
    if released:
        NotificationService.notify(
            recipient=submission.student,
            verb='grade.released',
            message=f'Grade released for {submission.assignment.title}',
            actor=user,
            link=f'/api/academics/assignments/{submission.assignment_id}/submission/'
        )
    return JsonResponse({'id': submission.id, 'score': str(submission.score), 'feedback': submission.feedback})

@csrf_exempt
@require_http_methods(["GET"])
@jwt_required
def offering_grades_csv(request, pk):
    user = request.user
    try:
        offering = Offering.objects.select_related('course').get(pk=pk)
    except Offering.DoesNotExist:
        return JsonResponse({'error': 'Offering not found'}, status=404)
        
    if not is_offering_lecturer(user, offering):
        return JsonResponse({'error': 'Only assigned lecturers or admins can export grades'}, status=403)
        
    enrollments = Enrollment.objects.filter(course=offering.course, status='active').select_related('student')
    assignments = offering.assignments.all()
    
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="grades_offering_{pk}.csv"'
    
    writer = csv.writer(response)
    header = ['Student', 'Admission Number'] + [a.title for a in assignments]
    writer.writerow(header)
    
    for e in enrollments:
        row = [e.student.get_full_name(), e.student.admission_number or '']
        for a in assignments:
            sub = AssignmentSubmission.objects.filter(assignment=a, student=e.student).first()
            row.append(str(sub.score) if sub and sub.score else '')
        writer.writerow(row)
        
    return response


# --- Student Groups Views ---

def format_group(group, include_members=False):
    data = {
        'id': group.id,
        'name': group.name,
    }
    if include_members:
        data['members'] = list(group.members.values('id', 'first_name', 'last_name', 'email'))
    return data

@csrf_exempt
@require_http_methods(["GET", "POST"])
@jwt_required
def offering_groups(request, pk):
    user = request.user
    try:
        offering = Offering.objects.select_related('course').get(pk=pk)
    except Offering.DoesNotExist:
        return JsonResponse({'error': 'Offering not found'}, status=404)
        
    if request.method == 'GET':
        try:
            group_set = offering.group_set
        except GroupSet.DoesNotExist:
            return JsonResponse({'count': 0, 'results': []})
            
        if is_offering_lecturer(user, offering) or user.role == 'admin':
            groups = group_set.groups.all()
            data = [format_group(g, include_members=True) for g in groups]
            return JsonResponse({'count': len(data), 'results': data})
        else:
            group = group_set.groups.filter(members=user).first()
            if group:
                return JsonResponse({'count': 1, 'results': [format_group(group, include_members=True)]})
            return JsonResponse({'count': 0, 'results': []})
            
    elif request.method == 'POST':
        if not is_offering_lecturer(user, offering):
            return JsonResponse({'error': 'Only assigned lecturers or admins can manage groups'}, status=403)
            
        try:
            data = json.loads(request.body)
            naming_scheme = data.get('naming_scheme', 'letters')
            students_per_group = int(data.get('students_per_group', 3))
        except (json.JSONDecodeError, ValueError):
            return JsonResponse({'error': 'Invalid JSON'}, status=400)
            
        if naming_scheme not in ['letters', 'numbers']:
            return JsonResponse({'error': 'naming_scheme must be letters or numbers'}, status=400)
        if students_per_group < 1:
            return JsonResponse({'error': 'students_per_group must be at least 1'}, status=400)
            
        students = list(User.objects.filter(
            enrollments__course=offering.course,
            enrollments__status='active',
            role='student'
        ).distinct())
        
        if not students:
            return JsonResponse({'error': 'No enrolled students to group'}, status=400)
            
        with transaction.atomic():
            if hasattr(offering, 'group_set'):
                offering.group_set.delete()
                
            group_set = GroupSet.objects.create(
                offering=offering,
                naming_scheme=naming_scheme,
                students_per_group=students_per_group
            )
            
            import random
            random.shuffle(students)
            
            num_groups = (len(students) + students_per_group - 1) // students_per_group
            for i in range(num_groups):
                if naming_scheme == 'letters':
                    name = chr(65 + i)
                else:
                    name = str(i + 1)
                    
                group = StudentGroup.objects.create(group_set=group_set, name=name)
                chunk = students[i * students_per_group : (i + 1) * students_per_group]
                group.members.set(chunk)
                
        # Notify all shuffled students
        NotificationService.notify_bulk(
            recipients=students,
            verb='groups.shuffled',
            message=f'Groups assigned for {offering}',
            actor=user,
            link=f'/api/academics/offerings/{offering.id}/groups/'
        )
        
        groups = group_set.groups.all()
        data = [format_group(g, include_members=True) for g in groups]
        return JsonResponse({'count': len(data), 'results': data}, status=201)

@csrf_exempt
@require_http_methods(["GET"])
@jwt_required
def offering_roster_csv(request, pk):
    user = request.user
    try:
        offering = Offering.objects.select_related('course').get(pk=pk)
    except Offering.DoesNotExist:
        return JsonResponse({'error': 'Offering not found'}, status=404)

    if not is_offering_lecturer(user, offering):
        return JsonResponse({'error': 'Only assigned lecturers or admins can export roster'}, status=403)

    enrollments = Enrollment.objects.filter(course=offering.course).select_related('student').order_by('student__last_name')

    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="roster_offering_{pk}.csv"'

    writer = csv.writer(response)
    writer.writerow(['Student', 'Email', 'Admission Number', 'Enrollment Status', 'Enrolled At'])

    for e in enrollments:
        writer.writerow([
            e.student.get_full_name(),
            e.student.email,
            e.student.admission_number or '',
            e.status,
            e.enrolled_at.isoformat() if e.enrolled_at else ''
        ])

    return response

@csrf_exempt
@require_http_methods(["GET"])
@jwt_required
def student_dashboard(request):
    user = request.user
    if user.role != 'student':
        return JsonResponse({'error': 'Only students can access this endpoint'}, status=403)

    now = timezone.now()
    week_ahead = now + timedelta(days=7)

    enrollments = Enrollment.objects.filter(student=user, status='active').select_related('course')
    courses = [{'id': e.course.id, 'code': e.course.code, 'title': e.course.title} for e in enrollments]

    course_ids = [e.course_id for e in enrollments]
    offering_ids = list(Offering.objects.filter(course_id__in=course_ids).values_list('id', flat=True))

    upcoming = Assignment.objects.filter(
        offering_id__in=offering_ids, is_published=True,
        due_at__gte=now, due_at__lte=week_ahead
    ).order_by('due_at')
    upcoming_data = [
        {'id': a.id, 'title': a.title, 'due_at': a.due_at.isoformat(), 'offering_id': a.offering_id, 'assignment_type': a.assignment_type}
        for a in upcoming
    ]

    submitted_ids = set(AssignmentSubmission.objects.filter(
        student=user, assignment__in=upcoming
    ).values_list('assignment_id', flat=True))
    pending_count = len(upcoming_data) - len(submitted_ids)

    recent_grades = AssignmentSubmission.objects.filter(
        student=user, released_at__isnull=False, graded_at__isnull=False
    ).order_by('-graded_at')[:5]
    grades_data = [
        {'assignment_id': s.assignment_id, 'assignment_title': s.assignment.title,
         'score': str(s.score) if s.score else None, 'max_points': s.assignment.max_points,
         'released_at': s.released_at.isoformat()}
        for s in recent_grades
    ]

    groups = StudentGroup.objects.filter(members=user).select_related('group_set__offering')
    groups_data = [
        {'group_id': g.id, 'group_name': g.name, 'offering_id': g.group_set.offering_id, 'members_count': g.members.count()}
        for g in groups
    ]

    return JsonResponse({
        'courses': courses,
        'upcoming_assignments': upcoming_data,
        'pending_submissions_count': pending_count,
        'recent_grades': grades_data,
        'groups': groups_data
    })


@csrf_exempt
@require_http_methods(["GET"])
@jwt_required
def lecturer_dashboard(request):
    user = request.user
    if user.role != 'lecturer' and user.role != 'admin':
        return JsonResponse({'error': 'Only lecturers can access this endpoint'}, status=403)

    now = timezone.now()

    if user.role == 'admin':
        taught_offerings = Offering.objects.all().select_related('course', 'unit')
    else:
        ta = UnitTeachingAssignment.objects.filter(lecturer=user).values_list('offering_id', flat=True)
        taught_offerings = Offering.objects.filter(id__in=ta).select_related('course', 'unit')

    offerings_data = [
        {'id': o.id, 'course_code': o.course.code, 'unit_code': o.unit.code, 'is_active': o.is_active}
        for o in taught_offerings
    ]

    taught_ids = list(taught_offerings.values_list('id', flat=True))
    pending_qs = AssignmentSubmission.objects.filter(
        assignment__offering_id__in=taught_ids, graded_at__isnull=True
    ).select_related('student', 'assignment').order_by('-submitted_at')
    pending_data = [
        {'id': s.id, 'student_name': s.student.get_full_name(),
            'profile_picture_url': s.student.profile_picture.url if s.student.profile_picture else None,
         'assignment_title': s.assignment.title, 'submitted_at': s.submitted_at.isoformat()}
        for s in pending_qs[:20]
    ]

    today_weekday = now.weekday()
    today_sessions = ClassSession.objects.filter(
        offering_id__in=taught_ids, day_of_week=today_weekday
    ).select_related('offering__course', 'offering__unit')
    sessions_data = [
        {'id': s.id, 'offering_id': s.offering_id, 'course_code': s.offering.course.code,
         'start_time': getattr(s, 'start_time', None).isoformat() if getattr(s, 'start_time', None) else None,
         'end_time': getattr(s, 'end_time', None).isoformat() if getattr(s, 'end_time', None) else None,
         'room': getattr(s, 'location', None)}
        for s in today_sessions
    ]

    return JsonResponse({
        'taught_offerings': offerings_data,
        'pending_grading_count': pending_qs.count(),
        'pending_submissions': pending_data,
        'today_sessions': sessions_data
    })

# --- Lesson Plan Views ---

def format_lesson(lesson):
    return {
        'id': lesson.id,
        'offering_id': lesson.offering_id,
        'title': lesson.title,
        'description': lesson.description,
        'scheduled_at': lesson.scheduled_at.isoformat(),
        'duration_minutes': lesson.duration_minutes,
        'created_at': lesson.created_at.isoformat(),
    }


def check_lesson_overlap(lecturer, scheduled_at, duration_minutes, exclude_lesson_id=None):
    """Returns error message string if overlap found, None otherwise.
    Checks both Lesson and ClassSession conflicts for all offerings the lecturer teaches."""
    from datetime import timedelta
    lesson_end = scheduled_at + timedelta(minutes=duration_minutes)
    lesson_weekday = scheduled_at.weekday()

    taught_ids = list(UnitTeachingAssignment.objects.filter(
        lecturer=lecturer
    ).values_list('offering_id', flat=True))

    # Lesson overlaps (same date)
    lessons_qs = Lesson.objects.filter(
        offering_id__in=taught_ids,
        scheduled_at__date=scheduled_at.date(),
    )
    if exclude_lesson_id:
        lessons_qs = lessons_qs.exclude(pk=exclude_lesson_id)
    for other in lessons_qs:
        other_end = other.scheduled_at + timedelta(minutes=other.duration_minutes)
        if scheduled_at < other_end and lesson_end > other.scheduled_at:
            return f'Lesson overlaps with "{other.title}" at {other.scheduled_at.isoformat()}'

    # ClassSession overlaps (same weekday, time-of-day comparison)
    sessions = ClassSession.objects.filter(
        offering_id__in=taught_ids,
        day_of_week=lesson_weekday,
    )
    ls, le = scheduled_at.time(), lesson_end.time()
    for s in sessions:
        ss = getattr(s, 'start_time', None)
        se = getattr(s, 'end_time', None)
        if ss and se and ls < se and le > ss:
            return f'Lesson overlaps with class session ({ss}-{se})'

    return None


@csrf_exempt
@require_http_methods(["GET", "POST"])
@jwt_required
def offering_lessons(request, pk):
    user = request.user
    try:
        offering = Offering.objects.select_related('course', 'unit').get(pk=pk)
    except Offering.DoesNotExist:
        return JsonResponse({'error': 'Offering not found'}, status=404)

    if request.method == 'GET':
        is_lect = is_offering_lecturer(user, offering)
        is_stu = user.role == 'student' and Enrollment.objects.filter(
            student=user, course=offering.course, status='active').exists()
        if not is_lect and not is_stu and user.role != 'admin':
            return JsonResponse({'error': 'Permission denied'}, status=403)
        lessons = offering.lessons.all().order_by('scheduled_at')
        data = [format_lesson(l) for l in lessons]
        return JsonResponse({'count': len(data), 'results': data})

    elif request.method == 'POST':
        if not is_offering_lecturer(user, offering):
            return JsonResponse({'error': 'Only assigned lecturers or admins can create lessons'}, status=403)
        try:
            data = json.loads(request.body)
            title = data['title']
            sa_raw = data['scheduled_at']
            duration_minutes = int(data['duration_minutes'])
            description = data.get('description', '')
        except (KeyError, json.JSONDecodeError, ValueError):
            return JsonResponse({'error': 'Invalid JSON or missing fields (title, scheduled_at, duration_minutes)'}, status=400)

        from datetime import datetime
        try:
            scheduled_at = datetime.fromisoformat(sa_raw) if isinstance(sa_raw, str) else sa_raw
        except ValueError:
            return JsonResponse({'error': 'Invalid scheduled_at format (use ISO 8601)'}, status=400)

        overlap = check_lesson_overlap(user, scheduled_at, duration_minutes)
        if overlap:
            return JsonResponse({'error': overlap}, status=400)

        lesson = Lesson.objects.create(
            offering=offering, title=title, description=description,
            scheduled_at=scheduled_at, duration_minutes=duration_minutes)
        return JsonResponse(format_lesson(lesson), status=201)


@csrf_exempt
@require_http_methods(["PATCH", "DELETE"])
@jwt_required
def lesson_detail(request, pk):
    user = request.user
    try:
        lesson = Lesson.objects.select_related('offering__course', 'offering__unit').get(pk=pk)
    except Lesson.DoesNotExist:
        return JsonResponse({'error': 'Lesson not found'}, status=404)

    if not is_offering_lecturer(user, lesson.offering):
        return JsonResponse({'error': 'Only assigned lecturers or admins can manage lessons'}, status=403)

    if request.method == 'DELETE':
        lesson.delete()
        return JsonResponse({'message': 'Lesson deleted successfully'})

    elif request.method == 'PATCH':
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)

        from datetime import datetime
        new_sa = data.get('scheduled_at')
        new_dur = data.get('duration_minutes')

        if new_sa:
            try:
                lesson.scheduled_at = datetime.fromisoformat(new_sa) if isinstance(new_sa, str) else new_sa
            except ValueError:
                return JsonResponse({'error': 'Invalid scheduled_at format'}, status=400)
        if new_dur is not None:
            lesson.duration_minutes = int(new_dur)

        if new_sa or new_dur is not None:
            overlap = check_lesson_overlap(user, lesson.scheduled_at, lesson.duration_minutes, exclude_lesson_id=lesson.id)
            if overlap:
                return JsonResponse({'error': overlap}, status=400)

        if 'title' in data:
            lesson.title = data['title']
        if 'description' in data:
            lesson.description = data['description']

        lesson.save()
        return JsonResponse(format_lesson(lesson))

# --- Attendance Views ---

def format_attendance_session(session):
    return {
        'id': session.id,
        'offering_id': session.offering_id,
        'day_of_week': session.day_of_week,
        'start_time': str(session.start_time),
        'end_time': str(session.end_time) if session.end_time else None,
        'room': getattr(session, 'room', None),
        'unit_code': session.offering.unit.code,
        'unit_title': getattr(session.offering.unit, 'title', ''),
        'course_code': session.offering.course.code,
        'course_title': session.offering.course.title,
    }


def _build_attendance_records(session, attendance_date):
    """Build AttendanceRow list — one per enrolled student, unmarked = status null."""
    enrollments = Enrollment.objects.filter(
        course=session.offering.course, status='active'
    ).select_related('student').order_by('student__last_name', 'student__first_name')
    saved = {
        r.student_id: r for r in AttendanceRecord.objects.filter(
            session=session, date=attendance_date
        )
    }
    records = []
    for e in enrollments:
        r = saved.get(e.student_id)
        records.append({
            'student_id': e.student_id,
            'student_name': e.student.get_full_name(),
            'profile_picture_url': e.student.profile_picture.url if e.student.profile_picture else None,
            'admission_number': e.student.admission_number or None,
            'course_code': session.offering.course.code,
            'course_title': session.offering.course.title,
            'status': r.status if r else None,
            'note': r.note if r else '',
        })
    return records


@csrf_exempt
@require_http_methods(["GET", "PUT"])
@jwt_required
def session_attendance(request, pk):
    user = request.user
    try:
        session = ClassSession.objects.select_related(
            'offering__course', 'offering__unit'
        ).get(pk=pk)
    except ClassSession.DoesNotExist:
        return JsonResponse({'error': 'Session not found'}, status=404)

    if not is_offering_lecturer(user, session.offering) and user.role != 'admin':
        return JsonResponse({'error': 'Only assigned lecturers or admins can manage attendance'}, status=403)

    date_str = request.GET.get('date')
    if not date_str:
        return JsonResponse({'error': 'date parameter is required (YYYY-MM-DD)'}, status=400)
    from datetime import datetime as dt_cls
    try:
        attendance_date = dt_cls.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        return JsonResponse({'error': 'Invalid date format (use YYYY-MM-DD)'}, status=400)

    if request.method == 'GET':
        return JsonResponse({
            'session': format_attendance_session(session),
            'date': date_str,
            'records': _build_attendance_records(session, attendance_date),
        })

    elif request.method == 'PUT':
        try:
            data = json.loads(request.body)
            records_data = data.get('records', [])
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)
        if not isinstance(records_data, list):
            return JsonResponse({'error': 'records must be a list'}, status=400)

        valid_statuses = {'present', 'late', 'absent', 'excused'}
        with transaction.atomic():
            for row in records_data:
                sid = row.get('student_id')
                status = row.get('status')
                note = row.get('note', '')
                if not sid or status not in valid_statuses:
                    return JsonResponse({'error': f'Invalid record: student_id and valid status required'}, status=400)
                AttendanceRecord.objects.update_or_create(
                    session=session,
                    student_id=sid,
                    date=attendance_date,
                    defaults={'status': status, 'note': note, 'recorded_by': user}
                )
        return JsonResponse({
            'session': format_attendance_session(session),
            'date': date_str,
            'records': _build_attendance_records(session, attendance_date),
        })


# --- At-Risk Students ---

@csrf_exempt
@require_http_methods(["GET"])
@jwt_required
def offering_at_risk(request, pk):
    user = request.user
    try:
        offering = Offering.objects.get(pk=pk)
    except Offering.DoesNotExist:
        return JsonResponse({'error': 'Offering not found'}, status=404)

    if not is_offering_lecturer(user, offering):
        return JsonResponse({'error': 'Only the assigned lecturer or admin can view at-risk students'}, status=403)

    try:
        attendance_threshold = float(request.GET.get('attendance_threshold', '0.75'))
    except ValueError:
        return JsonResponse({'error': 'attendance_threshold must be a number'}, status=400)
    try:
        missed_threshold = int(request.GET.get('missed_threshold', '2'))
    except ValueError:
        return JsonResponse({'error': 'missed_threshold must be an integer'}, status=400)

    enrollments = Enrollment.objects.filter(
        course=offering.course, status='active'
    ).select_related('student')

    session_ids = list(ClassSession.objects.filter(offering=offering).values_list('id', flat=True))

    now = timezone.now()
    past_assignment_ids = list(
        Assignment.objects.filter(offering=offering, is_published=True, due_at__lt=now)
        .values_list('id', flat=True)
    )
    total_assignments = len(past_assignment_ids)

    attendance_map = {}
    for ar in AttendanceRecord.objects.filter(
        session__in=session_ids, status__in=['present', 'late', 'absent']
    ).values('student_id', 'status'):
        sid = ar['student_id']
        if sid not in attendance_map:
            attendance_map[sid] = {'attended': 0, 'total': 0}
        attendance_map[sid]['total'] += 1
        if ar['status'] in ('present', 'late'):
            attendance_map[sid]['attended'] += 1

    submitted_count_map = {}
    for aid, sid in AssignmentSubmission.objects.filter(
        assignment_id__in=past_assignment_ids
    ).values_list('assignment_id', 'student_id'):
        submitted_count_map[sid] = submitted_count_map.get(sid, 0) + 1

    data = []
    for e in enrollments:
        student = e.student
        sid = student.id
        att = attendance_map.get(sid, {'attended': 0, 'total': 0})
        attended = att['attended']
        total = att['total']
        attendance_rate = (attended / total) if total > 0 else 1.0
        submitted_count = submitted_count_map.get(sid, 0)
        missed_count = total_assignments - submitted_count

        reasons = []
        if total > 0 and attendance_rate < attendance_threshold:
            reasons.append('attendance')
        if missed_count >= missed_threshold:
            reasons.append('assignments')

        data.append({
            'student_id': sid,
            'student_name': student.get_full_name(),
            'profile_picture_url': student.profile_picture.url if student.profile_picture else None,
            'student_email': student.email,
            'admission_number': student.admission_number,
            'attendance_rate': round(attendance_rate, 4),
            'attended_sessions': attended,
            'total_sessions': total,
            'missed_assignments': missed_count,
            'total_assignments': total_assignments,
            'at_risk': len(reasons) > 0,
            'reasons': reasons,
        })

    data.sort(key=lambda x: (not x['at_risk'], x['attendance_rate']))
    return JsonResponse({'count': len(data), 'results': data})


# --- Lecturer Placements ---

@csrf_exempt
@require_http_methods(["GET"])
@jwt_required
def lecturer_placements(request):
    user = request.user
    if user.role not in ('lecturer', 'admin'):
        return JsonResponse({'error': 'Only lecturers or admins can view this'}, status=403)

    if user.role == 'admin':
        offering_ids = list(Offering.objects.values_list('id', flat=True))
    else:
        offering_ids = list(
            UnitTeachingAssignment.objects.filter(lecturer=user)
            .values_list('offering_id', flat=True)
        )

    course_ids = list(
        Offering.objects.filter(id__in=offering_ids)
        .values_list('course_id', flat=True)
    )

    enrollments = list(
        Enrollment.objects.filter(course_id__in=course_ids, status='active')
        .select_related('student', 'course')
    )

    student_ids = [e.student_id for e in enrollments]

    from apps.placements.models import Application
    accepted_apps = {}
    for app in Application.objects.filter(
        student_id__in=student_ids, status='accepted'
    ).select_related('placement'):
        accepted_apps[app.student_id] = app

    data = []
    for e in enrollments:
        student = e.student
        app = accepted_apps.get(student.id)
        data.append({
            'student_id': student.id,
            'student_name': student.get_full_name(),
            'profile_picture_url': student.profile_picture.url if student.profile_picture else None,
            'student_email': student.email,
            'admission_number': student.admission_number,
            'course_code': e.course.code,
            'placement': {
                'id': app.placement.id,
                'title': app.placement.title,
                'company': app.placement.company,
                'location': app.placement.location,
                'deadline': app.placement.deadline.isoformat(),
            } if app else None
        })

    data.sort(key=lambda x: (x['course_code'], x['student_name']))
    return JsonResponse({'count': len(data), 'results': data})


# --- Class Prefect Toggle ---

@csrf_exempt
@require_http_methods(["PATCH"])
@jwt_required
def toggle_prefect(request, pk):
    """PATCH /api/academics/enrollments/<id>/prefect/ — lecturer or admin only.
    Body: {"is_class_prefect": true/false} to set explicitly, or empty to toggle.
    """
    import json as _json
    user = request.user
    if user.role not in ('lecturer', 'admin'):
        return JsonResponse({'error': 'Only lecturers or admins can set prefect status'}, status=403)

    try:
        enrollment = Enrollment.objects.select_related('student', 'course').get(pk=pk)
    except Enrollment.DoesNotExist:
        return JsonResponse({'error': 'Enrollment not found'}, status=404)

    # Lecturer must teach an offering in this enrollment's course
    if user.role == 'lecturer':
        teaches = UnitTeachingAssignment.objects.filter(
            lecturer=user, offering__course=enrollment.course
        ).exists()
        if not teaches:
            return JsonResponse({'error': 'You can only set prefects for your own courses'}, status=403)

    try:
        data = _json.loads(request.body) if request.body else {}
    except _json.JSONDecodeError:
        data = {}

    if 'is_class_prefect' in data:
        enrollment.is_class_prefect = bool(data['is_class_prefect'])
    else:
        enrollment.is_class_prefect = not enrollment.is_class_prefect
    enrollment.save(update_fields=['is_class_prefect'])

    return JsonResponse({
        'id': enrollment.id,
        'student_id': enrollment.student_id,
        'student_name': enrollment.student.get_full_name(),
        'course_id': enrollment.course_id,
        'is_class_prefect': enrollment.is_class_prefect,
    })
