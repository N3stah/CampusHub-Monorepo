from django.urls import path
from . import views

urlpatterns = [
    path('courses/<int:course_id>/resources/', views.resource_list_create, name='resource-list-create'),
    path('courses/<int:course_id>/resources/<int:pk>/download/', views.download_resource, name='download-resource'),
    path('courses/<int:course_id>/resources/<int:pk>/', views.resource_detail_update_delete, name='resource-detail-update-delete'),
    path('courses/<int:course_id>/announcements/', views.announcement_list_create, name='announcement-list-create'),
    path('courses/<int:course_id>/announcements/<int:pk>/', views.announcement_detail_update_delete, name='announcement-detail-update-delete'),
    path('offerings/<int:offering_id>/resources/', views.offering_resource_list_create, name='offering-resource-list-create'),
    path('offerings/<int:offering_id>/resources/<int:pk>/', views.offering_resource_delete, name='offering-resource-delete'),
    path('offerings/<int:offering_id>/announcements/', views.offering_announcement_list_create, name='offering-announcement-list-create'),
    path('offerings/<int:offering_id>/announcements/<int:pk>/', views.offering_announcement_delete, name='offering-announcement-delete'),
]
