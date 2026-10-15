import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.contrib.auth import get_user_model

from apps.accounts.jwt_utils import jwt_required
from .models import Department, Course, Enrollment

User = get_user_model()

@csrf_exempt
@require_http_methods(["GET"])
def department_list(request):
    """List all departments"""
    departments = Department.objects.all().values('id', 'name', 'code', 'head_id')
    return JsonResponse(list(departments), safe=False)

@csrf_exempt
@require_http_methods(["GET"])
def course_list(request):
    """List active courses, optionally filtered by department"""
    department_id = request.GET.get('department')
    
    courses = Course.objects.filter(is_active=True)
    if department_id:
        courses = courses.filter(department_id=department_id)
        
    courses_data = list(courses.values(
        'id', 'title', 'code', 'department_id', 'lecturer_id', 'credits', 'is_active'
    ))
    return JsonResponse(courses_data, safe=False)

@csrf_exempt
@require_http_methods(["GET"])
def course_detail(request, pk):
    """Retrieve a single course by ID"""
    try:
        course = Course.objects.get(pk=pk, is_active=True)
        data = {
            'id': course.id,
            'title': course.title,
            'code': course.code,
            'department_id': course.department_id,
            'lecturer_id': course.lecturer_id,
            'credits': course.credits,
            'description': course.description,
            'is_active': course.is_active
        }
        return JsonResponse(data)
    except Course.DoesNotExist:
        return JsonResponse({'error': 'Course not found'}, status=404)

@csrf_exempt
@require_http_methods(["GET", "POST"])
@jwt_required
def enrollment_list_create(request):
    """List current user's enrollments (GET) or create new enrollment (POST)"""
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

        # Check for duplicate enrollment
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
    """Drop an enrollment (set status to dropped)"""
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
