from datetime import date, timedelta

from django.db import IntegrityError, transaction
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from apps.accounts.jwt_utils import jwt_required
from apps.accounts.models import AuditEvent, User
from apps.common.service_api import collection_response, date_value, integer_value, json_payload

from .models import Book, Loan, Reservation


def _available_copies(book):
    on_loan = book.loans.filter(status__in=['active', 'overdue']).count()
    lost = book.loans.filter(status='lost').count()
    on_hold = book.reservations.filter(status='ready').count()
    return max(0, book.total_copies - on_loan - lost - on_hold)


def _serialize_book(book):
    return {
        'id': book.id,
        'isbn': book.isbn or '',
        'title': book.title,
        'author': book.author,
        'category': book.category,
        'total_copies': book.total_copies,
        'available_copies': _available_copies(book),
        'location': book.location,
        'status': book.status,
        'created_at': book.created_at.isoformat(),
    }


def _loan_status(loan):
    if loan.status == 'active' and loan.due_date < date.today():
        return 'overdue'
    return loan.status


def _serialize_loan(loan):
    return {
        'id': loan.id,
        'book_id': loan.book_id,
        'book_title': loan.book.title,
        'student_id': loan.student_id,
        'student_name': loan.student.get_full_name(),
        'borrowed_on': loan.borrowed_on.isoformat(),
        'due_date': loan.due_date.isoformat(),
        'returned_on': loan.returned_on.isoformat() if loan.returned_on else None,
        'status': _loan_status(loan),
        'created_at': loan.created_at.isoformat(),
    }


def _serialize_reservation(reservation):
    return {
        'id': reservation.id,
        'book_id': reservation.book_id,
        'book_title': reservation.book.title,
        'student_id': reservation.student_id,
        'student_name': reservation.student.get_full_name(),
        'reserved_on': reservation.reserved_on.isoformat(),
        'expires_on': reservation.expires_on.isoformat() if reservation.expires_on else None,
        'status': reservation.status,
        'created_at': reservation.created_at.isoformat(),
    }


def _student(student_id):
    try:
        return User.objects.get(pk=int(student_id), role='student', is_active=True), None
    except (User.DoesNotExist, TypeError, ValueError):
        return None, JsonResponse({'error': 'Select an active student'}, status=400)


def _promote_waiting_reservations(book):
    for reservation in book.reservations.filter(status='queued').order_by('created_at'):
        if _available_copies(book) < 1:
            break
        reservation.status = 'ready'
        reservation.expires_on = date.today() + timedelta(days=7)
        reservation.save(update_fields=['status', 'expires_on'])


@csrf_exempt
@require_http_methods(['GET', 'POST'])
@jwt_required
def book_list_create(request):
    if request.user.role not in {'student', 'librarian', 'admin'}:
        return JsonResponse({'error': 'Forbidden'}, status=403)
    if request.method == 'GET':
        queryset = Book.objects.all()
        return collection_response(
            queryset, request, _serialize_book,
            search_fields=('title', 'author', 'isbn', 'category'),
            filters={'category': 'category', 'status': 'status'},
            ordering_fields={'title': 'title', 'author': 'author', 'category': 'category'},
            default_ordering=('title', 'author'),
        )
    if request.user.role not in {'librarian', 'admin'}:
        return JsonResponse({'error': 'Only Librarians can manage the catalogue'}, status=403)
    payload, error = json_payload(request)
    if error:
        return error
    title, author = payload.get('title'), payload.get('author')
    if not isinstance(title, str) or not title.strip() or not isinstance(author, str) or not author.strip():
        return JsonResponse({'error': 'title and author are required'}, status=400)
    copies, error_text = integer_value(payload.get('total_copies', 1), 'total_copies', minimum=1)
    if error_text:
        return JsonResponse({'error': error_text}, status=400)
    status = payload.get('status', 'available')
    if not isinstance(status, str) or status not in {'available', 'inactive'}:
        return JsonResponse({'error': 'Invalid book status'}, status=400)
    isbn = payload.get('isbn') or None
    if isbn is not None and (not isinstance(isbn, str) or len(isbn) > 20):
        return JsonResponse({'error': 'isbn must be at most 20 characters'}, status=400)
    try:
        book = Book.objects.create(
            isbn=isbn.strip() if isbn else None,
            title=title.strip(),
            author=author.strip(),
            category=str(payload.get('category', '')).strip(),
            total_copies=copies,
            location=str(payload.get('location', '')).strip(),
            status=status,
        )
    except IntegrityError:
        return JsonResponse({'error': 'ISBN already exists'}, status=409)
    AuditEvent.objects.create(actor=request.user, action='library.book.create', description=f'Created book {book.pk}')
    return JsonResponse(_serialize_book(book), status=201)


