from django.db import models

from apps.academics.models import Course


class Application(models.Model):
    STATUS_CHOICES = [
        ('submitted', 'Submitted'),
        ('under_review', 'Under review'),
        ('offered', 'Offered'),
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected'),
        ('withdrawn', 'Withdrawn'),
    ]

    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    email = models.EmailField()
    phone_number = models.CharField(max_length=30, blank=True)
    programme = models.ForeignKey(Course, on_delete=models.PROTECT, related_name='admission_applications')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='submitted')
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['email', 'programme'])]
        constraints = [
            models.UniqueConstraint(fields=['email', 'programme'], name='unique_admission_email_programme'),
        ]

    def __str__(self):
        return f'{self.first_name} {self.last_name} - {self.programme.code}'
