from django.urls import path
from . import views

urlpatterns = [
    path('placements/', views.placement_list_create, name='placement-list-create'),
    path('placements/<int:pk>/', views.placement_detail_update_delete, name='placement-detail-update-delete'),
    path('placements/<int:pk>/apply/', views.apply_to_placement, name='apply-to-placement'),
    path('applications/', views.application_list, name='application-list'),
    path('applications/<int:pk>/status/', views.update_application_status, name='update-application-status'),
]
