from django.urls import path

from . import admin_views, user_views

urlpatterns = [
    path('users/', user_views.user_list_create, name='user-list-create'),
    path('users/<int:pk>/', user_views.user_detail_update_deactivate, name='user-detail-update-deactivate'),
    path('lecturers/', user_views.lecturer_list_create, name='lecturer-list-create'),
    path('lecturers/<int:pk>/', user_views.lecturer_detail_update, name='lecturer-detail-update'),
    path('admin/stats/', admin_views.admin_stats, name='admin-stats'),
    path('admin/logs/', admin_views.admin_logs, name='admin-logs'),
]