@csrf_exempt
@require_http_methods(['GET', 'PATCH'])
@jwt_required
def book_detail(request, pk):
    if request.user.role not in {'student', 'librarian', 'admin'}:
        return JsonResponse({'error': 'Forbidden'}, status=403)
    try:
        book = Book.objects.get(pk=pk)
    except Book.DoesNotExist:
        return JsonResponse({'error': 'Book not found'}, status=404)
    if request.method == 'GET':
        return JsonResponse(_serialize_book(book))
    if request.user.role not in {'librarian', 'admin'}:
        return JsonResponse({'error': 'Only Librarians can manage the catalogue'}, status=403)
    payload, error = json_payload(request)
    if error:
        return error
    for field in ('title', 'author', 'category', 'location'):
        if field in payload:
            if not isinstance(payload[field], str) or (field in {'title', 'author'} and not payload[field].strip()):
                return JsonResponse({'error': f'{field} must be a non-empty string'}, status=400)
            setattr(book, field, payload[field].strip())
    if 'total_copies' in payload:
        total_copies, error_text = integer_value(payload['total_copies'], 'total_copies', minimum=1)
        if error_text:
            return JsonResponse({'error': error_text}, status=400)
        occupied = (
            book.loans.filter(status__in=['active', 'overdue']).count()
            + book.loans.filter(status='lost').count()
            + book.reservations.filter(status='ready').count()
        )
        if total_copies < occupied:
            return JsonResponse({'error': 'Total copies cannot be less than currently borrowed and reserved copies'}, status=400)
        book.total_copies = total_copies
    if 'isbn' in payload:
        value = payload['isbn'] or None
        if value is not None and (not isinstance(value, str) or len(value) > 20):
            return JsonResponse({'error': 'isbn must be at most 20 characters'}, status=400)
        book.isbn = value.strip() if value else None
    if 'status' in payload:
        if not isinstance(payload['status'], str) or payload['status'] not in {'available', 'inactive'}:
            return JsonResponse({'error': 'Invalid book status'}, status=400)
        book.status = payload['status']
    try:
        book.save()
    except IntegrityError:
        return JsonResponse({'error': 'ISBN already exists'}, status=409)
    return JsonResponse(_serialize_book(book))


