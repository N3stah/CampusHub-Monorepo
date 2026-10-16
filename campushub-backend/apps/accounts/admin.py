from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import AuditEvent, User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ['email', 'username', 'first_name', 'last_name', 'role', 'is_staff']
    list_filter = ['role', 'is_staff', 'is_active']
    search_fields = ['email', 'username', 'first_name', 'last_name']
    ordering = ['-date_joined']
    fieldsets = BaseUserAdmin.fieldsets + (
        ('CampusHub', {'fields': ('role', 'department', 'gpa', 'phone_number', 'title', 'bio', 'office_hours')}),
    )


@admin.register(AuditEvent)
class AuditEventAdmin(admin.ModelAdmin):
    list_display = ['action', 'actor', 'created_at']
    list_filter = ['action', 'created_at']
    search_fields = ['description', 'actor__email']
    readonly_fields = ['actor', 'action', 'description', 'created_at']

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
