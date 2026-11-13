import pytest
from apps.accounts.models import User
from apps.academics.models import (
    Department, Course, Unit, Offering, UnitTeachingAssignment, Enrollment, Assignment
)
from apps.accounts.jwt_utils import make_pair
from django.utils import timezone
from datetime import timedelta

pytestmark = pytest.mark.django_db


@pytest.fixture
def setup(db, active_period, register_unit):
    dept = Department.objects.create(name='CS', code='CS')
    course1 = Course.objects.create(code='CS101', title='Intro', department=dept)
    unit1 = Unit.objects.create(code='CS101U', title='Unit 1')
    offering1 = Offering.objects.create(unit=unit1, course=course1)
    course2 = Course.objects.create(code='CS102', title='Advanced', department=dept)
    unit2 = Unit.objects.create(code='CS102U', title='Unit 2')
    offering2 = Offering.objects.create(unit=unit2, course=course2)
    lecturer1 = User.objects.create_user(email='lec1@test.com', username='lec1', password='pass', first_name='Lec', last_name='One', role='lecturer')
    lecturer2 = User.objects.create_user(email='lec2@test.com', username='lec2', password='pass', first_name='Lec', last_name='Two', role='lecturer')
    UnitTeachingAssignment.objects.create(offering=offering1, lecturer=lecturer1)
    UnitTeachingAssignment.objects.create(offering=offering2, lecturer=lecturer2)
    student = User.objects.create_user(email='student@test.com', username='student', password='pass', first_name='Stu', last_name='Dent', role='student', admission_number='ADM001')
    Enrollment.objects.create(student=student, course=course1, status='active')
    register_unit(student, unit1)
    admin = User.objects.create_user(email='admin@test.com', username='admin', password='pass', first_name='Admin', last_name='User', role='admin')
    officer = User.objects.create_user(email='officer@test.com', username='officer', password='pass', first_name='Off', last_name='Cer', role='officer')
    a1 = Assignment.objects.create(offering=offering1, title='HW1', assignment_type='file', due_at=timezone.now() + timedelta(days=7), max_points=100, is_published=True)
    a2 = Assignment.objects.create(offering=offering2, title='HW2', assignment_type='file', due_at=timezone.now() + timedelta(days=7), max_points=100, is_published=True)
    a3 = Assignment.objects.create(offering=offering1, title='Draft', assignment_type='file', due_at=timezone.now() + timedelta(days=7), max_points=100, is_published=False)
    return type('S', (), dict(dept=dept, course1=course1, course2=course2, unit1=unit1, unit2=unit2, offering1=offering1, offering2=offering2, lecturer1=lecturer1, lecturer2=lecturer2, student=student, admin=admin, officer=officer, a1=a1, a2=a2, a3=a3))()


def _headers(user):
    token, _ = make_pair(user)
    return {'HTTP_AUTHORIZATION': f'Bearer {token}'}

def _results(response):
    data = response.json()
    return data['results'] if isinstance(data, dict) and 'results' in data else data


def test_list_lecturer_own_only(client, setup):
    r = client.get('/api/academics/assignments/', **_headers(setup.lecturer1))
    ids = {a['id'] for a in _results(r)}
    assert setup.a1.id in ids and setup.a3.id in ids and setup.a2.id not in ids

def test_list_admin_all(client, setup):
    r = client.get('/api/academics/assignments/', **_headers(setup.admin))
    ids = {a['id'] for a in _results(r)}
    assert {setup.a1.id, setup.a2.id, setup.a3.id}.issubset(ids)

def test_list_student_published_active(client, setup):
    r = client.get('/api/academics/assignments/', **_headers(setup.student))
    ids = {a['id'] for a in _results(r)}
    assert setup.a1.id in ids and setup.a2.id not in ids and setup.a3.id not in ids

def test_list_officer_denied(client, setup):
    r = client.get('/api/academics/assignments/', **_headers(setup.officer))
    assert r.status_code == 403

def test_oa_student_enrolled(client, setup):
    r = client.get(f'/api/academics/offerings/{setup.offering1.id}/assignments/', **_headers(setup.student))
    ids = {a['id'] for a in _results(r)}
    assert setup.a1.id in ids and setup.a3.id not in ids

def test_oa_student_not_enrolled(client, setup):
    r = client.get(f'/api/academics/offerings/{setup.offering2.id}/assignments/', **_headers(setup.student))
    assert r.status_code == 403

def test_oa_lecturer_unassigned(client, setup):
    r = client.get(f'/api/academics/offerings/{setup.offering1.id}/assignments/', **_headers(setup.lecturer2))
    assert r.status_code == 403

def test_oa_lecturer_assigned(client, setup):
    r = client.get(f'/api/academics/offerings/{setup.offering1.id}/assignments/', **_headers(setup.lecturer1))
    ids = {a['id'] for a in _results(r)}
    assert setup.a1.id in ids and setup.a3.id in ids
