from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from apps.notifications.models import Notification

class Command(BaseCommand):
    help = 'Deletes read notifications older than N days (default 30).'

    def add_arguments(self, parser):
        parser.add_argument('--days', type=int, default=30, help='Age in days of read notifications to delete.')

    def handle(self, *args, **options):
        days = options['days']
        cutoff = timezone.now() - timedelta(days=days)
        
        count, _ = Notification.objects.filter(is_read=True, created_at__lt=cutoff).delete()
        
        self.stdout.write(self.style.SUCCESS(f'Deleted {count} read notifications older than {days} days.'))
