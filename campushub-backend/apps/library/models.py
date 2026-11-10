from django.conf import settings
from django.db import models


class Book(models.Model):
    isbn = models.CharField(max_length=20, blank=True, unique=True, null=True)
    title = models.CharField(max_length=240)
    author = models.CharField(max_length=200)
    category = models.CharField(max_length=80, blank=True)
    total_copies = models.PositiveIntegerField(default=1)
    location = models.CharField(max_length=120, blank=True)
    status = models.CharField(max_length=12, choices=[('available', 'Available'), ('inactive', 'Inactive')], default='available')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['title', 'author']
        constraints = [models.CheckConstraint(condition=models.Q(total_copies__gte=1), name='book_has_copy')]


class Loan(models.Model):
    STATUS_CHOICES = [('active', 'Active'), ('returned', 'Returned'), ('overdue', 'Overdue'), ('lost', 'Lost'), ('cancelled', 'Cancelled')]

    book = models.ForeignKey(Book, on_delete=models.PROTECT, related_name='loans')
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='library_loans')
    borrowed_on = models.DateField()
    due_date = models.DateField()
    returned_on = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default='active')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-borrowed_on', '-created_at']


class Reservation(models.Model):
    STATUS_CHOICES = [('queued', 'Queued'), ('ready', 'Ready for pickup'), ('fulfilled', 'Fulfilled'), ('cancelled', 'Cancelled'), ('expired', 'Expired')]

    book = models.ForeignKey(Book, on_delete=models.PROTECT, related_name='reservations')
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='book_reservations')
    reserved_on = models.DateField()
    expires_on = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default='queued')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