@csrf_exempt
@require_http_methods(['GET', 'POST'])
@jwt_required
def loan_list_create(request):
    user = request.user
    queryset = Loan.objects.select_related('book', 'student')
    if request.method == 'GET':
        if user.role == 'student':
            queryset = queryset.filter(student=user)
        elif user.role not in {'librarian', 'admin'}:
            return JsonResponse({'error': 'Forbidden'}, status=403)
        status = request.GET.get('status')
        if status == 'overdue':
            queryset = queryset.filter(status='active', due_date__lt=date.today())
        elif status == 'active':
            queryset = queryset.filter(status='active', due_date__gte=date.today())
        elif status:
            queryset = queryset.filter(status=status)
        return collection_response(
            queryset, request, _serialize_loan,
            search_fields=('book__title', 'student__first_name', 'student__last_name', 'student__email'),
            ordering_fields={'due_date': 'due_date', 'borrowed_on': 'borrowed_on'},
            default_ordering=('-borrowed_on',),
        )
    if user.role not in {'librarian', 'admin'}:
        return JsonResponse({'error': 'Only Librarians can issue loans'}, status=403)
    payload, error = json_payload(request)
    if error:
        return error
    try:
        book = Book.objects.get(pk=int(payload.get('book_id')), status='available')
    except (Book.DoesNotExist, TypeError, ValueError):
        return JsonResponse({'error': 'Select an active catalogue book'}, status=400)
    student, error = _student(payload.get('student_id'))
    if error:
        return error
    borrowed_on, date_error = date_value(payload.get('borrowed_on'), 'borrowed_on')
    if date_error:
        return JsonResponse({'error': date_error}, status=400)
    due_date, date_error = date_value(payload.get('due_date'), 'due_date')
    if date_error:
        return JsonResponse({'error': date_error}, status=400)
    if due_date < borrowed_on:
        return JsonResponse({'error': 'due_date must not precede borrowed_on'}, status=400)
    returned_on, date_error = date_value(payload.get('returned_on'), 'returned_on', required=False)
    if date_error:
        return JsonResponse({'error': date_error}, status=400)
    status = payload.get('status', 'active')
    if not isinstance(status, str) or status not in {'active', 'returned', 'overdue', 'lost'}:
        return JsonResponse({'error': 'Invalid loan status'}, status=400)
    if status == 'overdue':
        if due_date >= date.today():
            return JsonResponse({'error': 'Only a past-due active loan can be overdue'}, status=400)
        status = 'active'
    if (status == 'returned') != bool(returned_on):
        return JsonResponse({'error': 'returned_on is required exactly when status is returned'}, status=400)
    if returned_on and returned_on < borrowed_on:
        return JsonResponse({'error': 'returned_on must not precede borrowed_on'}, status=400)
    with transaction.atomic():
        book = Book.objects.select_for_update().get(pk=book.pk)
        reservation = Reservation.objects.filter(book=book, student=student, status='ready').first()
        if status == 'active' and _available_copies(book) < 1 and not reservation:
            return JsonResponse({'error': 'No unreserved copies are available'}, status=409)
        if status == 'active' and Loan.objects.filter(student=student, book=book, status__in=['active', 'overdue']).exists():
            return JsonResponse({'error': 'Student already has an active loan for this book'}, status=409)
        loan = Loan.objects.create(book=book, student=student, borrowed_on=borrowed_on, due_date=due_date, returned_on=returned_on, status=status)
        if reservation and status == 'active':
            reservation.status = 'fulfilled'
            reservation.save(update_fields=['status'])
    AuditEvent.objects.create(actor=user, action='library.loan.create', description=f'Created loan {loan.pk}')
    return JsonResponse(_serialize_loan(loan), status=201)


