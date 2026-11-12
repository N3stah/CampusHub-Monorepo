import json
from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.test import Client

from apps.accounts.jwt_utils import make_token
from apps.academics.models import AcademicPeriod, Course, Department, Enrollment, Offering, Registration, Unit
from apps.admissions.models import Application
from apps.finance.models import FeeStructure, Invoice, Payment, PaymentReversal, PaymentRequest
from apps.hostels.models import Allocation, Hostel, Room
from apps.library.models import Book, Loan, Reservation


def api_client(user):
    client = Client()
    client.defaults['HTTP_AUTHORIZATION'] = f'Bearer {make_token(user, "access")}'
    return client


def create_user(user_model, *, role, suffix):
    return user_model.objects.create_user(
        email=f'{suffix}@campushub.test',
        username=suffix,
        password='ValidPassword123!',
        first_name=suffix.title(),
        last_name='Tester',
        role=role,
    )


@pytest.mark.django_db
def test_admissions_requires_registrar_and_enforces_status_transitions(django_user_model):
    registrar = create_user(django_user_model, role='registrar', suffix='registrar1')
    student = create_user(django_user_model, role='student', suffix='student1')
    department = Department.objects.create(name='Engineering', code='ENG')
    programme = Course.objects.create(title='Engineering', code='ENG1', department=department)
    client = api_client(registrar)
    response = client.post('/api/admissions/applications/', json.dumps({
        'first_name': 'Applicant',
        'last_name': 'Example',
        'email': 'applicant@example.test',
        'programme_id': programme.id,
        'status': 'submitted',
    }), content_type='application/json')
    assert response.status_code == 201, response.content
    application_id = response.json()['id']
    assert client.patch(f'/api/admissions/applications/{application_id}/', json.dumps({'status': 'accepted'}), content_type='application/json').status_code == 400
    assert client.patch(f'/api/admissions/applications/{application_id}/', json.dumps({'status': 'under_review'}), content_type='application/json').status_code == 200
    assert api_client(student).get('/api/admissions/applications/').status_code == 403
    assert Application.objects.get(pk=application_id).status == 'under_review'


@pytest.mark.django_db
def test_periods_support_frontend_fields_filters_and_reject_overlap(django_user_model):
    registrar = create_user(django_user_model, role='registrar', suffix='registrar2')
    client = api_client(registrar)
    response = client.post('/api/academics/periods/', json.dumps({
        'academic_year': '2027/2028',
        'name': 'Semester 1',
        'starts_on': '2027-09-01',
        'ends_on': '2028-01-31',
        'status': 'active',
    }), content_type='application/json')
    assert response.status_code == 201
    assert response.json()['academic_year'] == '2027/2028'
    assert response.json()['starts_on'] == '2027-09-01'
    assert client.get('/api/academics/periods/?status=active&page=1&page_size=25').json()['count'] == 1
    overlapping = client.post('/api/academics/periods/', json.dumps({
        'academic_year': '2027/2028',
        'name': 'Semester 2',
        'starts_on': '2028-01-31',
        'ends_on': '2028-06-30',
        'status': 'planned',
    }), content_type='application/json')
    assert overlapping.status_code == 409


@pytest.mark.django_db
def test_registrar_can_manage_searchable_programme_enrolments(django_user_model):
    registrar = create_user(django_user_model, role='registrar', suffix='registrar-enrolments')
    student = create_user(django_user_model, role='student', suffix='registrar-enrolment-student')
    student.admission_number = 'REG-1001'
    student.save(update_fields=['admission_number'])
    department = Department.objects.create(name='Registrar Engineering', code='RENG')
    programme = Course.objects.create(title='Registrar Engineering', code='RENG1', department=department)
    client = api_client(registrar)

    created = client.post('/api/academics/admin/enrollments/', json.dumps({
        'admission_number': student.admission_number,
        'course_id': programme.id,
    }), content_type='application/json')
    assert created.status_code == 201, created.content
    enrollment_id = created.json()['id']

    listing = client.get('/api/academics/admin/enrollments/?status=active&search=REG-1001&page=1&page_size=25')
    assert listing.status_code == 200
    assert listing.json()['count'] == 1
    listed_enrollment = listing.json()['results'][0]
    assert listed_enrollment['student_email'] == student.email
    assert listed_enrollment['course_title'] == programme.title
    assert listed_enrollment['department_name'] == department.name

    updated = client.patch(
        f'/api/academics/admin/enrollments/{enrollment_id}/',
        json.dumps({'status': 'dropped'}),
        content_type='application/json',
    )
    assert updated.status_code == 200, updated.content
    assert updated.json()['status'] == 'dropped'
    assert client.get('/api/academics/admin/enrollments/?status=active').json()['count'] == 0
    assert api_client(student).get('/api/academics/admin/enrollments/').status_code == 403


