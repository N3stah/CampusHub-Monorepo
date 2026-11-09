from django.conf import settings
from django.db import models


class AIConversation(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='ai_conversations'
    )
    role_context = models.CharField(max_length=20)
    title = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'ai_conversation'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user} - {self.title or 'Untitled'}"


class AIMessage(models.Model):
    ROLE_CHOICES = [
        ('user', 'user'),
        ('assistant', 'assistant'),
    ]

    conversation = models.ForeignKey(
        AIConversation,
        on_delete=models.CASCADE,
        related_name='messages'
    )
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    content = models.TextField()
    ai_provider = models.CharField(max_length=20, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'ai_message'
        ordering = ['created_at']

    def __str__(self):
        return f"{self.conversation} - {self.role}"


class AIInsight(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='ai_insights'
    )
    insight_type = models.CharField(max_length=50)
    content = models.JSONField()
    generated_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'ai_insight'
        ordering = ['-generated_at']

    def __str__(self):
        return f"{self.user} - {self.insight_type}"


class AITaskLog(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True
    )
    task_type = models.CharField(max_length=50)
    input_summary = models.TextField()
    output_summary = models.TextField()
    provider = models.CharField(max_length=20)
    success = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'ai_task_log'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.task_type} - {self.provider} - {'OK' if self.success else 'FAIL'}"
