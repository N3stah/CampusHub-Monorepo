from django.urls import path
from . import views

urlpatterns = [
    path('messaging/conversations/', views.conversation_list, name='conversation-list'),
    path('messaging/conversations/direct/', views.create_direct_conversation, name='create-direct-conversation'),
    path('messaging/recipients/', views.broadcast_recipients, name='broadcast-recipients'),
    path('messaging/broadcast/', views.send_broadcast, name='send-broadcast'),
    path('messaging/conversations/<int:pk>/messages/', views.messages, name='messages'),
    path('messaging/conversations/<int:pk>/read/', views.mark_read, name='mark-read'),
    path('messaging/messages/<int:pk>/', views.delete_message, name='delete-message'),
    path('messaging/offerings/<int:pk>/group-conversation/', views.group_conversation, name='group-conversation'),
]
