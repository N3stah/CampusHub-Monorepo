import pytest
from apps.accounts.models import User
from apps.academics.models import Department, Course, Unit, Offering, UnitTeachingAssignment, Enrollment, ClassSession
from apps.accounts.jwt_utils import make_pair
from django.utils import timezone

pytestmark = pytest.mark.django_db

@pytest.fixture
def setup_data(db, active_period, register_unit):
    admin = User.objects.create_user(email='admin@test.com', username='admin', password='pass', first_name='A', last_name='B', role='admin')
    lecturer = User.objects.create_user(email='lec@test.com', username='lec', password='pass', first_name='L', last_name='M', role='lecturer')
    student = User.objects.create_user(email='student@test.com', username='student', password='pass', first_name='S', last_name='N', role='student')
    dept = Department.objects.create(name='CS', code='CS')
    course = Course.objects.create(code='CS101', title='Intro', department=dept)
    unit = Unit.objects.create(code='CS101U', title='Unit')
    offering = Offering.objects.create(unit=unit, course=course)
    UnitTeachingAssignment.objects.create(offering=offering, lecturer=lecturer)
    Enrollment.objects.create(student=student, course=course, status='active')
    register_unit(student, unit)
    session = ClassSession.objects.create(offering=offering, day_of_week=0, start_time='09:00', end_time='10:00', starts_on='2026-01-01', ends_on='2026-12-31')
    return {'admin': admin, 'lecturer': lecturer, 'student': student, 'offering': offering, 'session': session}


def test_attendance_get(client, setup_data):
    lec_token, _ = make_pair(setup_data['lecturer'])
    headers = {'HTTP_AUTHORIZATION': f'Bearer {lec_token}'}
    sid = setup_data['session'].id
    date = timezone.now().date().isoformat()
    resp = client.get(f'/api/academics/sessions/{sid}/attendance/?date={date}', **headers)
    assert resp.status_code == 200
    data = resp.json()
    assert 'session' in data and 'date' in data and 'records' in data
    assert len(data['records']) == 1
    assert data['records'][0]['status'] is None


def test_attendance_put(client, setup_data):
    lec_token, _ = make_pair(setup_data['lecturer'])
    headers = {'HTTP_AUTHORIZATION': f'Bearer {lec_token}'}
    sid = setup_data['session'].id
    stu_id = setup_data['student'].id
    date = timezone.now().date().isoformat()
    resp = client.put(f'/api/academics/sessions/{sid}/attendance/?date={date}',
        data={'records': [{'student_id': stu_id, 'status': 'present'}]},
        content_type='application/json', **headers)
    assert resp.status_code == 200
    assert resp.json()['records'][0]['status'] == 'present'
    resp = client.put(f'/api/academics/sessions/{sid}/attendance/?date={date}',
        data={'records': [{'student_id': stu_id, 'status': 'absent'}]},
        content_type='application/json', **headers)
    assert resp.status_code == 200
    assert resp.json()['records'][0]['status'] == 'absent'


def test_attendance_student_forbidden(client, setup_data):
    stu_token, _ = make_pair(setup_data['student'])
    headers = {'HTTP_AUTHORIZATION': f'Bearer {stu_token}'}
    sid = setup_data['session'].id
    date = timezone.now().date().isoformat()
    resp = client.get(f'/api/academics/sessions/{sid}/attendance/?date={date}', **headers)
    assert resp.status_code == 403
