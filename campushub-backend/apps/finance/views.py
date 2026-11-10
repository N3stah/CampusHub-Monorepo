from datetime import date
from decimal import Decimal

from django.db import IntegrityError, transaction
from django.db.models import Sum
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from apps.accounts.jwt_utils import jwt_required
from apps.accounts.models import AuditEvent
from apps.accounts.models import User
from apps.academics.models import Enrollment
from apps.common.service_api import (
    collection_response,
    date_value,
    decimal_value,
    integer_value,
    json_payload,
    require_role,
)

from .models import FeeStructure, Invoice, Payment, PaymentRequest, PaymentReversal

FINANCE_ROLES = ('finance', 'admin')


def _serialize_fee(fee):
    return {
        'id': fee.id,
        'name': fee.name,
        'programme_id': fee.programme_id,
        'programme_name': f'{fee.programme.code} {fee.programme.title}',
        'academic_year': fee.academic_year,
        'amount': str(fee.amount),
        'due_date': fee.due_date.isoformat() if fee.due_date else None,
        'status': fee.status,
        'created_at': fee.created_at.isoformat(),
    }


def _serialize_invoice(invoice):
    return {
        'id': invoice.id,
        'invoice_number': invoice.invoice_number,
        'student_id': invoice.student_id,
        'student_name': invoice.student.get_full_name(),
        'fee_structure_id': invoice.fee_structure_id,
        'fee_structure_name': invoice.fee_structure.name,
        'programme_name': f'{invoice.fee_structure.programme.code} {invoice.fee_structure.programme.title}',
        'academic_period_name': invoice.fee_structure.academic_year,
        'amount': str(invoice.amount),
        'balance': str(max(Decimal('0.00'), invoice.amount - _confirmed_total(invoice))),
        'due_date': invoice.due_date.isoformat(),
        'status': _invoice_status(invoice),
        'description': invoice.description,
        'created_at': invoice.created_at.isoformat(),
        'updated_at': invoice.updated_at.isoformat(),
    }


def _confirmed_total(invoice):
    return invoice.payments.filter(status='confirmed').aggregate(total=Sum('amount'))['total'] or Decimal('0.00')


def _invoice_status(invoice):
    total = _confirmed_total(invoice)
    if invoice.status == 'cancelled':
        return 'cancelled'
    if total >= invoice.amount:
        return 'paid'
    if total > 0:
        return 'partially_paid'
    if invoice.due_date < date.today() and invoice.status != 'draft':
        return 'overdue'
    return invoice.status


def _refresh_invoice_status(invoice):
    if invoice.status == 'cancelled':
        return
    total = _confirmed_total(invoice)
    if total >= invoice.amount:
        invoice.status = 'paid'
    elif total > 0:
        invoice.status = 'partially_paid'
    elif invoice.status in {'paid', 'partially_paid', 'overdue'}:
        invoice.status = 'overdue' if invoice.due_date < date.today() else 'issued'
    invoice.save(update_fields=['status', 'updated_at'])


def _serialize_payment(payment):
    return {
        'id': payment.id,
        'invoice_id': payment.invoice_id,
        'invoice_reference': payment.invoice.invoice_number,
        'student_id': payment.invoice.student_id,
        'student_name': payment.invoice.student.get_full_name(),
        'amount': str(payment.amount),
        'method': payment.method,
        'reference': payment.reference,
        'paid_at': payment.paid_at.isoformat(),
        'status': payment.status,
        'created_at': payment.created_at.isoformat(),
        'void_reason': payment.reversal.reason if hasattr(payment, 'reversal') else None,
    }


def _serialize_request(payment_request):
    return {
        'id': payment_request.id,
        'invoice_id': payment_request.invoice_id,
        'invoice_reference': payment_request.invoice.invoice_number,
        'student_id': payment_request.student_id,
        'student_name': payment_request.student.get_full_name(),
        'method': payment_request.method,
        'phone_number': payment_request.phone_number,
        'status': payment_request.status,
        'created_at': payment_request.created_at.isoformat(),
    }


def _get_student(student_id):
    try:
        return User.objects.get(pk=int(student_id), role='student', is_active=True), None
    except (User.DoesNotExist, TypeError, ValueError):
        return None, JsonResponse({'error': 'Select an active student'}, status=400)


