from django.urls import path
from . import views

urlpatterns = [
    path('register/', views.register_view, name='register'),
    path('token/', views.token_view, name='token'),
    path('token/refresh/', views.token_refresh_view, name='token_refresh'),
    path('me/', views.me_view, name='me'),
    path('me/profile-picture/', views.upload_profile_picture, name='upload-profile-picture'),
    path('password/change/', views.password_change_view, name='password-change'),
    path('password/otp/request/', views.password_otp_request, name='password-otp-request'),
    path('password/otp/confirm/', views.password_otp_confirm, name='password-otp-confirm'),
]