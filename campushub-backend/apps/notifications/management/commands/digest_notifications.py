from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from collections import defaultdict
from apps.notifications.models import Notification


class Command(BaseCommand):
    help = 'Creates digest notifications for users with unread notifications older than N hours (default 24).'

    def add_arguments(self, parser):
        parser.add_argument('--hours', type=int, default=24, help='Age in hours of unread notifications to digest.')

    def handle(self, *args, **options):
        hours = options['hours']
        now = timezone.now()
        cutoff = now - timedelta(hours=hours)

        pending = Notification.objects.filter(
            is_read=False,
            digested_at__isnull=True,
            created_at__lt=cutoff,
        ).exclude(verb='digest')

        # Evaluate once into a list (avoids distinct() + Meta ordering quirk in SQLite)
        pending_list = list(pending.values('id', 'recipient_id', 'verb'))

        # Group by recipient in Python
        by_recipient = defaultdict(list)
        for n in pending_list:
            by_recipient[n['recipient_id']].append(n)

        digest_count = 0
        notif_count = 0

        for rid, notifs in by_recipient.items():
            verb_counts = defaultdict(int)
            for n in notifs:
                verb_counts[n['verb']] += 1

            parts = []
            for verb, count in sorted(verb_counts.items(), key=lambda x: -x[1]):
                plural = 's' if count != 1 else ''
                parts.append(f"{count} new {verb}{plural}")
            summary = ', '.join(parts)

            Notification.objects.create(
                recipient_id=rid, verb='digest', message=summary
            )
            Notification.objects.filter(
                id__in=[n['id'] for n in notifs]
            ).update(digested_at=now)

            digest_count += 1
            notif_count += len(notifs)

        self.stdout.write(self.style.SUCCESS(
            f'Created {digest_count} digest notification(s) covering {notif_count} unread notification(s).'
        ))