def _get_invoice(invoice_id):
    try:
        return Invoice.objects.select_related('student', 'fee_structure__programme').get(pk=int(invoice_id)), None
    except (Invoice.DoesNotExist, TypeError, ValueError):
        return None, JsonResponse({'error': 'Invoice not found'}, status=404)


@csrf_exempt
@require_http_methods(['GET', 'POST'])
@jwt_required
def fee_structure_list_create(request):
    if request.method == 'GET':
        denied = require_role(request, *FINANCE_ROLES)
        if denied:
            return denied
        queryset = FeeStructure.objects.select_related('programme')
        return collection_response(
            queryset, request, _serialize_fee,
            search_fields=('name', 'programme__title', 'programme__code', 'academic_year'),
            filters={'status': 'status'},
            ordering_fields={'academic_year': 'academic_year', 'amount': 'amount', 'name': 'name'},
            default_ordering=('academic_year', 'name'),
        )
    denied = require_role(request, *FINANCE_ROLES)
    if denied:
        return denied
    payload, error = json_payload(request)
    if error:
        return error
    name = payload.get('name')
    year = payload.get('academic_year')
    if not isinstance(name, str) or not name.strip() or not isinstance(year, str) or not year.strip():
        return JsonResponse({'error': 'name and academic_year are required'}, status=400)
    try:
        programme_id = int(payload.get('programme_id'))
        from apps.academics.models import Course
        programme = Course.objects.get(pk=programme_id, is_active=True)
    except (Course.DoesNotExist, TypeError, ValueError):
        return JsonResponse({'error': 'Select an existing active programme'}, status=400)
    amount, amount_error = decimal_value(payload.get('amount'), 'amount')
    if amount_error:
        return JsonResponse({'error': amount_error}, status=400)
    due_date, date_error = date_value(payload.get('due_date'), 'due_date', required=False)
    if date_error:
        return JsonResponse({'error': date_error}, status=400)
    status = payload.get('status', 'active')
    if not isinstance(status, str) or status not in {'active', 'inactive'}:
        return JsonResponse({'error': 'Invalid fee structure status'}, status=400)
    try:
        fee = FeeStructure.objects.create(name=name.strip(), programme=programme, academic_year=year.strip(), amount=amount, due_date=due_date, status=status)
    except IntegrityError:
        return JsonResponse({'error': 'A fee structure with this name, programme, and year already exists'}, status=409)
    AuditEvent.objects.create(actor=request.user, action='finance.fee_structure.create', description=f'Created fee structure {fee.pk}')
    return JsonResponse(_serialize_fee(fee), status=201)


@csrf_exempt
@require_http_methods(['GET', 'PATCH'])
@jwt_required
def fee_structure_detail(request, pk):
    denied = require_role(request, *FINANCE_ROLES)
    if denied:
        return denied
    try:
        fee = FeeStructure.objects.select_related('programme').get(pk=pk)
    except FeeStructure.DoesNotExist:
        return JsonResponse({'error': 'Fee structure not found'}, status=404)
    if request.method == 'GET':
        return JsonResponse(_serialize_fee(fee))
    payload, error = json_payload(request)
    if error:
        return error
    if 'name' in payload:
        if not isinstance(payload['name'], str) or not payload['name'].strip():
            return JsonResponse({'error': 'name is required'}, status=400)
        fee.name = payload['name'].strip()
    if 'academic_year' in payload:
        if not isinstance(payload['academic_year'], str) or not payload['academic_year'].strip():
            return JsonResponse({'error': 'academic_year is required'}, status=400)
        fee.academic_year = payload['academic_year'].strip()
    if 'amount' in payload:
        fee.amount, error_text = decimal_value(payload['amount'], 'amount')
        if error_text:
            return JsonResponse({'error': error_text}, status=400)
    if 'due_date' in payload:
        fee.due_date, error_text = date_value(payload['due_date'], 'due_date', required=False)
        if error_text:
            return JsonResponse({'error': error_text}, status=400)
    if 'status' in payload:
        if not isinstance(payload['status'], str) or payload['status'] not in {'active', 'inactive'}:
            return JsonResponse({'error': 'Invalid fee structure status'}, status=400)
        fee.status = payload['status']
    if 'programme_id' in payload:
        from apps.academics.models import Course
        try:
            fee.programme = Course.objects.get(pk=int(payload['programme_id']), is_active=True)
        except (Course.DoesNotExist, TypeError, ValueError):
            return JsonResponse({'error': 'Select an existing active programme'}, status=400)
    fee.save()
    return JsonResponse(_serialize_fee(fee))


