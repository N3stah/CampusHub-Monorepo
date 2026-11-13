import pytest
from apps.accounts.models import User
from apps.academics.models import Department, Course, Unit, Offering, UnitTeachingAssignment, Enrollment
from apps.accounts.jwt_utils import make_pair
from django.utils import timezone
from datetime import timedelta

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
    return {'admin': admin, 'lecturer': lecturer, 'student': student, 'offering': offering}


def test_lesson_crud(client, setup_data):
    lec_token, _ = make_pair(setup_data['lecturer'])
    headers = {'HTTP_AUTHORIZATION': f'Bearer {lec_token}'}
    oid = setup_data['offering'].id
    sa = (timezone.now() + timedelta(days=1)).isoformat()
    resp = client.post(f'/api/academics/offerings/{oid}/lessons/',
        data={'title': 'Lesson 1', 'scheduled_at': sa, 'duration_minutes': 60},
        content_type='application/json', **headers)
    assert resp.status_code == 201
    lid = resp.json()['id']
    resp = client.get(f'/api/academics/offerings/{oid}/lessons/', **headers)
    assert resp.status_code == 200
    assert resp.json()['count'] >= 1
    resp = client.patch(f'/api/academics/lessons/{lid}/',
        data={'title': 'Updated'}, content_type='application/json', **headers)
    assert resp.status_code == 200
    assert resp.json()['title'] == 'Updated'
    resp = client.delete(f'/api/academics/lessons/{lid}/', **headers)
    assert resp.status_code == 200


def test_lesson_overlap_rejected(client, setup_data):
    lec_token, _ = make_pair(setup_data['lecturer'])
    headers = {'HTTP_AUTHORIZATION': f'Bearer {lec_token}'}
    oid = setup_data['offering'].id
    sa = (timezone.now() + timedelta(days=1)).isoformat()
    resp = client.post(f'/api/academics/offerings/{oid}/lessons/',
        data={'title': 'First', 'scheduled_at': sa, 'duration_minutes': 60},
        content_type='application/json', **headers)
    assert resp.status_code == 201
    resp = client.post(f'/api/academics/offerings/{oid}/lessons/',
        data={'title': 'Overlap', 'scheduled_at': sa, 'duration_minutes': 30},
        content_type='application/json', **headers)
    assert resp.status_code == 400
    assert 'overlap' in resp.json()['error'].lower()


def test_lesson_student_can_list(client, setup_data):
    lec_token, _ = make_pair(setup_data['lecturer'])
    headers = {'HTTP_AUTHORIZATION': f'Bearer {lec_token}'}
    oid = setup_data['offering'].id
    sa = (timezone.now() + timedelta(days=1)).isoformat()
    client.post(f'/api/academics/offerings/{oid}/lessons/',
        data={'title': 'Student View', 'scheduled_at': sa, 'duration_minutes': 60},
        content_type='application/json', **headers)
    stu_token, _ = make_pair(setup_data['student'])
    stu_headers = {'HTTP_AUTHORIZATION': f'Bearer {stu_token}'}
    resp = client.get(f'/api/academics/offerings/{oid}/lessons/', **stu_headers)
    assert resp.status_code == 200
