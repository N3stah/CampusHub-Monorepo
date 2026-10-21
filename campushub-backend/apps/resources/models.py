from django.db import models
from django.conf import settings

class Resource(models.Model):
    course = models.ForeignKey(
        'academics.Course',
        on_delete=models.CASCADE,
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
    download_count = models.PositiveIntegerField(default=0)  # Added in A1
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} ({self.course.code})"

class Announcement(models.Model):
    course = models.ForeignKey(
        'academics.Course',
        on_delete=models.CASCADE,
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
    is_pinned = models.BooleanField(default=False)  # Added in A2
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_pinned', '-created_at']  # Pinned first, per ERD

    def __str__(self):
        return f"{self.title} ({self.course.code})"
