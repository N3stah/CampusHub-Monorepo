from django.urls import path
from . import views

urlpatterns = [
    path('notifications/', views.notification_list, name='notification-list'),
    path('notifications/read-all/', views.mark_all_notifications_read, name='mark-all-notifications-read'),
    path('notifications/unread-count/', views.unread_notification_count, name='unread-notification-count'),
    path('notifications/<int:pk>/read/', views.mark_notification_read, name='mark-notification-read'),
]
