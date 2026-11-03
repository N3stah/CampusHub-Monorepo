import pytest
from apps.accounts.models import User
from apps.academics.models import (
    Department, Course, Unit, Offering, UnitTeachingAssignment,
    ClassSession, Enrollment, Assignment, AssignmentSubmission, AttendanceRecord
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
def other_lecturer(db):
    return User.objects.create_user(
        email='lec2@test.com', username='lec2', password='pass',
        first_name='Other', last_name='Lecturer', role='lecturer'
    )

@pytest.fixture
def student(db):
    return User.objects.create_user(
        email='student@test.com', username='student', password='pass',
        first_name='Student', last_name='User', role='student', admission_number='ADM001'
    )

@pytest.fixture
def student2(db):
    return User.objects.create_user(
        email='student2@test.com', username='student2', password='pass',
        first_name='Student2', last_name='User', role='student', admission_number='ADM002'
    )

@pytest.fixture
def offering(db, lecturer):
    dept = Department.objects.create(name='CS', code='CS')
    course = Course.objects.create(code='CS101', title='Intro', department=dept)
    unit = Unit.objects.create(code='CS101U', title='Intro Unit')
    off = Offering.objects.create(unit=unit, course=course)
    UnitTeachingAssignment.objects.create(offering=off, lecturer=lecturer)
    return off


def _past_assignment(offering, title='HW1'):
    return Assignment.objects.create(
        offering=offering, title=title, assignment_type='file',
        due_at=timezone.now() - timedelta(days=1), max_points=100,
        is_published=True
    )

def _session(offering):
    return ClassSession.objects.create(
        offering=offering, day_of_week=0, start_time='09:00',
        end_time='10:00', starts_on='2026-01-01', ends_on='2026-06-01'
    )


# --- Auth & routing ---

def test_at_risk_success_lecturer(client, lecturer, offering, student):
    """Assigned lecturer gets 200 with correct data shape."""
    Enrollment.objects.create(student=student, course=offering.course, status='active')
    token, _ = make_pair(lecturer)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    response = client.get(f'/api/academics/offerings/{offering.id}/at-risk/', **headers)
    assert response.status_code == 200
    data = response.json()
    assert data['count'] == 1
    row = data['results'][0]
    assert row['student_id'] == student.id
    assert row['at_risk'] == False
    assert row['reasons'] == []
    assert row['attendance_rate'] == 1.0
    assert row['total_sessions'] == 0
    assert row['missed_assignments'] == 0

def test_at_risk_success_admin(client, admin_user, offering, student):
    """Admin also gets 200."""
    Enrollment.objects.create(student=student, course=offering.course, status='active')
    token, _ = make_pair(admin_user)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    response = client.get(f'/api/academics/offerings/{offering.id}/at-risk/', **headers)
    assert response.status_code == 200

def test_at_risk_401_no_token(client, offering):
    """No auth header -> 401."""
    response = client.get(f'/api/academics/offerings/{offering.id}/at-risk/')
    assert response.status_code == 401

def test_at_risk_403_student(client, student, offering):
    """Student role -> 403."""
    token, _ = make_pair(student)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    response = client.get(f'/api/academics/offerings/{offering.id}/at-risk/', **headers)
    assert response.status_code == 403

def test_at_risk_403_unassigned_lecturer(client, other_lecturer, offering):
    """Lecturer not assigned to this offering -> 403."""
    token, _ = make_pair(other_lecturer)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    response = client.get(f'/api/academics/offerings/{offering.id}/at-risk/', **headers)
    assert response.status_code == 403

def test_at_risk_404_not_found(client, lecturer):
    """Non-existent offering -> 404."""
    token, _ = make_pair(lecturer)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    response = client.get('/api/academics/offerings/99999/at-risk/', **headers)
    assert response.status_code == 404

def test_at_risk_400_bad_attendance_threshold(client, lecturer, offering):
    """Non-numeric attendance_threshold -> 400."""
    token, _ = make_pair(lecturer)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    response = client.get(f'/api/academics/offerings/{offering.id}/at-risk/?attendance_threshold=abc', **headers)
    assert response.status_code == 400

def test_at_risk_400_bad_missed_threshold(client, lecturer, offering):
    """Non-integer missed_threshold -> 400."""
    token, _ = make_pair(lecturer)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    response = client.get(f'/api/academics/offerings/{offering.id}/at-risk/?missed_threshold=abc', **headers)
    assert response.status_code == 400


# --- Computation ---

def test_at_risk_attendance_boundary(client, lecturer, offering, student):
    """Rate exactly at threshold (0.75) is NOT flagged (uses <)."""
    Enrollment.objects.create(student=student, course=offering.course, status='active')
    s = _session(offering)
    AttendanceRecord.objects.create(session=s, student=student, date='2026-01-01', status='present')
    AttendanceRecord.objects.create(session=s, student=student, date='2026-01-02', status='present')
    AttendanceRecord.objects.create(session=s, student=student, date='2026-01-03', status='present')
    AttendanceRecord.objects.create(session=s, student=student, date='2026-01-04', status='absent')
    token, _ = make_pair(lecturer)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    response = client.get(f'/api/academics/offerings/{offering.id}/at-risk/', **headers)
    row = response.json()['results'][0]
    assert row['attended_sessions'] == 3
    assert row['total_sessions'] == 4
    assert row['attendance_rate'] == 0.75
    assert 'attendance' not in row['reasons']

def test_at_risk_flagged_low_attendance(client, lecturer, offering, student):
    """Student below threshold is flagged."""
    Enrollment.objects.create(student=student, course=offering.course, status='active')
    s = _session(offering)
    AttendanceRecord.objects.create(session=s, student=student, date='2026-01-01', status='present')
    AttendanceRecord.objects.create(session=s, student=student, date='2026-01-02', status='present')
    AttendanceRecord.objects.create(session=s, student=student, date='2026-01-03', status='absent')
    AttendanceRecord.objects.create(session=s, student=student, date='2026-01-04', status='absent')
    token, _ = make_pair(lecturer)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    response = client.get(f'/api/academics/offerings/{offering.id}/at-risk/', **headers)
    row = response.json()['results'][0]
    assert row['at_risk'] == True
    assert 'attendance' in row['reasons']
    assert row['attendance_rate'] == 0.5

def test_at_risk_excused_excluded(client, lecturer, offering, student):
    """Excused absences excluded from both numerator and denominator."""
    Enrollment.objects.create(student=student, course=offering.course, status='active')
    s = _session(offering)
    AttendanceRecord.objects.create(session=s, student=student, date='2026-01-01', status='present')
    AttendanceRecord.objects.create(session=s, student=student, date='2026-01-02', status='present')
    AttendanceRecord.objects.create(session=s, student=student, date='2026-01-03', status='excused')
    AttendanceRecord.objects.create(session=s, student=student, date='2026-01-04', status='excused')
    token, _ = make_pair(lecturer)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    response = client.get(f'/api/academics/offerings/{offering.id}/at-risk/', **headers)
    row = response.json()['results'][0]
    assert row['attended_sessions'] == 2
    assert row['total_sessions'] == 2
    assert row['attendance_rate'] == 1.0
    assert 'attendance' not in row['reasons']

def test_at_risk_missed_assignments(client, lecturer, offering, student):
    """2+ missed past-due assignments -> flagged."""
    Enrollment.objects.create(student=student, course=offering.course, status='active')
    a1 = _past_assignment(offering, 'HW1')
    a2 = _past_assignment(offering, 'HW2')
    a3 = _past_assignment(offering, 'HW3')
    AssignmentSubmission.objects.create(assignment=a1, student=student)
    token, _ = make_pair(lecturer)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    response = client.get(f'/api/academics/offerings/{offering.id}/at-risk/', **headers)
    row = response.json()['results'][0]
    assert row['total_assignments'] == 3
    assert row['missed_assignments'] == 2
    assert row['at_risk'] == True
    assert 'assignments' in row['reasons']

def test_at_risk_custom_threshold(client, lecturer, offering, student):
    """Custom attendance_threshold changes who is flagged."""
    Enrollment.objects.create(student=student, course=offering.course, status='active')
    s = _session(offering)
    AttendanceRecord.objects.create(session=s, student=student, date='2026-01-01', status='present')
    AttendanceRecord.objects.create(session=s, student=student, date='2026-01-02', status='present')
    AttendanceRecord.objects.create(session=s, student=student, date='2026-01-03', status='present')
    AttendanceRecord.objects.create(session=s, student=student, date='2026-01-04', status='absent')
    token, _ = make_pair(lecturer)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    r1 = client.get(f'/api/academics/offerings/{offering.id}/at-risk/', **headers)
    assert 'attendance' not in r1.json()['results'][0]['reasons']
    r2 = client.get(f'/api/academics/offerings/{offering.id}/at-risk/?attendance_threshold=0.8', **headers)
    assert 'attendance' in r2.json()['results'][0]['reasons']

def test_at_risk_sort_order(client, lecturer, offering, student, student2):
    """At-risk students appear before non-at-risk."""
    Enrollment.objects.create(student=student, course=offering.course, status='active')
    Enrollment.objects.create(student=student2, course=offering.course, status='active')
    s = _session(offering)
    AttendanceRecord.objects.create(session=s, student=student, date='2026-01-01', status='absent')
    AttendanceRecord.objects.create(session=s, student=student, date='2026-01-02', status='absent')
    token, _ = make_pair(lecturer)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    response = client.get(f'/api/academics/offerings/{offering.id}/at-risk/', **headers)
    results = response.json()['results']
    assert results[0]['at_risk'] == True
    assert results[0]['student_id'] == student.id
    assert results[1]['at_risk'] == False

def test_at_risk_empty_offering(client, lecturer, offering):
    """Offering with no enrollments -> 200 with empty results."""
    token, _ = make_pair(lecturer)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    response = client.get(f'/api/academics/offerings/{offering.id}/at-risk/', **headers)
    assert response.status_code == 200
    assert response.json()['count'] == 0