@pytest.mark.django_db
def test_student_registration_uses_authenticated_student_and_scopes_results(django_user_model):
    student = create_user(django_user_model, role='student', suffix='student2')
    another_student = create_user(django_user_model, role='student', suffix='student3')
    registrar = create_user(django_user_model, role='registrar', suffix='registrar3')
    department = Department.objects.create(name='Science', code='SCI')
    programme = Course.objects.create(title='Science', code='SCI1', department=department)
    period = AcademicPeriod.objects.create(name='Term 1', academic_year='2027/2028', start_date=date.today() - timedelta(days=1), end_date=date.today() + timedelta(days=30), status='active', is_current=True)
    unit = Unit.objects.create(code='BIO1', title='Biology')
    unit.departments.add(department)
    Offering.objects.create(unit=unit, course=programme, period=period)
    Enrollment.objects.create(student=student, course=programme, status='active')
    response = api_client(student).post('/api/academics/registrations/', json.dumps({
        'student_id': another_student.id,
        'academic_period_id': period.id,
        'unit_id': unit.id,
        'registered_on': date.today().isoformat(),
        'status': 'registered',
    }), content_type='application/json')
    assert response.status_code == 201
    registration = Registration.objects.get()
    assert registration.student_id == student.id
    assert api_client(another_student).get('/api/academics/registrations/').json()['count'] == 0
    assert api_client(registrar).get('/api/academics/registrations/').json()['count'] == 1


@pytest.mark.django_db
@pytest.mark.parametrize('role', ['registrar', 'finance', 'librarian', 'hostel'])
def test_service_roles_get_limited_paginated_student_lookup(django_user_model, role):
    staff = create_user(django_user_model, role=role, suffix=f'{role}-lookup')
    student = create_user(django_user_model, role='student', suffix=f'{role}-student')
    create_user(django_user_model, role='lecturer', suffix=f'{role}-lecturer')
    response = api_client(staff).get('/api/users/?role=student&search=student&page=1&page_size=1')
    assert response.status_code == 200
    data = response.json()
    assert data['count'] == 1
    assert data['results'][0]['id'] == student.id
    assert 'gpa' not in data['results'][0]
    assert api_client(staff).get('/api/users/?role=lecturer').status_code == 403


@pytest.mark.django_db
def test_academic_lookups_honor_search_pagination_and_active_filters(django_user_model):
    admin = create_user(django_user_model, role='admin', suffix='lookup-admin')
    department = Department.objects.create(name='Technology', code='TECH')
    Course.objects.create(title='Software Engineering', code='SE1', department=department, is_active=True)
    Course.objects.create(title='Inactive Engineering', code='SE2', department=department, is_active=False)
    Unit.objects.create(code='SE-101', title='Software Design', is_active=True)
    Unit.objects.create(code='SE-102', title='Legacy Design', is_active=False)
    client = api_client(admin)
    courses = client.get('/api/academics/courses/?search=software&page=1&page_size=10').json()
    assert courses['count'] == 1
    assert courses['results'][0]['code'] == 'SE1'
    units = client.get('/api/academics/units/?search=software&is_active=true&page_size=100').json()
    assert units['count'] == 1
    assert units['results'][0]['code'] == 'SE-101'


@pytest.mark.django_db
def test_finance_requests_are_not_payments_and_voids_are_auditable(django_user_model):
    student = create_user(django_user_model, role='student', suffix='student4')
    finance = create_user(django_user_model, role='finance', suffix='finance1')
    department = Department.objects.create(name='Business', code='BUS')
    programme = Course.objects.create(title='Business', code='BUS1', department=department)
    Enrollment.objects.create(student=student, course=programme, status='active')
    fee = FeeStructure.objects.create(name='Tuition', programme=programme, academic_year='2027/2028', amount=Decimal('500'))
    invoice = Invoice.objects.create(student=student, fee_structure=fee, amount=Decimal('500'), due_date=date.today() + timedelta(days=30), status='issued')

    response = api_client(student).post('/api/finance/payment-requests/', json.dumps({
        'invoice_id': invoice.id, 'method': 'mpesa', 'phone_number': '254700000000',
    }), content_type='application/json')
    assert response.status_code == 201
    assert PaymentRequest.objects.count() == 1
    assert Payment.objects.count() == 0

    payment_response = api_client(finance).post('/api/finance/payments/', json.dumps({
        'invoice_id': invoice.id, 'amount': '500', 'method': 'bank', 'reference': 'BANK-001',
        'paid_at': date.today().isoformat(), 'status': 'confirmed',
    }), content_type='application/json')
    assert payment_response.status_code == 201
    payment_id = payment_response.json()['id']
    void_response = api_client(finance).post(f'/api/finance/payments/{payment_id}/void/', json.dumps({'reason': 'Duplicate reconciliation'}), content_type='application/json')
    assert void_response.status_code == 200
    assert PaymentReversal.objects.get(payment_id=payment_id).reason == 'Duplicate reconciliation'
    assert Invoice.objects.get(pk=invoice.id).status == 'issued'


