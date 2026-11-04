from django.db import models
from django.conf import settings


class Conversation(models.Model):
    DIRECT = 'direct'
    GROUP = 'group'
    KIND_CHOICES = [(DIRECT, 'direct'), (GROUP, 'group')]

    kind = models.CharField(max_length=10, choices=KIND_CHOICES)
    offering = models.ForeignKey(
        'academics.Offering',
        on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='conversations',
    )
    created_at = models.DateTimeField(auto_now_add=True)


class ConversationParticipant(models.Model):
    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, related_name='participants',
    )
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    is_admin = models.BooleanField(default=False)
    joined_at = models.DateTimeField(auto_now_add=True)
    last_read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['conversation', 'user'],
                name='one_membership_per_conversation',
            ),
        ]


class Message(models.Model):
    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, related_name='messages',
    )
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
