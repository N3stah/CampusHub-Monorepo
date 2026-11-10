from django.urls import path

from . import views

urlpatterns = [
    path('fee-structures/', views.fee_structure_list_create, name='fee-structure-list-create'),
    path('fee-structures/<int:pk>/', views.fee_structure_detail, name='fee-structure-detail'),
    path('invoices/', views.invoice_list_create, name='invoice-list-create'),
    path('invoices/<int:pk>/', views.invoice_detail, name='invoice-detail'),
    path('payments/', views.payment_list_create, name='payment-list-create'),
    path('payments/<int:pk>/', views.payment_detail, name='payment-detail'),
    path('payments/<int:pk>/void/', views.payment_void, name='payment-void'),
    path('payment-requests/', views.payment_request_list_create, name='payment-request-list-create'),
]
