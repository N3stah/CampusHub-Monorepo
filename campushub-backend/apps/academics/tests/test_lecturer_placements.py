import pytest
from apps.accounts.models import User
from apps.academics.models import (
    Department, Course, Unit, Offering, UnitTeachingAssignment, Enrollment
)
from apps.placements.models import Placement, Application
from apps.accounts.jwt_utils import make_pair
from datetime import date, timedelta

pytestmark = pytest.mark.django_db


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        email='admin@test.com', username='admin', password='pass',
        first_name='Admin', last_name='User', role='admin'
    )

@pytest.fixture
def lecturer(db):
    return User.objects.create_user(
        email='lec@test.com', username='lec', password='pass',
        first_name='Lec', last_name='User', role='lecturer'
    )

@pytest.fixture
def other_lecturer(db):
    return User.objects.create_user(
        email='lec2@test.com', username='lec2', password='pass',
        first_name='Other', last_name='Lecturer', role='lecturer'
    )

@pytest.fixture
def student(db):
    return User.objects.create_user(
        email='student@test.com', username='student', password='pass',
        first_name='Student', last_name='User', role='student',
        admission_number='ADM001'
    )

@pytest.fixture
def officer(db):
    return User.objects.create_user(
        email='officer@test.com', username='officer', password='pass',
        first_name='Officer', last_name='User', role='officer'
    )

@pytest.fixture
def offering(db, lecturer):
    dept = Department.objects.create(name='CS', code='CS')
    course = Course.objects.create(code='CS101', title='Intro', department=dept)
    unit = Unit.objects.create(code='CS101U', title='Intro Unit')
    off = Offering.objects.create(unit=unit, course=course)
    UnitTeachingAssignment.objects.create(offering=off, lecturer=lecturer)
    return off

@pytest.fixture
def placement(db, admin_user):
    return Placement.objects.create(
        posted_by=admin_user, title='Software Intern',
        company='TechCo', location='Nairobi',
        description='Internship', requirements='Python',
        deadline=date.today() + timedelta(days=30),
        slots_available=5, is_active=True
    )


# --- Auth ---

def test_lp_success_lecturer(client, lecturer, offering, student, placement):
    Enrollment.objects.create(student=student, course=offering.course, status='active')
    Application.objects.create(
        student=student, placement=placement, status='accepted',
        cover_note='Interested'
    )
    token, _ = make_pair(lecturer)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    response = client.get('/api/academics/lecturer/placements/', **headers)
    assert response.status_code == 200
    data = response.json()
    assert data['count'] == 1
    row = data['results'][0]
    assert row['student_id'] == student.id
    assert row['placement'] is not None
    assert row['placement']['title'] == 'Software Intern'
    assert row['placement']['company'] == 'TechCo'
    assert row['placement']['location'] == 'Nairobi'

def test_lp_success_admin(client, admin_user, offering, student):
    Enrollment.objects.create(student=student, course=offering.course, status='active')
    token, _ = make_pair(admin_user)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    response = client.get('/api/academics/lecturer/placements/', **headers)
    assert response.status_code == 200

def test_lp_401_no_token(client):
    response = client.get('/api/academics/lecturer/placements/')
    assert response.status_code == 401

def test_lp_403_student(client, student):
    token, _ = make_pair(student)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    response = client.get('/api/academics/lecturer/placements/', **headers)
    assert response.status_code == 403

def test_lp_403_officer(client, officer):
    token, _ = make_pair(officer)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    response = client.get('/api/academics/lecturer/placements/', **headers)
    assert response.status_code == 403

def test_lp_unassigned_lecturer_empty(client, other_lecturer):
    token, _ = make_pair(other_lecturer)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    response = client.get('/api/academics/lecturer/placements/', **headers)
    assert response.status_code == 200
    assert response.json()['count'] == 0


# --- Content ---

def test_lp_null_placement(client, lecturer, offering, student):
    """Student with no accepted application -> placement: null."""
    Enrollment.objects.create(student=student, course=offering.course, status='active')
    token, _ = make_pair(lecturer)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    response = client.get('/api/academics/lecturer/placements/', **headers)
    row = response.json()['results'][0]
    assert row['placement'] is None

def test_lp_accepted_only(client, lecturer, offering, student, placement):
    """Pending applications do not show a placement."""
    Enrollment.objects.create(student=student, course=offering.course, status='active')
    Application.objects.create(
        student=student, placement=placement, status='pending',
        cover_note='Pending'
    )
    token, _ = make_pair(lecturer)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    response = client.get('/api/academics/lecturer/placements/', **headers)
    row = response.json()['results'][0]
    assert row['placement'] is None

def test_lp_empty(client, lecturer, offering):
    """Teaching assignment exists but no enrolled students -> empty."""
    token, _ = make_pair(lecturer)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    response = client.get('/api/academics/lecturer/placements/', **headers)
    assert response.status_code == 200
    assert response.json()['count'] == 0
