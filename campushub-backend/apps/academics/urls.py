from django.urls import path
from . import views

urlpatterns = [
    path('departments/', views.department_list, name='department-list'),
    path('courses/', views.course_list, name='course-list'),
    path('courses/<int:pk>/', views.course_detail, name='course-detail'),
    path('enrollments/', views.enrollment_list_create, name='enrollment-list-create'),
    path('enrollments/<int:pk>/', views.enrollment_drop, name='enrollment-drop'),
]