@csrf_exempt
@require_http_methods(['GET', 'POST'])
@jwt_required
def invoice_list_create(request):
    user = request.user
    queryset = Invoice.objects.select_related('student', 'fee_structure__programme').prefetch_related('payments')
    if request.method == 'GET':
        if user.role == 'student':
            queryset = queryset.filter(student=user)
        elif user.role not in FINANCE_ROLES:
            return JsonResponse({'error': 'Forbidden'}, status=403)
        filters = {'status': 'status'}
        if request.GET.get('status') == 'overdue':
            queryset = queryset.filter(status__in=['issued', 'partially_paid', 'overdue'], due_date__lt=date.today())
            filters = {}
        return collection_response(
            queryset, request, _serialize_invoice,
            search_fields=('invoice_number', 'student__first_name', 'student__last_name', 'student__email', 'fee_structure__name'),
            filters=filters,
            ordering_fields={'due_date': 'due_date', 'created_at': 'created_at', 'amount': 'amount'},
            default_ordering=('-created_at',),
        )
    denied = require_role(request, *FINANCE_ROLES)
    if denied:
        return denied
    payload, error = json_payload(request)
    if error:
        return error
    student, error = _get_student(payload.get('student_id'))
    if error:
        return error
    try:
        fee = FeeStructure.objects.select_related('programme').get(pk=int(payload.get('fee_structure_id')), status='active')
    except (FeeStructure.DoesNotExist, TypeError, ValueError):
        return JsonResponse({'error': 'Select an active fee structure'}, status=400)
    if not Enrollment.objects.filter(student=student, course=fee.programme, status='active').exists():
        return JsonResponse({'error': 'Fee programme does not match the student programme'}, status=400)
    amount, amount_error = decimal_value(payload.get('amount'), 'amount', minimum=Decimal('0.01'))
    if amount_error:
        return JsonResponse({'error': amount_error}, status=400)
    due_date, date_error = date_value(payload.get('due_date'), 'due_date')
    if date_error:
        return JsonResponse({'error': date_error}, status=400)
    status = payload.get('status', 'issued')
    if not isinstance(status, str) or status not in {'draft', 'issued'}:
        return JsonResponse({'error': 'New invoices must be draft or issued'}, status=400)
    invoice = Invoice.objects.create(student=student, fee_structure=fee, amount=amount, due_date=due_date, status=status, description=str(payload.get('description', '')).strip())
    AuditEvent.objects.create(actor=user, action='finance.invoice.create', description=f'Created invoice {invoice.pk}')
    return JsonResponse(_serialize_invoice(invoice), status=201)


