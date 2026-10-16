import json
from datetime import date
import logging

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.contrib.auth import get_user_model
from django.db.models import Q

from apps.accounts.jwt_utils import jwt_required
from apps.accounts.models import AuditEvent
from .models import Placement, Application
from .services import ApplicationService
from .validators import deadline_must_be_future
from django.core.exceptions import ValidationError

User = get_user_model()
logger = logging.getLogger(__name__)

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
            "name": a.student.get_full_name(),
            "first_name": a.student.first_name,
            "last_name": a.student.last_name,
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
        search = request.GET.get('search', '').strip()
        if search:
            placements = placements.filter(
                Q(title__icontains=search)
                | Q(company__icontains=search)
                | Q(location__icontains=search)
            )
        results = [format_placement(p) for p in placements]
        return JsonResponse({"count": len(results), "results": results})

    elif request.method == "POST":
        if user.role not in ['officer', 'admin']:
            return JsonResponse({"error": "Only officers or admins can create placements"}, status=403)

        try:
            data = json.loads(request.body or b'{}')
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON."}, status=400)
        if not isinstance(data, dict):
            return JsonResponse({"error": "Expected a JSON object."}, status=400)

        required_fields = ['title', 'company', 'location', 'description', 'requirements', 'deadline', 'slots_available']
        if not all(f in data for f in required_fields):
            return JsonResponse({"error": f"Missing required fields: {required_fields}"}, status=400)
        for field in required_fields[:5]:
            if not isinstance(data[field], str) or not data[field].strip():
                return JsonResponse({"error": f"{field} is required."}, status=400)
            data[field] = data[field].strip()
        try:
            deadline = date.fromisoformat(data['deadline'])
            deadline_must_be_future(deadline)
            raw_slots = data['slots_available']
            if isinstance(raw_slots, bool):
                raise ValueError('slots_available must be an integer.')
            if isinstance(raw_slots, int):
                slots_available = raw_slots
            elif isinstance(raw_slots, str) and raw_slots.isdecimal():
                slots_available = int(raw_slots)
            else:
                raise ValueError('slots_available must be an integer.')
            if slots_available < 1:
                raise ValueError('slots_available must be at least 1.')
        except (ValueError, TypeError):
            return JsonResponse({"error": "Invalid deadline or slot count."}, status=400)
        except ValidationError as e:
            return JsonResponse({"error": e.message}, status=400)
        placement = Placement.objects.create(
            posted_by=user,
            title=data['title'],
            company=data['company'],
            location=data['location'],
            description=data['description'],
            requirements=data['requirements'],
            deadline=deadline,
            slots_available=slots_available
        )
        AuditEvent.objects.create(
            actor=user,
            action='placement.created',
            description=f'Created placement "{placement.title}" at {placement.company}.',
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
            data = json.loads(request.body or b'{}')
            if not isinstance(data, dict):
                return JsonResponse({"error": "Expected a JSON object."}, status=400)
            supported_fields = {
                'title', 'company', 'location', 'description', 'requirements',
                'deadline', 'slots_available', 'is_active',
            }
            unknown_fields = set(data) - supported_fields
            if unknown_fields:
                return JsonResponse({"error": f"Unsupported fields: {', '.join(sorted(unknown_fields))}."}, status=400)
            
            # Validate slots_available modification
            if 'slots_available' in data:
                try:
                    raw_slots = data['slots_available']
                    if isinstance(raw_slots, bool):
                        raise ValueError
                    if isinstance(raw_slots, int):
                        data['slots_available'] = raw_slots
                    elif isinstance(raw_slots, str) and raw_slots.isdecimal():
                        data['slots_available'] = int(raw_slots)
                    else:
                        raise ValueError
                except (TypeError, ValueError):
                    return JsonResponse({"error": "slots_available must be a positive integer."}, status=400)
                if data['slots_available'] < 1:
                    return JsonResponse({"error": "slots_available must be a positive integer."}, status=400)
                active_statuses = ['pending', 'shortlisted', 'accepted']
                active_count = Application.objects.filter(placement=placement, status__in=active_statuses).count()
                if data['slots_available'] < active_count:
                    return JsonResponse({"error": f"Cannot set slots_available below active application count ({active_count})"}, status=400)

            if 'deadline' in data:
                try:
                    new_deadline = date.fromisoformat(data['deadline'])
                    deadline_must_be_future(new_deadline)
                except (ValueError, TypeError):
                    return JsonResponse({"error": "Invalid deadline. Expected format YYYY-MM-DD."}, status=400)
                except ValidationError as e:
                    return JsonResponse({"error": e.message}, status=400)
                placement.deadline = new_deadline

            for field in ('title', 'company', 'location', 'description', 'requirements'):
                if field in data:
                    if not isinstance(data[field], str) or not data[field].strip():
                        return JsonResponse({"error": f"{field} is required."}, status=400)
                    data[field] = data[field].strip()

            placement.title = data.get('title', placement.title)
            placement.company = data.get('company', placement.company)
            placement.location = data.get('location', placement.location)
            placement.description = data.get('description', placement.description)
            placement.requirements = data.get('requirements', placement.requirements)
            placement.slots_available = data.get('slots_available', placement.slots_available)
            if 'is_active' in data:
                if not isinstance(data['is_active'], bool):
                    return JsonResponse({"error": "is_active must be true or false."}, status=400)
                placement.is_active = data['is_active']
                
            placement.save()
            AuditEvent.objects.create(
                actor=user,
                action='placement.updated',
                description=f'Updated placement "{placement.title}" at {placement.company}.',
            )
            return JsonResponse(format_placement(placement))
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON."}, status=400)

    elif request.method == "DELETE":
        if user.role not in ['officer', 'admin']:
            return JsonResponse({"error": "Only officers or admins can delete placements"}, status=403)
        
        placement.is_active = False
        placement.save()
        AuditEvent.objects.create(
            actor=user,
            action='placement.deactivated',
            description=f'Closed placement "{placement.title}" at {placement.company}.',
        )
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
        if request.content_type and request.content_type.startswith('multipart/form-data'):
            cover_note = request.POST.get('cover_note', '')
        else:
            data = json.loads(request.body or b'{}')
            if not isinstance(data, dict):
                return JsonResponse({"error": "Expected a JSON object."}, status=400)
            cover_note = data.get('cover_note', '')
        if not isinstance(cover_note, str) or not cover_note.strip():
            return JsonResponse({"error": "Cover note is required"}, status=400)

        cv_file = request.FILES.get('cv_file')
        if cv_file and (cv_file.size > 5 * 1024 * 1024 or not cv_file.name.lower().endswith(('.pdf', '.doc', '.docx'))):
            return JsonResponse({"error": "CV must be a PDF or Word document no larger than 5MB."}, status=400)
        
        application = ApplicationService.submit(
            student=user,
            placement_id=pk,
            cover_note=cover_note.strip(),
            cv_file=cv_file
        )
        AuditEvent.objects.create(
            actor=user,
            action='application.submitted',
            description=f'{user.get_full_name()} applied for "{application.placement.title}".',
        )
        return JsonResponse(format_application(application, request), status=201)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON."}, status=400)
    except ValueError as e:
        return JsonResponse({"error": str(e)}, status=400)
    except Exception:
        logger.exception("Unexpected error applying to placement %s", pk)
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
        if not isinstance(data, dict):
            return JsonResponse({"error": "Expected a JSON object."}, status=400)
        new_status = data.get('status')
        
        application = ApplicationService.update_status(
            user=user,
            application_id=pk,
            new_status=new_status
        )
        AuditEvent.objects.create(
            actor=user,
            action='application.reviewed',
            description=f'Updated application #{application.id} to {application.status}.',
        )
        return JsonResponse(format_application(application, request))
    except ValueError as e:
        return JsonResponse({"error": str(e)}, status=400)
    except PermissionError as e:
        return JsonResponse({"error": str(e)}, status=403)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON."}, status=400)
    except Exception:
        logger.exception("Unexpected error updating application %s", pk)
        return JsonResponse({"error": "Internal server error"}, status=500)