@pytest.mark.django_db
def test_students_only_see_their_finance_records(django_user_model):
    first = create_user(django_user_model, role='student', suffix='student5')
    second = create_user(django_user_model, role='student', suffix='student6')
    finance = create_user(django_user_model, role='finance', suffix='finance2')
    department = Department.objects.create(name='Arts', code='ART')
    programme = Course.objects.create(title='Arts', code='ART1', department=department)
    first_enrollment = Enrollment.objects.create(student=first, course=programme, status='active')
    fee = FeeStructure.objects.create(name='Arts fee', programme=programme, academic_year='2027/2028', amount=100)
    Invoice.objects.create(student=first, fee_structure=fee, amount=100, due_date=date.today() + timedelta(days=20), status='issued')
    assert api_client(first).get('/api/finance/invoices/').json()['count'] == 1
    assert api_client(second).get('/api/finance/invoices/').json()['count'] == 0
    assert api_client(finance).get('/api/finance/invoices/').json()['count'] == 1
    assert first_enrollment.student_id == first.id


@pytest.mark.django_db
def test_library_availability_and_student_reservation_scope(django_user_model):
    student = create_user(django_user_model, role='student', suffix='student7')
    other = create_user(django_user_model, role='student', suffix='student8')
    librarian = create_user(django_user_model, role='librarian', suffix='librarian1')
    book = Book.objects.create(title='Campus Handbook', author='Library Team', total_copies=1)
    reservation = api_client(student).post('/api/library/reservations/', json.dumps({'book_id': book.id}), content_type='application/json')
    assert reservation.status_code == 201
    assert reservation.json()['status'] == 'ready'
    assert api_client(other).get('/api/library/reservations/').json()['count'] == 0
    duplicate = api_client(student).post('/api/library/reservations/', json.dumps({'book_id': book.id}), content_type='application/json')
    assert duplicate.status_code == 409
    loan = api_client(librarian).post('/api/library/loans/', json.dumps({
        'book_id': book.id,
        'student_id': student.id,
        'borrowed_on': date.today().isoformat(),
        'due_date': (date.today() + timedelta(days=10)).isoformat(),
        'status': 'active',
    }), content_type='application/json')
    assert loan.status_code == 201
    assert Reservation.objects.get(pk=reservation.json()['id']).status == 'fulfilled'
    overdue_book = Book.objects.create(title='Archive Guide', author='Library Team', total_copies=1)
    overdue_loan = api_client(librarian).post('/api/library/loans/', json.dumps({
        'book_id': overdue_book.id,
        'student_id': student.id,
        'borrowed_on': (date.today() - timedelta(days=14)).isoformat(),
        'due_date': (date.today() - timedelta(days=1)).isoformat(),
        'status': 'overdue',
    }), content_type='application/json')
    assert overdue_loan.status_code == 201
    assert overdue_loan.json()['status'] == 'overdue'
    overdue_detail = api_client(librarian).patch(
        f"/api/library/loans/{overdue_loan.json()['id']}/",
        json.dumps({'status': 'overdue'}),
        content_type='application/json',
    )
    assert overdue_detail.status_code == 200
    assert overdue_detail.json()['status'] == 'overdue'


@pytest.mark.django_db
def test_hostel_room_occupancy_is_derived_and_capacity_is_enforced(django_user_model):
    student = create_user(django_user_model, role='student', suffix='student9')
    warden = create_user(django_user_model, role='hostel', suffix='warden1')
    hostel = Hostel.objects.create(name='North Hall', location='North campus', gender_policy='mixed', capacity=1)
    room = Room.objects.create(hostel=hostel, room_number='101', capacity=1)
    client = api_client(warden)
    payload = {
        'student_id': student.id,
        'room_id': room.id,
        'academic_year': '2027/2028',
        'starts_on': date.today().isoformat(),
        'status': 'allocated',
    }
    response = client.post('/api/hostels/allocations/', json.dumps(payload), content_type='application/json')
    assert response.status_code == 201
    room_data = client.get('/api/hostels/rooms/?status=full').json()['results'][0]
    assert room_data['occupied'] == 1
    assert room_data['status'] == 'full'
    another_student = create_user(django_user_model, role='student', suffix='student10')
    payload['student_id'] = another_student.id
    assert client.post('/api/hostels/allocations/', json.dumps(payload), content_type='application/json').status_code == 409
    assert Allocation.objects.count() == 1
