from django.urls import path
from . import views

urlpatterns = [
    path('register/', views.register_view, name='register'),
    path('token/', views.token_view, name='token'),
    path('token/refresh/', views.token_refresh_view, name='token_refresh'),
    path('me/', views.me_view, name='me'),
]