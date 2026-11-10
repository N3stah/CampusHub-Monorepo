from django.urls import path

from . import views

urlpatterns = [
    path('applications/', views.application_list_create, name='admission-application-list-create'),
    path('applications/<int:pk>/', views.application_detail, name='admission-application-detail'),
]
