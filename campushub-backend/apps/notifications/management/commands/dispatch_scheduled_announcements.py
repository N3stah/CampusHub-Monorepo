from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.resources.models import Announcement
from apps.notifications.services import NotificationService
from apps.academics.models import Enrollment


class Command(BaseCommand):
    help = 'Dispatch announcements whose scheduled_for time has arrived.'

    def handle(self, *args, **options):
        now = timezone.now()
        pending = Announcement.objects.filter(
            scheduled_for__isnull=False,
            scheduled_for__lte=now,
            dispatched_at__isnull=True,
        ).select_related('course', 'author', 'group')

        count = 0
        for ann in pending:
            if ann.group_id:
                recipients = list(ann.group.members.values_list('id', flat=True))
            else:
                recipients = list(Enrollment.objects.filter(
                    course=ann.course, status='active'
                ).values_list('student_id', flat=True))

            if recipients:
                NotificationService.notify_bulk(
                    recipients=recipients,
                    verb='announcement.published',
                    message=f'Announcement: {ann.title}',
                    actor=ann.author,
                    link=f'/courses/{ann.course_id}/',
                )

            ann.dispatched_at = now
            ann.save(update_fields=['dispatched_at'])
            count += 1

        self.stdout.write(self.style.SUCCESS(f'Dispatched {count} scheduled announcement(s).'))
