from django.urls import path
from . import views

urlpatterns = [
    path('ai/feed/', views.ai_feed, name='ai-feed'),
    path('ai/chat/', views.ai_chat, name='ai-chat'),
    path('ai/chat/<int:pk>/', views.ai_chat_history, name='ai-chat-history'),
    path('ai/tasks/', views.ai_tasks_list, name='ai-tasks-list'),
    path('ai/task/', views.ai_task_execute, name='ai-task-execute'),
    path('ai/analytics/', views.ai_analytics, name='ai-analytics'),
]
