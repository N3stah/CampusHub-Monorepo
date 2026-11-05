from django.urls import path
from . import views

urlpatterns = [
    path('ai/feed/', views.ai_feed, name='ai-feed'),
]
