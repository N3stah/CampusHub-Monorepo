from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils import timezone
from datetime import date

from apps.notifications.services import NotificationService
from .models import Placement, Application

class ApplicationService:
    """
    Service layer for handling application submissions and status updates.
    Ensures atomic operations to prevent race conditions (e.g., overbooking).
    """

    @staticmethod
    @transaction.atomic
    def submit(student, placement_id: int, cover_note: str, cv_file=None) -> Application:
        # 1. Fetch placement and lock the row to prevent race conditions
        try:
            placement = Placement.objects.select_for_update().get(id=placement_id, is_active=True)
        except Placement.DoesNotExist:
            raise ValueError("Active placement not found.")

        # 2. Check if deadline has passed
        if placement.deadline < date.today():
            raise ValueError("This placement's application deadline has passed.")

        # 3. Check for duplicate application
        if Application.objects.filter(student=student, placement=placement).exists():
            raise ValueError("You have already applied for this placement.")

        # 4. Check available slots (Count pending, shortlisted, accepted)
        active_statuses = ['pending', 'shortlisted', 'accepted']
        active_applications_count = Application.objects.filter(
            placement=placement, 
            status__in=active_statuses
        ).count()
        
        if active_applications_count >= placement.slots_available:
            raise ValueError("All available slots for this placement have been filled.")

        # 5. Create the application
        application = Application.objects.create(
            student=student,
            placement=placement,
            cover_note=cover_note,
            cv_file=cv_file,
            status='pending'
        )
        return application

    @staticmethod
    @transaction.atomic
    def update_status(user, application_id: int, new_status: str) -> Application:
        valid_statuses = ['pending', 'shortlisted', 'accepted', 'rejected']
        if new_status not in valid_statuses:
            raise ValueError(f"Invalid status. Must be one of: {valid_statuses}")

        try:
            application = Application.objects.select_for_update().get(id=application_id)
        except Application.DoesNotExist:
            raise ValueError("Application not found.")

        # Permission check: Admin can update any, Officer can only update their posted placements
        if user.role != 'admin' and application.placement.posted_by_id != user.id:
            raise PermissionError("You do not have permission to update this application.")

        application.status = new_status
        application.reviewed_by = user
        application.reviewed_at = timezone.now()
        application.save(update_fields=['status', 'reviewed_by', 'reviewed_at'])
        
        # --- Notification Hook ---
        NotificationService.notify(
            recipient=application.student,
            actor=user,
            verb='application_status_changed',
            message=f"Your application for {application.placement.title} is now {new_status}",
            link=f"/placements/{application.placement.id}/applications/{application.id}/"
        )
        
        return application
