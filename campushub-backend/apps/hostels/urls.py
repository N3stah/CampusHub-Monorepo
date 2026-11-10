from django.urls import path

from . import views

urlpatterns = [
    path('', views.hostel_list_create, name='hostel-list-create'),
    path('<int:pk>/', views.hostel_detail, name='hostel-detail'),
    path('rooms/', views.room_list_create, name='room-list-create'),
    path('rooms/<int:pk>/', views.room_detail, name='room-detail'),
    path('allocations/', views.allocation_list_create, name='allocation-list-create'),
    path('allocations/<int:pk>/', views.allocation_detail, name='allocation-detail'),
]
