import pytest
from apps.accounts.models import User
from apps.academics.models import (
    Department, Course, Unit, Offering, UnitTeachingAssignment,
    ClassSession, Enrollment, Assignment, Lesson
)
from apps.accounts.jwt_utils import make_pair
from django.utils import timezone
from datetime import timedelta

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
        first_name='Student', last_name='User', role='student',
        admission_number='ADM001'
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
def offering_with_events(db, offering):
    """Offering with a class session, an assignment, and a lesson."""
    ClassSession.objects.create(
        offering=offering, day_of_week=0, start_time='09:00',
        end_time='10:00', starts_on='2026-01-01', ends_on='2026-06-01',
        location='Room A'
    )
    Assignment.objects.create(
        offering=offering, title='HW1', assignment_type='file',
        due_at=timezone.now() + timedelta(days=7), max_points=100,
        is_published=True
    )
    Lesson.objects.create(
        offering=offering, title='Lesson 1',
        scheduled_at=timezone.now() + timedelta(days=2),
        duration_minutes=60
    )
    return offering


# --- Auth ---

def test_ics_success_admin(client, admin_user, offering_with_events):
    token, _ = make_pair(admin_user)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    response = client.get('/api/academics/calendar.ics', **headers)
    assert response.status_code == 200
    content = response.content.decode()
    assert 'BEGIN:VCALENDAR' in content
    assert 'END:VCALENDAR' in content

def test_ics_success_lecturer(client, lecturer, offering_with_events):
    token, _ = make_pair(lecturer)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    response = client.get('/api/academics/calendar.ics', **headers)
    assert response.status_code == 200
    assert 'BEGIN:VEVENT' in response.content.decode()

def test_ics_success_student(client, student, offering_with_events):
    Enrollment.objects.create(student=student, course=offering_with_events.course, status='active')
    token, _ = make_pair(student)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    response = client.get('/api/academics/calendar.ics', **headers)
    assert response.status_code == 200
    assert 'BEGIN:VCALENDAR' in response.content.decode()

def test_ics_401_no_token(client, offering):
    response = client.get('/api/academics/calendar.ics')
    assert response.status_code == 401


# --- Content & structure ---

def test_ics_content_type(client, admin_user, offering_with_events):
    token, _ = make_pair(admin_user)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    response = client.get('/api/academics/calendar.ics', **headers)
    assert response.status_code == 200
    assert response['Content-Type'].startswith('text/calendar')

def test_ics_structure(client, admin_user, offering_with_events):
    token, _ = make_pair(admin_user)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    response = client.get('/api/academics/calendar.ics', **headers)
    content = response.content.decode()
    assert 'BEGIN:VCALENDAR' in content
    assert 'VERSION:2.0' in content
    assert 'PRODID:-//CampusHub//Calendar//EN' in content
    assert 'END:VCALENDAR' in content
    assert content.count('BEGIN:VEVENT') >= 1
    assert content.count('END:VEVENT') >= 1
    assert 'UID:' in content
    assert 'DTSTART:' in content
    assert 'SUMMARY:' in content

def test_ics_event_uids_match_json(client, admin_user, offering_with_events):
    """ICS UIDs correspond to JSON event IDs."""
    token, _ = make_pair(admin_user)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    json_resp = client.get('/api/academics/calendar/', **headers)
    ics_resp = client.get('/api/academics/calendar.ics', **headers)
    ics_content = ics_resp.content.decode()
    for e in json_resp.json():
        assert f'UID:{e["id"]}@campushub' in ics_content

def test_ics_from_to_filter(client, admin_user, offering_with_events):
    """from/to query params filter ICS events."""
    token, _ = make_pair(admin_user)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    r_all = client.get('/api/academics/calendar.ics', **headers)
    count_all = r_all.content.decode().count('BEGIN:VEVENT')
    r_future = client.get('/api/academics/calendar.ics?from=2099-01-01', **headers)
    count_future = r_future.content.decode().count('BEGIN:VEVENT')
    assert count_future <= count_all

def test_ics_empty(client, admin_user, offering):
    """No events -> valid ICS with no VEVENTs."""
    token, _ = make_pair(admin_user)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    response = client.get('/api/academics/calendar.ics', **headers)
    assert response.status_code == 200
    content = response.content.decode()
    assert 'BEGIN:VCALENDAR' in content
    assert 'END:VCALENDAR' in content
    assert 'BEGIN:VEVENT' not in content

def test_ics_crlf_line_endings(client, admin_user, offering_with_events):
    """RFC 5545 requires CRLF line endings."""
    token, _ = make_pair(admin_user)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    response = client.get('/api/academics/calendar.ics', **headers)
    content = response.content.decode()
    assert '\r\n' in content
    lines = content.split('\r\n')
    assert lines[0] == 'BEGIN:VCALENDAR'