@csrf_exempt
@require_http_methods(['GET', 'PATCH'])
@jwt_required
def invoice_detail(request, pk):
    try:
        invoice = Invoice.objects.select_related('student', 'fee_structure__programme').prefetch_related('payments').get(pk=pk)
    except Invoice.DoesNotExist:
        return JsonResponse({'error': 'Invoice not found'}, status=404)
    if request.user.role == 'student':
        if invoice.student_id != request.user.id:
            return JsonResponse({'error': 'Invoice not found'}, status=404)
        if request.method == 'PATCH':
            return JsonResponse({'error': 'Forbidden'}, status=403)
    elif request.user.role not in FINANCE_ROLES:
        return JsonResponse({'error': 'Forbidden'}, status=403)
    if request.method == 'GET':
        return JsonResponse(_serialize_invoice(invoice))
    payload, error = json_payload(request)
    if error:
        return error
    student = invoice.student
    fee = invoice.fee_structure
    if 'student_id' in payload:
        student, error = _get_student(payload['student_id'])
        if error:
            return error
    if 'fee_structure_id' in payload:
        try:
            fee = FeeStructure.objects.select_related('programme').get(pk=int(payload['fee_structure_id']), status='active')
        except (FeeStructure.DoesNotExist, TypeError, ValueError):
            return JsonResponse({'error': 'Select an active fee structure'}, status=400)
    if student.pk != invoice.student_id or fee.pk != invoice.fee_structure_id:
        if invoice.payments.exists():
            return JsonResponse({'error': 'Invoice relationships cannot change after payments are recorded'}, status=400)
        if not Enrollment.objects.filter(student=student, course=fee.programme, status='active').exists():
            return JsonResponse({'error': 'Fee programme does not match the student programme'}, status=400)
        invoice.student = student
        invoice.fee_structure = fee
    if 'amount' in payload:
        invoice.amount, amount_error = decimal_value(payload['amount'], 'amount', minimum=Decimal('0.01'))
        if amount_error:
            return JsonResponse({'error': amount_error}, status=400)
        if invoice.amount < _confirmed_total(invoice):
            return JsonResponse({'error': 'Invoice amount cannot be less than confirmed payments'}, status=400)
    if 'due_date' in payload:
        invoice.due_date, date_error = date_value(payload['due_date'], 'due_date')
        if date_error:
            return JsonResponse({'error': date_error}, status=400)
    if 'description' in payload:
        if not isinstance(payload['description'], str):
            return JsonResponse({'error': 'description must be text'}, status=400)
        invoice.description = payload['description'].strip()
    if 'status' in payload:
        target = payload['status']
        allowed = {'draft': {'issued', 'cancelled'}, 'issued': {'cancelled'}, 'partially_paid': {'cancelled'}, 'overdue': {'cancelled'}, 'paid': set(), 'cancelled': set()}
        current = _invoice_status(invoice)
        if not isinstance(target, str) or (target != current and target not in allowed.get(current, set())):
            return JsonResponse({'error': f'Cannot transition from {current} to {target}'}, status=400)
        if target == 'paid' and _confirmed_total(invoice) < invoice.amount:
            return JsonResponse({'error': 'Only confirmed payments can mark an invoice paid'}, status=400)
        if target not in {choice[0] for choice in Invoice.STATUS_CHOICES}:
            return JsonResponse({'error': 'Invalid invoice status'}, status=400)
        invoice.status = target
    invoice.save()
    return JsonResponse(_serialize_invoice(invoice))


@csrf_exempt
@require_http_methods(['GET', 'POST'])
@jwt_required
def payment_list_create(request):
    user = request.user
    queryset = Payment.objects.select_related('invoice__student', 'invoice__fee_structure__programme')
    if request.method == 'GET':
        if user.role == 'student':
            queryset = queryset.filter(invoice__student=user)
        elif user.role not in FINANCE_ROLES:
            return JsonResponse({'error': 'Forbidden'}, status=403)
        return collection_response(
            queryset, request, _serialize_payment,
            search_fields=('reference', 'invoice__invoice_number', 'invoice__student__first_name', 'invoice__student__last_name'),
            filters={'status': 'status'},
            ordering_fields={'paid_at': 'paid_at', 'amount': 'amount'},
            default_ordering=('-paid_at',),
        )
    denied = require_role(request, *FINANCE_ROLES)
    if denied:
        return denied
    payload, error = json_payload(request)
    if error:
        return error
    invoice, error = _get_invoice(payload.get('invoice_id'))
    if error:
        return error
    amount, amount_error = decimal_value(payload.get('amount'), 'amount', minimum=Decimal('0.01'))
    if amount_error:
        return JsonResponse({'error': amount_error}, status=400)
    method = payload.get('method')
    if not isinstance(method, str) or method not in {'mpesa', 'bank', 'card', 'cash'}:
        return JsonResponse({'error': 'Invalid payment method'}, status=400)
    reference = payload.get('reference')
    if not isinstance(reference, str) or not reference.strip():
        return JsonResponse({'error': 'reference is required'}, status=400)
    paid_at, date_error = date_value(payload.get('paid_at'), 'paid_at')
    if date_error:
        return JsonResponse({'error': date_error}, status=400)
    status = payload.get('status', 'pending')
    if not isinstance(status, str) or status not in {'pending', 'confirmed', 'failed'}:
        return JsonResponse({'error': 'Invalid payment status'}, status=400)
    with transaction.atomic():
        invoice = Invoice.objects.select_for_update().get(pk=invoice.pk)
        if invoice.status == 'cancelled':
            return JsonResponse({'error': 'Cannot pay a cancelled invoice'}, status=400)
        if status == 'confirmed' and amount > invoice.amount - _confirmed_total(invoice):
            return JsonResponse({'error': 'Payment exceeds the invoice balance'}, status=400)
        try:
            payment = Payment.objects.create(invoice=invoice, amount=amount, method=method, reference=reference.strip(), paid_at=paid_at, status=status)
        except IntegrityError:
            return JsonResponse({'error': 'Payment reference already exists'}, status=409)
        if status == 'confirmed':
            _refresh_invoice_status(invoice)
    AuditEvent.objects.create(actor=user, action='finance.payment.create', description=f'Created payment {payment.pk} with status {payment.status}')
    return JsonResponse(_serialize_payment(payment), status=201)