@csrf_exempt
@require_http_methods(['GET', 'PATCH'])
@jwt_required
def loan_detail(request, pk):
    try:
        loan = Loan.objects.select_related('book', 'student').get(pk=pk)
    except Loan.DoesNotExist:
        return JsonResponse({'error': 'Loan not found'}, status=404)
    if request.user.role == 'student':
        if loan.student_id != request.user.id:
            return JsonResponse({'error': 'Loan not found'}, status=404)
        if request.method == 'PATCH':
            return JsonResponse({'error': 'Forbidden'}, status=403)
    elif request.user.role not in {'librarian', 'admin'}:
        return JsonResponse({'error': 'Forbidden'}, status=403)
    if request.method == 'GET':
        return JsonResponse(_serialize_loan(loan))
    payload, error = json_payload(request)
    if error:
        return error
    if 'book_id' in payload and str(payload['book_id']) != str(loan.book_id):
        return JsonResponse({'error': 'A loan book cannot be reassigned'}, status=400)
    if 'student_id' in payload and str(payload['student_id']) != str(loan.student_id):
        return JsonResponse({'error': 'A loan student cannot be reassigned'}, status=400)
    new_status = payload.get('status', loan.status)
    transitions = {'active': {'returned', 'lost', 'cancelled'}, 'overdue': {'returned', 'lost', 'cancelled'}, 'returned': set(), 'lost': set(), 'cancelled': set()}
    if not isinstance(new_status, str) or new_status not in {'active', 'returned', 'overdue', 'lost', 'cancelled'}:
        return JsonResponse({'error': 'Invalid loan status'}, status=400)
    if new_status == 'overdue':
        if _loan_status(loan) != 'overdue':
            return JsonResponse({'error': 'Only a past-due active loan can be overdue'}, status=400)
        new_status = 'active'
    if new_status != _loan_status(loan) and new_status not in transitions[_loan_status(loan)]:
        return JsonResponse({'error': f'Cannot transition from {_loan_status(loan)} to {new_status}'}, status=400)
    borrowed_on = loan.borrowed_on
    due_date = loan.due_date
    if 'borrowed_on' in payload:
        borrowed_on, date_error = date_value(payload['borrowed_on'], 'borrowed_on')
        if date_error:
            return JsonResponse({'error': date_error}, status=400)
    if 'due_date' in payload:
        due_date, date_error = date_value(payload['due_date'], 'due_date')
        if date_error:
            return JsonResponse({'error': date_error}, status=400)
    if due_date < borrowed_on:
        return JsonResponse({'error': 'due_date must not precede borrowed_on'}, status=400)
    returned_on = loan.returned_on
    if 'returned_on' in payload:
        returned_on, date_error = date_value(payload['returned_on'], 'returned_on', required=False)
        if date_error:
            return JsonResponse({'error': date_error}, status=400)
    if new_status == 'returned':
        returned_on = returned_on or date.today()
        if returned_on < borrowed_on:
            return JsonResponse({'error': 'returned_on must not precede borrowed_on'}, status=400)
    elif returned_on is not None:
        return JsonResponse({'error': 'returned_on is only valid for a returned loan'}, status=400)
    loan.status = new_status
    loan.borrowed_on = borrowed_on
    loan.due_date = due_date
    loan.returned_on = returned_on
    loan.save(update_fields=['status', 'borrowed_on', 'due_date', 'returned_on'])
    if new_status in {'returned', 'cancelled'} and _loan_status(loan) != 'active':
        _promote_waiting_reservations(loan.book)
    AuditEvent.objects.create(actor=request.user, action='library.loan.status', description=f'Loan {loan.pk} changed to {new_status}')
    return JsonResponse(_serialize_loan(loan))


@csrf_exempt
@require_http_methods(['GET', 'POST'])
@jwt_required
def reservation_list_create(request):
    user = request.user
    queryset = Reservation.objects.select_related('book', 'student')
    if request.method == 'GET':
        if user.role == 'student':
            queryset = queryset.filter(student=user)
        elif user.role not in {'librarian', 'admin'}:
            return JsonResponse({'error': 'Forbidden'}, status=403)
        return collection_response(
            queryset, request, _serialize_reservation,
            search_fields=('book__title', 'student__first_name', 'student__last_name', 'student__email'),
            filters={'status': 'status'},
            ordering_fields={'reserved_on': 'reserved_on', 'created_at': 'created_at'},
            default_ordering=('created_at',),
        )
    if user.role not in {'student', 'librarian', 'admin'}:
        return JsonResponse({'error': 'Forbidden'}, status=403)
    payload, error = json_payload(request)
    if error:
        return error
    try:
        book = Book.objects.get(pk=int(payload.get('book_id')), status='available')
    except (Book.DoesNotExist, TypeError, ValueError):
        return JsonResponse({'error': 'Select an active catalogue book'}, status=400)
    if user.role == 'student':
        student = user
    else:
        student, error = _student(payload.get('student_id'))
        if error:
            return error
    reserved_on, date_error = date_value(payload.get('reserved_on', date.today().isoformat()), 'reserved_on')
    if date_error:
        return JsonResponse({'error': date_error}, status=400)
    expires_on, date_error = date_value(payload.get('expires_on'), 'expires_on', required=False)
    if date_error:
        return JsonResponse({'error': date_error}, status=400)
    if expires_on and expires_on < reserved_on:
        return JsonResponse({'error': 'expires_on must not precede reserved_on'}, status=400)
    status = payload.get('status', 'queued')
    if user.role == 'student':
        if status != 'queued':
            return JsonResponse({'error': 'Student reservations must start queued'}, status=400)
    elif not isinstance(status, str) or status not in {'queued', 'ready'}:
        return JsonResponse({'error': 'New reservations must start queued or ready'}, status=400)
    with transaction.atomic():
        book = Book.objects.select_for_update().get(pk=book.pk)
        active = Reservation.objects.filter(student=student, book=book, status__in=['queued', 'ready']).exists()
        if active:
            return JsonResponse({'error': 'Student already has an active reservation for this book'}, status=409)
        if user.role == 'student':
            status = 'ready' if _available_copies(book) > 0 else 'queued'
        if status == 'ready' and _available_copies(book) < 1:
            return JsonResponse({'error': 'No copies are currently available for pickup'}, status=409)
        reservation = Reservation.objects.create(
            book=book,
            student=student,
            reserved_on=reserved_on,
            expires_on=expires_on or reserved_on + timedelta(days=7),
            status=status,
        )
    AuditEvent.objects.create(actor=user, action='library.reservation.create', description=f'Created reservation {reservation.pk}')
    return JsonResponse(_serialize_reservation(reservation), status=201)


