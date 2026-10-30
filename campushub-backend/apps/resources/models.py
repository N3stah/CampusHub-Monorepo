from django.db import models
from django.conf import settings

class Resource(models.Model):
    course = models.ForeignKey(
        'academics.Course',
        on_delete=models.CASCADE,
        related_name='resources'
    )
    offering = models.ForeignKey(
        'academics.Offering',
        on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='resources'
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='uploaded_resources'
    )
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    file = models.FileField(upload_to='resources/%Y/%m/')
    file_type = models.CharField(max_length=10)
    file_size = models.PositiveIntegerField()
    download_count = models.PositiveIntegerField(default=0)
    category = models.CharField(max_length=20, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['course', '-created_at']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} ({self.course.code})"

class Announcement(models.Model):
    course = models.ForeignKey(
        'academics.Course',
        on_delete=models.CASCADE,
        related_name='announcements'
    )
    offering = models.ForeignKey(
        'academics.Offering',
        on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='announcements'
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='authored_announcements'
    )
    title = models.CharField(max_length=200)
    body = models.TextField()
    is_pinned = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['course', '-created_at']),
        ]
        ordering = ['-is_pinned', '-created_at']

    def __str__(self):
        return f"{self.title} ({self.course.code})"
