import pytest
from apps.accounts.models import User
from apps.academics.models import Department, Course, Unit, Offering, UnitTeachingAssignment, Enrollment
from apps.accounts.jwt_utils import make_pair

pytestmark = pytest.mark.django_db

@pytest.fixture
def setup_data(db):
    admin = User.objects.create_user(email='admin@test.com', username='admin', password='pass', first_name='A', last_name='B', role='admin')
    lecturer = User.objects.create_user(email='lec@test.com', username='lec', password='pass', first_name='L', last_name='M', role='lecturer')
    student = User.objects.create_user(email='student@test.com', username='student', password='pass', first_name='S', last_name='N', role='student')
    dept = Department.objects.create(name='CS', code='CS')
    course = Course.objects.create(code='CS101', title='Intro', department=dept)
    unit = Unit.objects.create(code='CS101U', title='Unit')
    offering = Offering.objects.create(unit=unit, course=course)
    UnitTeachingAssignment.objects.create(offering=offering, lecturer=lecturer)
    Enrollment.objects.create(student=student, course=course, status='active')
    return {'admin': admin, 'lecturer': lecturer, 'student': student, 'offering': offering}


def test_student_dashboard(client, setup_data):
    stu_token, _ = make_pair(setup_data['student'])
    headers = {'HTTP_AUTHORIZATION': f'Bearer {stu_token}'}
    resp = client.get('/api/academics/dashboard/student/', **headers)
    assert resp.status_code == 200
    data = resp.json()
    assert 'courses' in data and 'upcoming_assignments' in data
    assert 'pending_submissions_count' in data and 'recent_grades' in data and 'groups' in data
    assert len(data['courses']) >= 1


def test_lecturer_dashboard(client, setup_data):
    lec_token, _ = make_pair(setup_data['lecturer'])
    headers = {'HTTP_AUTHORIZATION': f'Bearer {lec_token}'}
    resp = client.get('/api/academics/dashboard/lecturer/', **headers)
    assert resp.status_code == 200
    data = resp.json()
    assert 'taught_offerings' in data and 'pending_grading_count' in data
    assert 'pending_submissions' in data and 'today_sessions' in data
    assert len(data['taught_offerings']) >= 1


def test_dashboard_role_guard(client, setup_data):
    stu_token, _ = make_pair(setup_data['student'])
    headers = {'HTTP_AUTHORIZATION': f'Bearer {stu_token}'}
    resp = client.get('/api/academics/dashboard/lecturer/', **headers)
    assert resp.status_code == 403