@csrf_exempt
@require_http_methods(['GET', 'PATCH'])
@jwt_required
def reservation_detail(request, pk):
    try:
        reservation = Reservation.objects.select_related('book', 'student').get(pk=pk)
    except Reservation.DoesNotExist:
        return JsonResponse({'error': 'Reservation not found'}, status=404)
    if request.user.role == 'student':
        if reservation.student_id != request.user.id:
            return JsonResponse({'error': 'Reservation not found'}, status=404)
        if request.method == 'PATCH':
            return JsonResponse({'error': 'Forbidden'}, status=403)
    elif request.user.role not in {'librarian', 'admin'}:
        return JsonResponse({'error': 'Forbidden'}, status=403)
    if request.method == 'GET':
        return JsonResponse(_serialize_reservation(reservation))
    payload, error = json_payload(request)
    if error:
        return error
    if 'book_id' in payload and str(payload['book_id']) != str(reservation.book_id):
        return JsonResponse({'error': 'A reservation book cannot be reassigned'}, status=400)
    if 'student_id' in payload and str(payload['student_id']) != str(reservation.student_id):
        return JsonResponse({'error': 'A reservation student cannot be reassigned'}, status=400)
    status = payload.get('status', reservation.status)
    transitions = {'queued': {'ready', 'cancelled', 'expired'}, 'ready': {'fulfilled', 'cancelled', 'expired'}, 'fulfilled': set(), 'cancelled': set(), 'expired': set()}
    if not isinstance(status, str) or (status != reservation.status and status not in transitions[reservation.status]):
        return JsonResponse({'error': f'Cannot transition from {reservation.status} to {status}'}, status=400)
    if status == 'ready' and reservation.status != 'ready' and _available_copies(reservation.book) < 1:
        return JsonResponse({'error': 'No copies are currently available for pickup'}, status=409)
    if status == 'fulfilled' and not Loan.objects.filter(student=reservation.student, book=reservation.book, status__in=['active', 'overdue']).exists():
        return JsonResponse({'error': 'A loan must be issued before fulfilling this reservation'}, status=400)
    reservation.status = status
    if 'reserved_on' in payload:
        reservation.reserved_on, date_error = date_value(payload['reserved_on'], 'reserved_on')
        if date_error:
            return JsonResponse({'error': date_error}, status=400)
    if 'expires_on' in payload:
        reservation.expires_on, date_error = date_value(payload['expires_on'], 'expires_on', required=False)
        if date_error:
            return JsonResponse({'error': date_error}, status=400)
    if reservation.expires_on and reservation.expires_on < reservation.reserved_on:
        return JsonResponse({'error': 'expires_on must not precede reserved_on'}, status=400)
    reservation.save()
    AuditEvent.objects.create(actor=request.user, action='library.reservation.status', description=f'Reservation {reservation.pk} changed to {status}')
    return JsonResponse(_serialize_reservation(reservation))
