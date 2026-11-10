from django.urls import path
from . import views

urlpatterns = [
    path('register/', views.register_view, name='register'),
    path('token/', views.token_view, name='token'),
    path('token/refresh/', views.token_refresh_view, name='token_refresh'),
    path('me/', views.me_view, name='me'),
    path('me/profile-picture/', views.upload_profile_picture, name='upload-profile-picture'),
    path('password/reset/', views.password_reset_request_view, name='password_reset_request'),
    path('password/reset/confirm/', views.password_reset_confirm_view, name='password_reset_confirm'),
]