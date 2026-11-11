from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
import uuid
from datetime import timedelta
from django.utils import timezone

def default_password_reset_expiration():
    return timezone.now() + timedelta(hours=24)



class UserManager(BaseUserManager):
    def create_user(self, email, username, first_name, last_name, password=None, **extra_fields):
        if not email:
            raise ValueError('Email is required')
        email = self.normalize_email(email)
        user = self.model(
            email=email,
            username=username,
            first_name=first_name,
            last_name=last_name,
            **extra_fields,
        )
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, username, first_name, last_name, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', 'admin')
        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')
        return self.create_user(email, username, first_name, last_name, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    INVITATION_EMAIL_STATUS_CHOICES = [
        ('not_sent', 'Not sent'),
        ('sent', 'Sent'),
        ('failed', 'Failed'),
    ]
    ROLE_CHOICES = [
        ('student', 'Student'),
        ('lecturer', 'Lecturer'),
        ('officer', 'Placement Officer'),
        ('admin', 'Admin'),
        ('ict_admin', 'ICT Administrator'),
        ('registrar', 'Registrar / Academic Officer'),
        ('finance', 'Finance Officer'),
        ('hod', 'Dean / Head of Department'),
        ('examination', 'Examinations Officer'),
        ('librarian', 'Librarian'),
        ('hostel', 'Hostel Warden'),
    ]

    email        = models.EmailField(unique=True)
    username     = models.CharField(max_length=50, unique=True)
    first_name   = models.CharField(max_length=100)
    last_name    = models.CharField(max_length=100)
    role         = models.CharField(max_length=20, choices=ROLE_CHOICES, default='student')
    admission_number = models.CharField(max_length=30, blank=True, null=True, unique=True)
    department   = models.ForeignKey(
        'academics.Department',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='members',
    )
    gpa          = models.DecimalField(max_digits=3, decimal_places=2, null=True, blank=True)
    phone_number = models.CharField(max_length=20, blank=True)
    title        = models.CharField(max_length=100, blank=True)
    bio          = models.TextField(blank=True)
    office_hours = models.CharField(max_length=200, blank=True)
    is_active    = models.BooleanField(default=True)
    must_change_password = models.BooleanField(default=False)
    initial_password_expires_at = models.DateTimeField(null=True, blank=True)
    invitation_email_status = models.CharField(
        max_length=16,
        choices=INVITATION_EMAIL_STATUS_CHOICES,
        default='not_sent',
    )
    is_staff     = models.BooleanField(default=False)
    date_joined  = models.DateTimeField(auto_now_add=True)
    profile_picture = models.ImageField(upload_to='profile_pictures/', null=True, blank=True)

    objects = UserManager()

    USERNAME_FIELD  = 'email'
    REQUIRED_FIELDS = ['username', 'first_name', 'last_name']

    class Meta:
        db_table = 'accounts_user'
        ordering = ['-date_joined']
        constraints = [
            models.CheckConstraint(
                condition=models.Q(gpa__gte=0) & (models.Q(gpa__lte=4) | models.Q(gpa__isnull=True)),
                name='user_gpa_range'
            ),
            models.CheckConstraint(
                condition=models.Q(role__in=['student', 'lecturer', 'officer', 'admin', 'ict_admin', 'registrar', 'finance', 'hod', 'examination', 'librarian', 'hostel']),
                name='user_valid_role'
            ),
        ]

    def __str__(self):
        return f'{self.first_name} {self.last_name} ({self.email})'

    def get_full_name(self):
        return f'{self.first_name} {self.last_name}'


class AuditEvent(models.Model):
    actor = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_events',
    )
    action = models.CharField(max_length=80)
    description = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.action}: {self.description[:80]}'

class PasswordResetToken(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='password_reset_tokens')
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    used_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(default=default_password_reset_expiration)

    class Meta:
        ordering = ['-created_at']

    def is_valid(self):
        return self.used_at is None and timezone.now() < self.expires_at

from django.utils import timezone

class PasswordResetOTP(models.Model):
    code_hash = models.CharField(max_length=128)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    consumed_at = models.DateTimeField(blank=True, null=True)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='password_reset_otps',
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at'], name='accounts_pa_user_id_92b775_idx'),
        ]

    def is_valid(self):
        return self.consumed_at is None and timezone.now() < self.expires_at

    def __str__(self):
        return f'OTP for {self.user.email} ({self.created_at})'
