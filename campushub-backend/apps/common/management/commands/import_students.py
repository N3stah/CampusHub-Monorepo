import csv
from django.core.management.base import BaseCommand
from django.db import transaction
from django.contrib.auth import get_user_model

User = get_user_model()

class Command(BaseCommand):
    help = 'Imports students from a CSV file with row-level validation.'

    def add_arguments(self, parser):
        parser.add_argument('file_path', type=str, help='Path to the CSV file.')

    def handle(self, *args, **options):
        file_path = options['file_path']
        created = 0
        skipped = 0
        failed = 0

        try:
            with open(file_path, newline='') as csvfile:
                reader = csv.DictReader(csvfile)
                for row in reader:
                    try:
                        with transaction.atomic():
                            email = row.get('email', '').strip().lower()
                            username = row.get('username', '').strip()
                            password = row.get('password', '')
                            first_name = row.get('first_name', '')
                            last_name = row.get('last_name', '')
                            gpa = row.get('gpa') or None

                            if not email or not username or not password:
                                raise ValueError("Missing required fields (email, username, password)")

                            if User.objects.filter(email=email).exists() or User.objects.filter(username=username).exists():
                                self.stdout.write(self.style.WARNING(f'Skipped (exists): {email}'))
                                skipped += 1
                                continue

                            User.objects.create_user(
                                email=email, username=username, password=password,
                                first_name=first_name, last_name=last_name,
                                role='student', gpa=gpa
                            )
                            self.stdout.write(self.style.SUCCESS(f'Created: {email}'))
                            created += 1
                    except Exception as e:
                        self.stdout.write(self.style.ERROR(f'Failed row {reader.line_num}: {e}'))
                        failed += 1
        except FileNotFoundError:
            self.stdout.write(self.style.ERROR(f'File not found: {file_path}'))
            return

        self.stdout.write(self.style.SUCCESS(f'\nImport complete: {created} created, {skipped} skipped, {failed} failed.'))
