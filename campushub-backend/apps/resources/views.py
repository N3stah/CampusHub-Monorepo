import os
import json
from django.http import JsonResponse, FileResponse, Http404
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.contrib.auth import get_user_model
from django.db.models import F
from django.conf import settings

from apps.accounts.jwt_utils import jwt_required
from apps.academics.models import Course, Enrollment
from apps.notifications.services import NotificationService
from .models import Resource, Announcement

User = get_user_model()

ALLOWED_EXTENSIONS = ['pdf', 'docx', 'pptx', 'xlsx', 'png', 'jpg']
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

def has_course_view_permission(user, course):
    if user.role == 'admin':
        return True
    if course.lecturer_id == user.id:
        return True
    if user.role == 'student':
        return Enrollment.objects.filter(student=user, course=course).exists()
    return False

def has_course_modify_permission(user, course):
    if user.role == 'admin':
        return True
    if course.lecturer_id == user.id:
        return True
    return False

def format_resource(r, request):
    return {
        'id': r.id,
        'title': r.title,
        'description': r.description,
        'file_url': request.build_absolute_uri(r.file.url) if r.file else None,
        'file_type': r.file_type,
        'file_size': r.file_size,
        'download_count': r.download_count,
        'uploaded_by': r.uploaded_by.get_full_name() if r.uploaded_by else None,
        'created_at': r.created_at.isoformat()
    }

def format_announcement(a):
    return {
        'id': a.id,
        'title': a.title,
        'body': a.body,
        'is_pinned': a.is_pinned,
        'author': a.author.get_full_name() if a.author else None,
        'created_at': a.created_at.isoformat(),
        'updated_at': a.updated_at.isoformat()
    }

# --- Resource Views ---

@csrf_exempt
@require_http_methods(["GET", "POST"])
@jwt_required
def resource_list_create(request, course_id):
    try:
        course = Course.objects.get(pk=course_id)
    except Course.DoesNotExist:
        return JsonResponse({'error': 'Course not found'}, status=404)

    user = request.user

    if request.method == 'GET':
        if not has_course_view_permission(user, course):
            return JsonResponse({'error': 'Permission denied'}, status=403)
        
        resources = Resource.objects.filter(course=course).select_related('uploaded_by')
        data = [format_resource(r, request) for r in resources]
        return JsonResponse(data, safe=False)

    elif request.method == 'POST':
        if not has_course_modify_permission(user, course):
            return JsonResponse({'error': 'Only lecturers or admins can upload resources'}, status=403)

        title = request.POST.get('title')
        description = request.POST.get('description', '')
        uploaded_file = request.FILES.get('file')

        if not title or not uploaded_file:
            return JsonResponse({'error': 'Title and file are required'}, status=400)

        if uploaded_file.size > MAX_FILE_SIZE:
            return JsonResponse({'error': 'File size exceeds 10MB limit'}, status=400)

        ext = os.path.splitext(uploaded_file.name)[1][1:].lower()
        if ext not in ALLOWED_EXTENSIONS:
            return JsonResponse({'error': f'File type {ext} not allowed. Allowed: {ALLOWED_EXTENSIONS}'}, status=400)

        resource = Resource.objects.create(
            course=course,
            uploaded_by=user,
            title=title,
            description=description,
            file=uploaded_file,
            file_type=ext,
            file_size=uploaded_file.size
        )
        
        # --- Notification Hook ---
        enrolled_students = Enrollment.objects.filter(
            course=course, status='active'
        ).values_list('student', flat=True)
        
        NotificationService.notify_bulk(
            recipients=list(enrolled_students),
            verb='resource_added',
            message=f'New resource "{resource.title}" added to {course.code}',
            actor=user,
            link=f'/courses/{course.id}/'
        )

        return JsonResponse(format_resource(resource, request), status=201)

@csrf_exempt
@require_http_methods(["GET", "PATCH", "DELETE"])
@jwt_required
def resource_detail_update_delete(request, course_id, pk):
    try:
        course = Course.objects.get(pk=course_id)
    except Course.DoesNotExist:
        return JsonResponse({'error': 'Course not found'}, status=404)

    try:
        resource = Resource.objects.get(pk=pk, course=course)
    except Resource.DoesNotExist:
        return JsonResponse({'error': 'Resource not found'}, status=404)

    user = request.user

    if request.method == 'GET':
        if not has_course_view_permission(user, course):
            return JsonResponse({'error': 'Permission denied'}, status=403)
        return JsonResponse(format_resource(resource, request))

    elif request.method == 'PATCH':
        if not has_course_modify_permission(user, course):
            return JsonResponse({'error': 'Only lecturers or admins can update resources'}, status=403)
        
        data = request.POST.dict() if request.POST else json.loads(request.body or b'{}')
        old_file_path = None
        
        if 'file' in request.FILES:
            uploaded_file = request.FILES.get('file')
            if uploaded_file.size > MAX_FILE_SIZE:
                return JsonResponse({'error': 'File size exceeds 10MB limit'}, status=400)
            ext = os.path.splitext(uploaded_file.name)[1][1:].lower()
            if ext not in ALLOWED_EXTENSIONS:
                return JsonResponse({'error': f'File type {ext} not allowed'}, status=400)
            
            old_file_path = resource.file.path
            resource.file = uploaded_file
            resource.file_type = ext
            resource.file_size = uploaded_file.size
        
        resource.title = data.get('title', resource.title)
        resource.description = data.get('description', resource.description)
        resource.save()
        
        # Delete old file only after new one is saved successfully
        if old_file_path and os.path.exists(old_file_path):
            os.remove(old_file_path)
            
        return JsonResponse(format_resource(resource, request))

    elif request.method == 'DELETE':
        if user.role != 'admin' and resource.uploaded_by_id != user.id and course.lecturer_id != user.id:
            return JsonResponse({'error': 'You can only delete resources you uploaded'}, status=403)
        
        resource.file.delete(save=False)
        resource.delete()
        return JsonResponse({'message': 'Resource deleted successfully'})