@csrf_exempt
@require_http_methods(['GET', 'PATCH'])
@jwt_required
def payment_detail(request, pk):
    try:
        payment = Payment.objects.select_related('invoice__student').get(pk=pk)
    except Payment.DoesNotExist:
        return JsonResponse({'error': 'Payment not found'}, status=404)
    if request.user.role == 'student':
        if payment.invoice.student_id != request.user.id:
            return JsonResponse({'error': 'Payment not found'}, status=404)
        if request.method == 'PATCH':
            return JsonResponse({'error': 'Forbidden'}, status=403)
    elif request.user.role not in FINANCE_ROLES:
        return JsonResponse({'error': 'Forbidden'}, status=403)
    if request.method == 'GET':
        return JsonResponse(_serialize_payment(payment))
    if payment.status == 'voided':
        return JsonResponse({'error': 'Voided payments cannot be changed'}, status=400)
    payload, error = json_payload(request)
    if error:
        return error
    original_status = payment.status
    original_amount = payment.amount
    original_invoice_id = payment.invoice_id
    target_invoice = payment.invoice
    if 'invoice_id' in payload:
        target_invoice, error = _get_invoice(payload['invoice_id'])
        if error:
            return error
        if target_invoice.pk != original_invoice_id and original_status == 'confirmed':
            return JsonResponse({'error': 'A confirmed payment cannot be moved to another invoice'}, status=400)
    if 'amount' in payload:
        payment.amount, error_text = decimal_value(payload['amount'], 'amount', minimum=Decimal('0.01'))
        if error_text:
            return JsonResponse({'error': error_text}, status=400)
    if 'method' in payload:
        if not isinstance(payload['method'], str) or payload['method'] not in {'mpesa', 'bank', 'card', 'cash'}:
            return JsonResponse({'error': 'Invalid payment method'}, status=400)
        payment.method = payload['method']
    if 'reference' in payload:
        if not isinstance(payload['reference'], str) or not payload['reference'].strip():
            return JsonResponse({'error': 'reference is required'}, status=400)
        payment.reference = payload['reference'].strip()
    if 'paid_at' in payload:
        payment.paid_at, error_text = date_value(payload['paid_at'], 'paid_at')
        if error_text:
            return JsonResponse({'error': error_text}, status=400)
    if 'status' in payload:
        target = payload['status']
        if not isinstance(target, str) or target not in {'pending', 'confirmed', 'failed'}:
            return JsonResponse({'error': 'Invalid payment status'}, status=400)
        if original_status in {'confirmed', 'failed'} and target != original_status:
            return JsonResponse({'error': f'Cannot transition from {original_status} to {target}; use the void action for a confirmed payment'}, status=400)
        payment.status = target
    with transaction.atomic():
        original_invoice = Invoice.objects.select_for_update().get(pk=original_invoice_id)
        invoice = original_invoice if target_invoice.pk == original_invoice_id else Invoice.objects.select_for_update().get(pk=target_invoice.pk)
        if invoice.status == 'cancelled':
            return JsonResponse({'error': 'Cannot record a payment against a cancelled invoice'}, status=400)
        confirmed_other = _confirmed_total(invoice)
        if original_status == 'confirmed' and invoice.pk == original_invoice_id:
            confirmed_other -= original_amount
        if payment.status == 'confirmed' and payment.amount > invoice.amount - confirmed_other:
            return JsonResponse({'error': 'Payment exceeds the invoice balance'}, status=400)
        payment.invoice = invoice
        try:
            payment.save()
        except IntegrityError:
            return JsonResponse({'error': 'Payment reference already exists'}, status=409)
        _refresh_invoice_status(invoice)
    AuditEvent.objects.create(actor=request.user, action='finance.payment.update', description=f'Updated payment {payment.pk}')
    return JsonResponse(_serialize_payment(payment))


