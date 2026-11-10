from django.conf import settings
from django.db import models

from apps.academics.models import Course


class FeeStructure(models.Model):
    name = models.CharField(max_length=160)
    programme = models.ForeignKey(Course, on_delete=models.PROTECT, related_name='fee_structures')
    academic_year = models.CharField(max_length=20)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=12, choices=[('active', 'Active'), ('inactive', 'Inactive')], default='active')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['academic_year', 'name']
        constraints = [
            models.UniqueConstraint(fields=['name', 'programme', 'academic_year'], name='unique_fee_structure_programme_year'),
            models.CheckConstraint(condition=models.Q(amount__gte=0), name='fee_structure_nonnegative_amount'),
        ]

    def __str__(self):
        return f'{self.name} ({self.academic_year})'


class Invoice(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('issued', 'Issued'),
        ('partially_paid', 'Partially paid'),
        ('paid', 'Paid'),
        ('overdue', 'Overdue'),
        ('cancelled', 'Cancelled'),
    ]

    invoice_number = models.CharField(max_length=32, unique=True, blank=True)
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='finance_invoices')
    fee_structure = models.ForeignKey(FeeStructure, on_delete=models.PROTECT, related_name='invoices')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    due_date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='issued')
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [models.CheckConstraint(condition=models.Q(amount__gt=0), name='invoice_positive_amount')]

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if not self.invoice_number:
            self.invoice_number = f'INV-{self.created_at:%Y}-{self.pk:06d}'
            type(self).objects.filter(pk=self.pk).update(invoice_number=self.invoice_number)

    def __str__(self):
        return self.invoice_number or f'Invoice {self.pk}'


class Payment(models.Model):
    METHOD_CHOICES = [('mpesa', 'M-Pesa'), ('bank', 'Bank transfer'), ('card', 'Card'), ('cash', 'Cash')]
    STATUS_CHOICES = [('pending', 'Pending'), ('confirmed', 'Confirmed'), ('failed', 'Failed'), ('voided', 'Voided')]

    invoice = models.ForeignKey(Invoice, on_delete=models.PROTECT, related_name='payments')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    method = models.CharField(max_length=12, choices=METHOD_CHOICES)
    reference = models.CharField(max_length=100, unique=True)
    paid_at = models.DateField()
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-paid_at', '-created_at']
        constraints = [models.CheckConstraint(condition=models.Q(amount__gt=0), name='payment_positive_amount')]

    def __str__(self):
        return self.reference


class PaymentReversal(models.Model):
    payment = models.OneToOneField(Payment, on_delete=models.PROTECT, related_name='reversal')
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='payment_reversals')
    reason = models.CharField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)


class PaymentRequest(models.Model):
    METHOD_CHOICES = [('mpesa', 'M-Pesa'), ('bank', 'Bank transfer'), ('card', 'Card')]
    STATUS_CHOICES = [('pending', 'Pending'), ('confirmed', 'Confirmed'), ('failed', 'Failed'), ('cancelled', 'Cancelled')]

    invoice = models.ForeignKey(Invoice, on_delete=models.PROTECT, related_name='payment_requests')
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='payment_requests')
    method = models.CharField(max_length=12, choices=METHOD_CHOICES)
    phone_number = models.CharField(max_length=30, blank=True)
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
