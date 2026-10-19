from django.contrib import admin
from .models import Notification

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ['recipient', 'actor', 'verb', 'is_read', 'created_at']
    list_filter = ['is_read', 'verb', 'created_at']
    search_fields = ['recipient__email', 'actor__email', 'message']
    readonly_fields = ['recipient', 'actor', 'verb', 'message', 'link', 'created_at']
    
    def has_add_permission(self, request):
        return False
