from getpass import getpass

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.core.validators import validate_email
from django.db import IntegrityError, transaction

User = get_user_model()


class Command(BaseCommand):
    help = 'Create the initial CampusHub admin or promote an existing account to admin.'

    def handle(self, *args, **options):
        email = input('Admin email: ').strip().lower()
        try:
            validate_email(email)
        except ValidationError as error:
            raise CommandError('Enter a valid email address.') from error

        existing = User.objects.filter(email__iexact=email).first()
        if existing and existing.role == 'admin' and existing.is_superuser and existing.is_staff:
            self.stdout.write(self.style.SUCCESS(f'{email} is already a CampusHub admin.'))
            return

        if existing:
            self.stdout.write(
                self.style.WARNING(
                    f'An account already exists for {email}. Promotion grants CampusHub admin '
                    'access and Django superuser permissions.'
                )
            )
            confirmation = input('Promote this account? Type "yes" to continue: ').strip().lower()
            if confirmation != 'yes':
                raise CommandError('Admin creation cancelled.')
            username = existing.username
            first_name = existing.first_name
            last_name = existing.last_name
        else:
            username = input('Username: ').strip()
            first_name = input('First name: ').strip()
            last_name = input('Last name: ').strip()
            if not all((username, first_name, last_name)):
                raise CommandError('Username, first name, and last name are required.')
            if User.objects.filter(username__iexact=username).exists():
                raise CommandError('That username is already in use.')

        password = getpass('Password: ')
        password_confirmation = getpass('Confirm password: ')
        if password != password_confirmation:
            raise CommandError('Passwords do not match.')

        candidate = existing or User(
            email=email,
            username=username,
            first_name=first_name,
            last_name=last_name,
            role='admin',
        )
        try:
            validate_password(password, candidate)
        except ValidationError as error:
            raise CommandError(' '.join(error.messages)) from error

        try:
            with transaction.atomic():
                if existing:
                    existing.role = 'admin'
                    existing.is_active = True
                    existing.is_staff = True
                    existing.is_superuser = True
                    existing.set_password(password)
                    existing.save()
                else:
                    User.objects.create_superuser(
                        email=email,
                        username=username,
                        first_name=first_name,
                        last_name=last_name,
                        password=password,
                        role='admin',
                    )
        except IntegrityError as error:
            raise CommandError('The email or username is already in use.') from error

        self.stdout.write(self.style.SUCCESS(f'CampusHub admin account ready for {email}.'))
