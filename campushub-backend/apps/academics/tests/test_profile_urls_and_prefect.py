import pytest
import json
from apps.accounts.models import User
from apps.academics.models import (
    Department, Course, Unit, Offering, UnitTeachingAssignment, Enrollment
)
from apps.accounts.jwt_utils import make_pair

pytestmark = pytest.mark.django_db


@pytest.fixture
def setup(db):
    dept = Department.objects.create(name='CS', code='CS')
    course = Course.objects.create(code='CS101', title='Intro', department=dept)
    unit = Unit.objects.create(code='CS101U', title='Unit')
    offering = Offering.objects.create(unit=unit, course=course)
    lecturer = User.objects.create_user(email='lec@t.com', username='lec', password='TestPass123!', first_name='L', last_name='ec', role='lecturer')
    other_lecturer = User.objects.create_user(email='lec2@t.com', username='lec2', password='TestPass123!', first_name='L', last_name='ec2', role='lecturer')
    student = User.objects.create_user(email='s@t.com', username='s', password='TestPass123!', first_name='S', last_name='t', role='student', admission_number='ADM001')
    admin = User.objects.create_user(email='admin@t.com', username='admin', password='TestPass123!', first_name='A', last_name='dmin', role='admin')
    UnitTeachingAssignment.objects.create(offering=offering, lecturer=lecturer)
    enrollment = Enrollment.objects.create(student=student, course=course, status='active')
    return type('S', (), dict(dept=dept, course=course, unit=unit, offering=offering, lecturer=lecturer, other_lecturer=other_lecturer, student=student, admin=admin, enrollment=enrollment))()


def _h(u):
    t, _ = make_pair(u)
    return {'HTTP_AUTHORIZATION': f'Bearer {t}'}


# --- profile_picture_url in all endpoints ---

def test_at_risk_has_url(client, setup):
    r = client.get(f'/api/academics/offerings/{setup.offering.id}/at-risk/', **_h(setup.lecturer))
    assert 'profile_picture_url' in r.json()['results'][0]

def test_roster_has_url(client, setup):
    r = client.get(f'/api/academics/offerings/{setup.offering.id}/roster/', **_h(setup.lecturer))
    assert 'profile_picture_url' in r.json()['results'][0]

def test_lecturer_placements_has_url(client, setup):
    r = client.get('/api/academics/lecturer/placements/', **_h(setup.lecturer))
    assert 'profile_picture_url' in r.json()['results'][0]


# --- Prefect toggle ---

def test_prefect_toggle_lecturer(client, setup):
    r = client.patch(f'/api/academics/enrollments/{setup.enrollment.id}/prefect/', **_h(setup.lecturer))
    assert r.status_code == 200
    assert r.json()['is_class_prefect'] == True
    setup.enrollment.refresh_from_db()
    assert setup.enrollment.is_class_prefect == True

def test_prefect_unauthorized_lecturer(client, setup):
    r = client.patch(f'/api/academics/enrollments/{setup.enrollment.id}/prefect/', **_h(setup.other_lecturer))
    assert r.status_code == 403

def test_prefect_student_denied(client, setup):
    r = client.patch(f'/api/academics/enrollments/{setup.enrollment.id}/prefect/', **_h(setup.student))
    assert r.status_code == 403

def test_prefect_admin(client, setup):
    r = client.patch(f'/api/academics/enrollments/{setup.enrollment.id}/prefect/', **_h(setup.admin))
    assert r.status_code == 200

def test_prefect_explicit_set(client, setup):
    h = _h(setup.lecturer)
    url = f'/api/academics/enrollments/{setup.enrollment.id}/prefect/'
    r1 = client.patch(url, data=json.dumps({'is_class_prefect': True}), content_type='application/json', **h)
    assert r1.json()['is_class_prefect'] == True
    r2 = client.patch(url, data=json.dumps({'is_class_prefect': False}), content_type='application/json', **h)
    assert r2.json()['is_class_prefect'] == False

def test_prefect_404(client, setup):
    r = client.patch('/api/academics/enrollments/99999/prefect/', **_h(setup.lecturer))
    assert r.status_code == 404
