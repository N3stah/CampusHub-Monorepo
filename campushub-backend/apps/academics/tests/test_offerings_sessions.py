import pytest
from django.test import Client
from apps.accounts.models import User
from apps.academics.models import Department, Course, Unit, Offering, UnitTeachingAssignment, ClassSession, Enrollment
from apps.accounts.jwt_utils import make_pair

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
def student(db):
    return User.objects.create_user(
        email='student@test.com', username='student', password='pass',
        first_name='Student', last_name='User', role='student', admission_number='ADM001'
    )

@pytest.fixture
def offering(db, lecturer):
    dept = Department.objects.create(name='CS', code='CS')
    course = Course.objects.create(code='CS101', title='Intro', department=dept)
    unit = Unit.objects.create(code='CS101U', title='Intro Unit')
    off = Offering.objects.create(unit=unit, course=course)
    UnitTeachingAssignment.objects.create(offering=off, lecturer=lecturer)
    return off

def test_offering_detail(client, admin_user, offering):
    token, _ = make_pair(admin_user)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    response = client.get(f'/api/academics/offerings/{offering.id}/', **headers)
    assert response.status_code == 200
    assert response.json()['id'] == offering.id

def test_offering_roster(client, lecturer, offering):
    token, _ = make_pair(lecturer)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    response = client.get(f'/api/academics/offerings/{offering.id}/roster/', **headers)
    assert response.status_code == 200
    assert 'count' in response.json()

def test_offering_sessions(client, lecturer, offering):
    token, _ = make_pair(lecturer)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    
    # Create session
    response = client.post(
        f'/api/academics/offerings/{offering.id}/sessions/',
        data={'day_of_week': 0, 'start_time': '09:00', 'end_time': '10:00', 'starts_on': '2026-01-01', 'ends_on': '2026-06-01'},
        content_type='application/json',
        **headers
    )
    assert response.status_code == 201
    session_id = response.json()['id']
    
    # List sessions
    response = client.get(f'/api/academics/offerings/{offering.id}/sessions/', **headers)
    assert response.status_code == 200
    assert len(response.json()) >= 1
    
    # Delete session
    response = client.delete(f'/api/academics/sessions/{session_id}/', **headers)
    assert response.status_code == 200

def test_calendar(client, admin_user, offering):
    # Create a session for the calendar
    ClassSession.objects.create(
        offering=offering, day_of_week=1, start_time='10:00', end_time='11:00',
        starts_on='2026-01-01', ends_on='2026-06-01'
    )
    token, _ = make_pair(admin_user)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    response = client.get('/api/academics/calendar/', **headers)
    assert response.status_code == 200
    assert response.json()['count'] >= 1
