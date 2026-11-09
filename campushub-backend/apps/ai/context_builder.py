import json
from django.utils import timezone
from datetime import timedelta
from django.db.models import Count, Q
from apps.academics.models import (
    Enrollment, Offering, UnitTeachingAssignment, Assignment,
    AttendanceRecord, ClassSession
)
from apps.placements.models import Placement, Application
from apps.notifications.models import Notification
from apps.accounts.models import User


def build_feed_context(user):
    """Gather role-specific data for the AI feed.
    CRITICAL: For students, only query the requesting user's own records.
    """
    if user.role == 'student':
        return _student_context(user)
    elif user.role == 'lecturer':
        return _lecturer_context(user)
    elif user.role == 'officer':
        return _officer_context(user)
    elif user.role == 'admin':
        return _admin_context(user)
    return {'role': 'unknown'}


def _student_context(user):
    """Only the requesting student's own data — never another student's."""
    enrollment = Enrollment.objects.filter(
        student=user, status='active'
    ).select_related('course').first()

    course_code = enrollment.course.code if enrollment else None
    course_title = enrollment.course.title if enrollment else None

    attendance_records = AttendanceRecord.objects.filter(student=user)
    total = attendance_records.filter(status__in=['present', 'late', 'absent']).count()
    attended = attendance_records.filter(status__in=['present', 'late']).count()
    attendance_rate = round(attended / total, 2) if total > 0 else None

    upcoming = []
    if enrollment:
        offering_ids = Offering.objects.filter(course=enrollment.course).values_list('id', flat=True)
        now = timezone.now()
        for a in Assignment.objects.filter(offering_id__in=offering_ids, is_published=True, due_at__gt=now).order_by('due_at')[:5]:
            upcoming.append({'title': a.title, 'due_at': a.due_at.isoformat()})

    applications = Application.objects.filter(student=user)
    placement_status = {
        'total': applications.count(),
        'pending': applications.filter(status='pending').count(),
        'accepted': applications.filter(status='accepted').count(),
        'rejected': applications.filter(status='rejected').count(),
    }

    unread_count = Notification.objects.filter(recipient=user, is_read=False).count()
    gpa = str(user.gpa) if user.gpa else None

    return {
        'role': 'student',
        'course': course_code,
        'course_title': course_title,
        'attendance_rate': attendance_rate,
        'attended_sessions': attended,
        'total_sessions': total,
        'upcoming_assignments': upcoming,
        'placement_status': placement_status,
        'unread_notifications': unread_count,
        'gpa': gpa,
    }


def _lecturer_context(user):
    """Only for offerings the lecturer is assigned to."""
    offering_ids = list(UnitTeachingAssignment.objects.filter(lecturer=user).values_list('offering_id', flat=True))
    offerings = Offering.objects.filter(id__in=offering_ids).select_related('unit', 'course')
    now = timezone.now()
    offering_list = []
    total_students = 0

    for off in offerings:
        student_count = Enrollment.objects.filter(course=off.course, status='active').count()
        total_students += student_count
        upcoming = Assignment.objects.filter(offering=off, is_published=True, due_at__gt=now).count()
        offering_list.append({
            'unit_code': off.unit.code,
            'course_code': off.course.code,
            'student_count': student_count,
            'upcoming_assignments': upcoming,
        })

    unread_count = Notification.objects.filter(recipient=user, is_read=False).count()
    return {
        'role': 'lecturer',
        'offerings': offering_list,
        'total_students': total_students,
        'unread_notifications': unread_count,
    }


def _officer_context(user):
    active_placements = Placement.objects.filter(is_active=True).count()
    pending_apps = Application.objects.filter(status='pending').count()
    accepted_apps = Application.objects.filter(status='accepted').count()
    total_apps = Application.objects.count()
    acceptance_rate = round(accepted_apps / total_apps, 2) if total_apps > 0 else 0
    unread_count = Notification.objects.filter(recipient=user, is_read=False).count()
    return {
        'role': 'officer',
        'active_placements': active_placements,
        'pending_applications': pending_apps,
        'accepted_applications': accepted_apps,
        'acceptance_rate': acceptance_rate,
        'unread_notifications': unread_count,
    }


def _admin_context(user):
    users_by_role = dict(User.objects.values('role').annotate(count=Count('id')).values_list('role', 'count'))
    total_users = User.objects.count()
    total_placements = Placement.objects.filter(is_active=True).count()
    total_apps = Application.objects.count()
    accepted_apps = Application.objects.filter(status='accepted').count()
    unread_count = Notification.objects.filter(recipient=user, is_read=False).count()
    from apps.ai.models import AITaskLog
    ai_calls_today = AITaskLog.objects.filter(created_at__gte=timezone.now() - timedelta(hours=24)).count()
    return {
        'role': 'admin',
        'total_users': total_users,
        'users_by_role': users_by_role,
        'active_placements': total_placements,
        'total_applications': total_apps,
        'accepted_applications': accepted_apps,
        'ai_calls_today': ai_calls_today,
        'unread_notifications': unread_count,
    }