@csrf_exempt
@require_http_methods(["GET"])
@jwt_required
def download_resource(request, course_id, pk):
    try:
        course = Course.objects.get(pk=course_id)
    except Course.DoesNotExist:
        return JsonResponse({'error': 'Course not found'}, status=404)

    try:
        resource = Resource.objects.get(pk=pk, course=course)
    except Resource.DoesNotExist:
        return JsonResponse({'error': 'Resource not found'}, status=404)

    user = request.user
    if not has_course_view_permission(user, course):
        return JsonResponse({'error': 'Permission denied'}, status=403)

    if not resource.file:
        return JsonResponse({'error': 'File missing on disk'}, status=404)

    # Atomically increment download count
    Resource.objects.filter(pk=pk).update(download_count=F('download_count') + 1)
    
    try:
        file_handle = resource.file.open('rb')
        return FileResponse(file_handle, as_attachment=True, filename=os.path.basename(resource.file.name))
    except Exception:
        return JsonResponse({'error': 'File missing on disk'}, status=404)

# --- Announcement Views ---

@csrf_exempt
@require_http_methods(["GET", "POST"])
@jwt_required
def announcement_list_create(request, course_id):
    try:
        course = Course.objects.get(pk=course_id)
    except Course.DoesNotExist:
        return JsonResponse({'error': 'Course not found'}, status=404)

    user = request.user

    if request.method == 'GET':
        if not has_course_view_permission(user, course):
            return JsonResponse({'error': 'Permission denied'}, status=403)
        
        announcements = Announcement.objects.filter(course=course).select_related('author')
        data = [format_announcement(a) for a in announcements]
        return JsonResponse(data, safe=False)

    elif request.method == 'POST':
        if not has_course_modify_permission(user, course):
            return JsonResponse({'error': 'Only lecturers or admins can post announcements'}, status=403)

        try:
            data = json.loads(request.body)
            title = data.get('title')
            body = data.get('body')
            is_pinned = data.get('is_pinned', False)
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)

        if not title or not body:
            return JsonResponse({'error': 'Title and body are required'}, status=400)

        announcement = Announcement.objects.create(
            course=course,
            author=user,
            title=title,
            body=body,
            is_pinned=is_pinned
        )
        
        # --- Notification Hook ---
        enrolled_students = Enrollment.objects.filter(
            course=course, status='active'
        ).values_list('student', flat=True)
        
        NotificationService.notify_bulk(
            recipients=list(enrolled_students),
            verb='announcement_added',
            message=f'New announcement "{announcement.title}" posted to {course.code}',
            actor=user,
            link=f'/courses/{course.id}/'
        )

        return JsonResponse(format_announcement(announcement), status=201)

@csrf_exempt
@require_http_methods(["GET", "PATCH", "DELETE"])
@jwt_required
def announcement_detail_update_delete(request, course_id, pk):
    try:
        course = Course.objects.get(pk=course_id)
    except Course.DoesNotExist:
        return JsonResponse({'error': 'Course not found'}, status=404)

    try:
        announcement = Announcement.objects.get(pk=pk, course=course)
    except Announcement.DoesNotExist:
        return JsonResponse({'error': 'Announcement not found'}, status=404)

    user = request.user
    can_modify = user.role == 'admin' or course.lecturer_id == user.id or announcement.author_id == user.id

    if request.method == 'GET':
        if not has_course_view_permission(user, course):
            return JsonResponse({'error': 'Permission denied'}, status=403)
        return JsonResponse(format_announcement(announcement))

    elif request.method == 'PATCH':
        if not can_modify:
            return JsonResponse({'error': 'You do not have permission to edit this announcement'}, status=403)
        
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)

        announcement.title = data.get('title', announcement.title)
        announcement.body = data.get('body', announcement.body)
        announcement.is_pinned = data.get('is_pinned', announcement.is_pinned)
        announcement.save()
        return JsonResponse(format_announcement(announcement))

    elif request.method == 'DELETE':
        if not can_modify:
            return JsonResponse({'error': 'You do not have permission to delete this announcement'}, status=403)
        announcement.delete()
        return JsonResponse({'message': 'Announcement deleted successfully'})
