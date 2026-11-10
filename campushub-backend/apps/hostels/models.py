from django.conf import settings
from django.db import models


class Hostel(models.Model):
    GENDER_POLICIES = [('male', 'Male'), ('female', 'Female'), ('mixed', 'Mixed')]

    name = models.CharField(max_length=160, unique=True)
    location = models.CharField(max_length=200)
    gender_policy = models.CharField(max_length=12, choices=GENDER_POLICIES)
    capacity = models.PositiveIntegerField()
    status = models.CharField(max_length=12, choices=[('active', 'Active'), ('inactive', 'Inactive')], default='active')
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        constraints = [models.CheckConstraint(condition=models.Q(capacity__gt=0), name='hostel_positive_capacity')]


class Room(models.Model):
    STATUS_CHOICES = [('available', 'Available'), ('full', 'Full'), ('maintenance', 'Under maintenance')]

    hostel = models.ForeignKey(Hostel, on_delete=models.PROTECT, related_name='rooms')
    room_number = models.CharField(max_length=30)
    capacity = models.PositiveIntegerField()
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default='available')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['hostel__name', 'room_number']
        constraints = [
            models.UniqueConstraint(fields=['hostel', 'room_number'], name='unique_hostel_room_number'),
            models.CheckConstraint(condition=models.Q(capacity__gt=0), name='room_positive_capacity'),
        ]


class Allocation(models.Model):
    STATUS_CHOICES = [
        ('requested', 'Requested'),
        ('allocated', 'Allocated'),
        ('checked_in', 'Checked in'),
        ('checked_out', 'Checked out'),
        ('cancelled', 'Cancelled'),
    ]

    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='hostel_allocations')
    room = models.ForeignKey(Room, on_delete=models.PROTECT, related_name='allocations')
    academic_year = models.CharField(max_length=20)
    starts_on = models.DateField()
    ends_on = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default='requested')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
