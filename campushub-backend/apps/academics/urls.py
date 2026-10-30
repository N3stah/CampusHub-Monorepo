from django.urls import path
from . import views

urlpatterns = [
    path('schools/', views.school_list_create, name='school-list-create'),
    path('schools/<int:pk>/', views.school_detail_update_delete, name='school-detail-update-delete'),
    path('departments/', views.department_list_create, name='department-list-create'),
    path('departments/<int:pk>/', views.department_detail_update_delete, name='department-detail-update-delete'),
    path('courses/', views.course_list_create, name='course-list-create'),
    path('courses/assign-lecturer/', views.course_bulk_assign_lecturer, name='course-bulk-assign-lecturer'),
    path('courses/<int:pk>/', views.course_detail_update_delete, name='course-detail-update-delete'),
    path('courses/<int:pk>/roster/', views.course_roster, name='course-roster'),
    path('units/', views.unit_list_create, name='unit-list-create'),
    path('units/<int:pk>/', views.unit_detail_update_delete, name='unit-detail-update-delete'),
    path('units/<int:pk>/teaching-assignments/', views.unit_teaching_assignment, name='unit-teaching-assignment'),
    path('admin/enrollments/', views.admin_enrollment_list_create, name='admin-enrollment-list-create'),
    path('admin/enrollments/<int:pk>/', views.admin_enrollment_update, name='admin-enrollment-update'),
    path('enrollments/', views.enrollment_list_create, name='enrollment-list-create'),
    path('enrollments/<int:pk>/', views.enrollment_drop, name='enrollment-drop'),
    path('offerings/<int:pk>/', views.offering_detail, name='offering-detail'),
    path('offerings/<int:pk>/roster/', views.offering_roster, name='offering-roster'),
    path('offerings/<int:pk>/sessions/', views.offering_sessions, name='offering-sessions'),
    path('sessions/<int:pk>/', views.session_delete, name='session-delete'),
    path('calendar/', views.calendar_view, name='calendar'),
]
