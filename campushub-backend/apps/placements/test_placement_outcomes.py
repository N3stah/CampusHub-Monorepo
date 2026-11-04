import pytest
from apps.accounts.models import User
from apps.academics.models import Department
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
def officer(db):
    return User.objects.create_user(
        email='officer@test.com', username='officer', password='pass',
        first_name='Officer', last_name='User', role='officer'
    )

@pytest.fixture
def student(db):
    return User.objects.create_user(
        email='student@test.com', username='student', password='pass',
        first_name='Student', last_name='User', role='student',
        admission_number='ADM001'
    )

@pytest.fixture
def lecturer(db):
    return User.objects.create_user(
        email='lec@test.com', username='lec', password='pass',
        first_name='Lec', last_name='User', role='lecturer'
    )

@pytest.fixture
def dept_cs(db):
    return Department.objects.create(name='Computer Science', code='CS')

@pytest.fixture
def dept_math(db):
    return Department.objects.create(name='Mathematics', code='MATH')

@pytest.fixture
def placement(db, admin_user):
    return Placement.objects.create(
        posted_by=admin_user, title='Software Intern',
        company='TechCo', location='Nairobi',
        description='Internship', requirements='Python',
        deadline=date.today() + timedelta(days=30),
        slots_available=5, is_active=True
    )

def _make_student(dept, email, admission):
    return User.objects.create_user(
        email=email, username=email.split('@')[0], password='pass',
        first_name='S', last_name='Student', role='student',
        admission_number=admission, department=dept
    )

def _make_application(student, placement, status='pending'):
    return Application.objects.create(
        student=student, placement=placement, status=status,
        cover_note='I am interested in this placement.'
    )


# --- Auth ---

def test_outcomes_success_admin(client, admin_user):
    token, _ = make_pair(admin_user)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    response = client.get('/api/admin/placement-outcomes/', **headers)
    assert response.status_code == 200
    assert 'count' in response.json()

def test_outcomes_success_officer(client, officer):
    token, _ = make_pair(officer)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    response = client.get('/api/admin/placement-outcomes/', **headers)
    assert response.status_code == 200

def test_outcomes_401_no_token(client):
    response = client.get('/api/admin/placement-outcomes/')
    assert response.status_code == 401

def test_outcomes_403_student(client, student):
    token, _ = make_pair(student)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    response = client.get('/api/admin/placement-outcomes/', **headers)
    assert response.status_code == 403

def test_outcomes_403_lecturer(client, lecturer):
    token, _ = make_pair(lecturer)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    response = client.get('/api/admin/placement-outcomes/', **headers)
    assert response.status_code == 403

def test_outcomes_400_bad_department_id(client, admin_user):
    token, _ = make_pair(admin_user)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    response = client.get('/api/admin/placement-outcomes/?department_id=abc', **headers)
    assert response.status_code == 400


# --- Aggregation ---

def test_outcomes_aggregation(client, admin_user, placement, dept_cs, dept_math):
    """Per-department aggregation with correct counts."""
    s1 = _make_student(dept_cs, 's1@test.com', 'ADM001')
    s2 = _make_student(dept_cs, 's2@test.com', 'ADM002')
    s3 = _make_student(dept_cs, 's3@test.com', 'ADM003')
    _make_application(s1, placement, 'accepted')
    _make_application(s2, placement, 'pending')
    _make_application(s3, placement, 'rejected')

    s4 = _make_student(dept_math, 's4@test.com', 'ADM004')
    s5 = _make_student(dept_math, 's5@test.com', 'ADM005')
    _make_application(s4, placement, 'accepted')
    _make_application(s5, placement, 'shortlisted')

    token, _ = make_pair(admin_user)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    response = client.get('/api/admin/placement-outcomes/', **headers)
    assert response.status_code == 200
    data = response.json()
    assert data['count'] == 2

    cs = next(d for d in data['results'] if d['department_code'] == 'CS')
    assert cs['total_applications'] == 3
    assert cs['accepted'] == 1
    assert cs['pending'] == 1
    assert cs['rejected'] == 1
    assert cs['shortlisted'] == 0
    assert cs['unique_applicants'] == 3

    math = next(d for d in data['results'] if d['department_code'] == 'MATH')
    assert math['total_applications'] == 2
    assert math['accepted'] == 1
    assert math['shortlisted'] == 1
    assert math['unique_applicants'] == 2

def test_outcomes_filter_by_department(client, admin_user, placement, dept_cs, dept_math):
    """?department_id= scopes to one department."""
    s1 = _make_student(dept_cs, 's1@test.com', 'ADM001')
    s2 = _make_student(dept_math, 's2@test.com', 'ADM002')
    _make_application(s1, placement, 'accepted')
    _make_application(s2, placement, 'pending')

    token, _ = make_pair(admin_user)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    response = client.get(f'/api/admin/placement-outcomes/?department_id={dept_cs.id}', **headers)
    assert response.status_code == 200
    data = response.json()
    assert data['count'] == 1
    assert data['results'][0]['department_code'] == 'CS'

def test_outcomes_acceptance_rate(client, admin_user, placement, dept_cs):
    """acceptance_rate = accepted / total."""
    s1 = _make_student(dept_cs, 's1@test.com', 'ADM001')
    s2 = _make_student(dept_cs, 's2@test.com', 'ADM002')
    s3 = _make_student(dept_cs, 's3@test.com', 'ADM003')
    s4 = _make_student(dept_cs, 's4@test.com', 'ADM004')
    _make_application(s1, placement, 'accepted')
    _make_application(s2, placement, 'accepted')
    _make_application(s3, placement, 'pending')
    _make_application(s4, placement, 'rejected')

    token, _ = make_pair(admin_user)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    response = client.get('/api/admin/placement-outcomes/', **headers)
    row = response.json()['results'][0]
    assert row['total_applications'] == 4
    assert row['accepted'] == 2
    assert row['acceptance_rate'] == 0.5

def test_outcomes_empty(client, admin_user):
    """No applications -> 200 with count=0."""
    token, _ = make_pair(admin_user)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    response = client.get('/api/admin/placement-outcomes/', **headers)
    assert response.status_code == 200
    assert response.json()['count'] == 0
