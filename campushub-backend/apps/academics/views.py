import os
import json
import csv
from django.http import HttpResponse
from django.db import transaction
from django.utils import timezone
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.contrib.auth import get_user_model

from apps.accounts.jwt_utils import jwt_required
from apps.accounts.models import AuditEvent
from .models import Department, Course, Enrollment, School, Unit, Offering, UnitTeachingAssignment, ClassSession, Assignment, AssignmentQuestion, AssignmentSubmission, GroupSet, StudentGroup
from apps.common.pagination import paginate_queryset

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
    data = [
        {
            'id': e.id,
            'student_id': e.student.id,
            'student_name': e.student.get_full_name(),
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

@csrf_exempt
@require_http_methods(["GET"])
@jwt_required
def calendar_view(request):
    user = request.user
    # Get offerings the user is involved in
    if user.role == 'student':
        course_ids = Enrollment.objects.filter(student=user, status='active').values_list('course_id', flat=True)
        offerings = Offering.objects.filter(course_id__in=course_ids)
    elif user.role == 'lecturer':
        offering_ids = UnitTeachingAssignment.objects.filter(lecturer=user).values_list('offering_id', flat=True)
        offerings = Offering.objects.filter(id__in=offering_ids)
    else: # admin
        offerings = Offering.objects.all()
        
    sessions = ClassSession.objects.filter(offering__in=offerings).select_related('offering__unit', 'offering__course')
    
    # Expand sessions to concrete dates (simplified: just return the session template)
    events = []
    for s in sessions:
        events.append({
            'id': s.id,
            'title': f"{s.offering.unit.code} - {s.offering.course.code}",
            'day_of_week': s.day_of_week,
            'start_time': str(s.start_time),
            'end_time': str(s.end_time),
            'location': s.location,
            'type': 'session'
        })
    # TODO: Add assignment due dates in Stage 3
    return JsonResponse({'count': len(events), 'results': events})


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
    else:
        assignments = Assignment.objects.all()
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
        if not is_offering_lecturer(user, offering) and user.role != 'student':
            return JsonResponse({'error': 'Permission denied'}, status=403)
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
            ext = os.path.splitext(uploaded_file.name)[1][1:].lower()
            if assignment.allowed_file_types and ext not in assignment.allowed_file_types:
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
                
        groups = group_set.groups.all()
        data = [format_group(g, include_members=True) for g in groups]
        return JsonResponse({'count': len(data), 'results': data}, status=201)
