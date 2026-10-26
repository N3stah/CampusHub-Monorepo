from django.urls import path
from . import views

urlpatterns = [
    path('departments/', views.department_list_create, name='department-list-create'),
    path('departments/<int:pk>/', views.department_detail_update_delete, name='department-detail-update-delete'),
    path('courses/', views.course_list_create, name='course-list-create'),
    path('courses/assign-lecturer/', views.course_bulk_assign_lecturer, name='course-bulk-assign-lecturer'),
    path('courses/<int:pk>/', views.course_detail_update_delete, name='course-detail-update-delete'),
    path('courses/<int:pk>/roster/', views.course_roster, name='course-roster'),
    path('enrollments/', views.enrollment_list_create, name='enrollment-list-create'),
    path('enrollments/<int:pk>/', views.enrollment_drop, name='enrollment-drop'),
]
