import json
from datetime import date
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.contrib.auth import get_user_model

from apps.accounts.jwt_utils import jwt_required
from .models import Placement, Application
from .services import ApplicationService
from .validators import deadline_must_be_future
from django.core.exceptions import ValidationError

User = get_user_model()

def format_placement(p):
    return {
        "id": p.id,
        "title": p.title,
        "company": p.company,
        "location": p.location,
        "description": p.description,
        "requirements": p.requirements,
        "deadline": p.deadline.isoformat(),
        "slots_available": p.slots_available,
        "is_active": p.is_active,
        "posted_by": {
            "id": p.posted_by.id,
            "name": p.posted_by.get_full_name()
        } if p.posted_by else None,
        "created_at": p.created_at.isoformat()
    }

def format_application(a, request):
    return {
        "id": a.id,
        "placement": {
            "id": a.placement.id,
            "title": a.placement.title,
            "company": a.placement.company
        },
        "student": {
            "id": a.student.id,
            "email": a.student.email,
            "name": a.student.get_full_name()
        },
        "status": a.status,
        "cover_note": a.cover_note,
        "cv_file": request.build_absolute_uri(a.cv_file.url) if a.cv_file else None,
        "applied_at": a.applied_at.isoformat(),
        "reviewed_at": a.reviewed_at.isoformat() if a.reviewed_at else None,
        "reviewed_by": {
            "id": a.reviewed_by.id,
            "name": a.reviewed_by.get_full_name()
        } if a.reviewed_by else None
    }

# --- Placement Views ---

@csrf_exempt
@require_http_methods(["GET", "POST"])
@jwt_required
def placement_list_create(request):
    user = request.user

    if request.method == "GET":
        placements = Placement.objects.filter(is_active=True).select_related('posted_by')
        results = [format_placement(p) for p in placements]
        return JsonResponse({"count": len(results), "results": results})

    elif request.method == "POST":
        if user.role not in ['officer', 'admin']:
            return JsonResponse({"error": "Only officers or admins can create placements"}, status=403)

        try:
            data = json.loads(request.body)
            deadline = date.fromisoformat(data.get('deadline'))
            deadline_must_be_future(deadline) # Validate future date
        except (ValueError, TypeError, KeyError):
            return JsonResponse({"error": "Invalid or missing deadline. Expected format YYYY-MM-DD."}, status=400)
        except ValidationError as e:
            return JsonResponse({"error": e.message}, status=400)

        required_fields = ['title', 'company', 'location', 'description', 'requirements', 'deadline', 'slots_available']
        if not all(f in data for f in required_fields):
            return JsonResponse({"error": f"Missing required fields: {required_fields}"}, status=400)

        placement = Placement.objects.create(
            posted_by=user,
            title=data['title'],
            company=data['company'],
            location=data['location'],
            description=data['description'],
            requirements=data['requirements'],
            deadline=deadline,
            slots_available=data['slots_available']
        )
        return JsonResponse(format_placement(placement), status=201)

@csrf_exempt
@require_http_methods(["GET", "PATCH", "DELETE"])
@jwt_required
def placement_detail_update_delete(request, pk):
    try:
        placement = Placement.objects.get(pk=pk)
    except Placement.DoesNotExist:
        return JsonResponse({"error": "Placement not found"}, status=404)

    user = request.user

    if request.method == "GET":
        return JsonResponse(format_placement(placement))

    elif request.method == "PATCH":
        if user.role not in ['officer', 'admin']:
            return JsonResponse({"error": "Only officers or admins can update placements"}, status=403)
        
        try:
            data = json.loads(request.body)
            
            # Validate slots_available modification
            if 'slots_available' in data:
                active_statuses = ['pending', 'shortlisted', 'accepted']
                active_count = Application.objects.filter(placement=placement, status__in=active_statuses).count()
                if data['slots_available'] < active_count:
                    return JsonResponse({"error": f"Cannot set slots_available below active application count ({active_count})"}, status=400)

            if 'deadline' in data:
                new_deadline = date.fromisoformat(data['deadline'])
                deadline_must_be_future(new_deadline)
                placement.deadline = new_deadline

            placement.title = data.get('title', placement.title)
            placement.company = data.get('company', placement.company)
            placement.location = data.get('location', placement.location)
            placement.description = data.get('description', placement.description)
            placement.requirements = data.get('requirements', placement.requirements)
            placement.slots_available = data.get('slots_available', placement.slots_available)
            if 'is_active' in data:
                placement.is_active = data['is_active']
                
            placement.save()
            return JsonResponse(format_placement(placement))
        except ValidationError as e:
            return JsonResponse({"error": e.message}, status=400)
        except Exception as e:
            return JsonResponse({"error": "Invalid JSON or data format"}, status=400)

    elif request.method == "DELETE":
        if user.role not in ['officer', 'admin']:
            return JsonResponse({"error": "Only officers or admins can delete placements"}, status=403)
        
        placement.is_active = False
        placement.save()
        return JsonResponse({"message": "Placement deactivated successfully"})

# --- Application Views ---

@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def apply_to_placement(request, pk):
    user = request.user
    
    if user.role != 'student':
        return JsonResponse({"error": "Only students can apply for placements"}, status=403)

    try:
        data = json.loads(request.body)
        cover_note = data.get('cover_note')
        if not cover_note:
            return JsonResponse({"error": "Cover note is required"}, status=400)
        
        cv_file = request.FILES.get('cv_file') # Optional
        
        application = ApplicationService.submit(
            student=user,
            placement_id=pk,
            cover_note=cover_note,
            cv_file=cv_file
        )
        return JsonResponse(format_application(application, request), status=201)
    except ValueError as e:
        return JsonResponse({"error": str(e)}, status=400)
    except Exception as e:
        print(f"Unexpected error applying: {e}")
        return JsonResponse({"error": "Internal server error"}, status=500)

@csrf_exempt
@require_http_methods(["GET"])
@jwt_required
def application_list(request):
    user = request.user

    if user.role == 'student':
        applications = Application.objects.filter(student=user).select_related('placement', 'student', 'reviewed_by')
    elif user.role == 'officer':
        applications = Application.objects.filter(placement__posted_by=user).select_related('placement', 'student', 'reviewed_by')
    elif user.role == 'admin':
        applications = Application.objects.all().select_related('placement', 'student', 'reviewed_by')
    else:
        return JsonResponse({"error": "Permission denied"}, status=403)

    results = [format_application(a, request) for a in applications]
    return JsonResponse({"count": len(results), "results": results})

@csrf_exempt
@require_http_methods(["PATCH"])
@jwt_required
def update_application_status(request, pk):
    user = request.user
    
    if user.role not in ['officer', 'admin']:
        return JsonResponse({"error": "Only officers or admins can update application status"}, status=403)

    try:
        data = json.loads(request.body)
        new_status = data.get('status')
        
        application = ApplicationService.update_status(
            user=user,
            application_id=pk,
            new_status=new_status
        )
        return JsonResponse(format_application(application, request))
    except ValueError as e:
        return JsonResponse({"error": str(e)}, status=400)
    except PermissionError as e:
        return JsonResponse({"error": str(e)}, status=403)
    except Exception as e:
        print(f"Unexpected error updating status: {e}")
        return JsonResponse({"error": "Internal server error"}, status=500)
