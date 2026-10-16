from datetime import timedelta
from django.utils import timezone
from django.db import transaction
from .models import Notification

class NotificationService:
    """
    Service layer for creating notifications.
    Keeps views thin and centralizes notification logic.
    """

    @staticmethod
    @transaction.atomic
    def notify(recipient, verb, message, actor=None, link=None, dedupe_window_minutes=5):
        """
        Creates a single notification for a recipient.
        Includes a dedupe safeguard: if a notification with the same verb and link
        was created for this recipient in the last `dedupe_window_minutes`,
        it updates the message and bumps the timestamp instead of creating a new row.
        """
        now = timezone.now()
        dedupe_threshold = now - timedelta(minutes=dedupe_window_minutes)

        # Check for existing recent notification to dedupe
        existing = Notification.objects.filter(
            recipient=recipient,
            verb=verb,
            link=link,
            created_at__gte=dedupe_threshold
        ).first()

        if existing:
            # Update the existing notification and bump it to the top
            existing.message = message
            existing.actor = actor
            existing.is_read = False
            existing.created_at = now
            existing.save(update_fields=['message', 'actor', 'is_read', 'created_at'])
            return existing
        else:
            # Create a new notification
            return Notification.objects.create(
                recipient=recipient,
                actor=actor,
                verb=verb,
                message=message,
                link=link
            )

    @staticmethod
    @transaction.atomic
    def notify_bulk(recipients, verb, message, actor=None, link=None):
        """
        Creates notifications for a list of recipient IDs or User objects simultaneously.
        Uses bulk_create for efficiency (1 query instead of N).
        Skips dedupe logic, as bulk events are inherently distinct.
        """
        # If a queryset/list of User objects is passed, extract IDs
        if recipients and hasattr(recipients[0], 'id'):
            recipient_ids = [r.id for r in recipients]
        else:
            recipient_ids = list(recipients) # Assume it's already a list of IDs

        notifications_to_create = [
            Notification(
                recipient_id=rid,
                actor=actor,
                verb=verb,
                message=message,
                link=link
            ) for rid in recipient_ids
        ]
        
        return Notification.objects.bulk_create(notifications_to_create)