@csrf_exempt
@require_http_methods(['POST'])
@jwt_required
def payment_void(request, pk):
    denied = require_role(request, *FINANCE_ROLES)
    if denied:
        return denied
    payload, error = json_payload(request)
    if error:
        return error
    reason = payload.get('reason', 'Voided by finance officer')
    if not isinstance(reason, str) or not reason.strip():
        return JsonResponse({'error': 'A void reason is required'}, status=400)
    with transaction.atomic():
        try:
            payment = Payment.objects.select_for_update().select_related('invoice').get(pk=pk)
        except Payment.DoesNotExist:
            return JsonResponse({'error': 'Payment not found'}, status=404)
        if payment.status != 'confirmed':
            return JsonResponse({'error': 'Only confirmed payments can be voided'}, status=400)
        payment.status = 'voided'
        payment.save(update_fields=['status'])
        reversal = PaymentReversal.objects.create(payment=payment, actor=request.user, reason=reason.strip())
        invoice = Invoice.objects.select_for_update().get(pk=payment.invoice_id)
        _refresh_invoice_status(invoice)
    AuditEvent.objects.create(actor=request.user, action='finance.payment.void', description=f'Voided payment {payment.pk}; reversal {reversal.pk}')
    return JsonResponse(_serialize_payment(payment))


@csrf_exempt
@require_http_methods(['GET', 'POST'])
@jwt_required
def payment_request_list_create(request):
    user = request.user
    queryset = PaymentRequest.objects.select_related('invoice', 'student')
    if request.method == 'GET':
        if user.role == 'student':
            queryset = queryset.filter(student=user)
        elif user.role not in FINANCE_ROLES:
            return JsonResponse({'error': 'Forbidden'}, status=403)
        return collection_response(
            queryset, request, _serialize_request,
            search_fields=('invoice__invoice_number', 'student__first_name', 'student__last_name', 'student__email'),
            filters={'status': 'status'},
            ordering_fields={'created_at': 'created_at'},
            default_ordering=('-created_at',),
        )
    if user.role != 'student':
        return JsonResponse({'error': 'Only students can request a payment'}, status=403)
    payload, error = json_payload(request)
    if error:
        return error
    invoice, error = _get_invoice(payload.get('invoice_id'))
    if error:
        return error
    if invoice.student_id != user.id:
        return JsonResponse({'error': 'Invoice not found'}, status=404)
    if invoice.status in {'paid', 'cancelled'} or _confirmed_total(invoice) >= invoice.amount:
        return JsonResponse({'error': 'Invoice has no outstanding balance'}, status=400)
    method = payload.get('method')
    if not isinstance(method, str) or method not in {'mpesa', 'bank', 'card'}:
        return JsonResponse({'error': 'Invalid payment method'}, status=400)
    phone = payload.get('phone_number') or ''
    if method == 'mpesa' and (not isinstance(phone, str) or not phone.strip()):
        return JsonResponse({'error': 'phone_number is required for M-Pesa'}, status=400)
    if PaymentRequest.objects.filter(invoice=invoice, student=user, status='pending').exists():
        return JsonResponse({'error': 'A payment request is already pending for this invoice'}, status=409)
    payment_request = PaymentRequest.objects.create(invoice=invoice, student=user, method=method, phone_number=phone.strip() if isinstance(phone, str) else '')
    AuditEvent.objects.create(actor=user, action='finance.payment_request.create', description=f'Created payment request {payment_request.pk}')
    return JsonResponse({'message': 'Payment request submitted', **_serialize_request(payment_request)}, status=201)
