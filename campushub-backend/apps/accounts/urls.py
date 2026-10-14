from django.urls import path
from .views import api_login_view, api_logout_view, api_register_view

urlpatterns = [
    path('register/', api_register_view, name='api_register'),
    path('login/', api_login_view, name='api_login'),
    path('logout/', api_logout_view, name='api_logout'),
]
